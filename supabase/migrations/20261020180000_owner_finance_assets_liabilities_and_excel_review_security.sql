-- Owner-only accounting books and controlled Excel fee-register reconciliation.
-- Workbook rows are staged for review only; they are not posted as live receipts.

create or replace function public.is_finance_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() = 'f7c7515c-ee04-4c47-a461-7d083a0ba517'::uuid
     or exists (
       select 1 from public.user_profiles
       where id = auth.uid() and active = true and role = 'owner'
     );
$$;
revoke all on function public.is_finance_owner() from public, anon;
grant execute on function public.is_finance_owner() to authenticated;

create table if not exists public.finance_fixed_assets (
  id uuid primary key default gen_random_uuid(),
  asset_code text unique,
  asset_name text not null,
  asset_category text not null default 'Equipment',
  branch_id uuid references public.branches(id),
  batch text,
  acquisition_date date not null default current_date,
  supplier text,
  purchase_cost numeric(14,2) not null check (purchase_cost >= 0),
  amount_paid numeric(14,2) not null default 0 check (amount_paid >= 0),
  payment_due_date date,
  residual_value numeric(14,2) not null default 0 check (residual_value >= 0),
  useful_life_months integer check (useful_life_months is null or useful_life_months > 0),
  depreciation_method text not null default 'straight_line' check (depreciation_method in ('straight_line','none','manual')),
  accumulated_depreciation numeric(14,2) not null default 0 check (accumulated_depreciation >= 0),
  disposed_date date,
  disposal_proceeds numeric(14,2) not null default 0 check (disposal_proceeds >= 0),
  payment_status text not null default 'unpaid' check (payment_status in ('paid','part_paid','unpaid','financed')),
  cash_bank text check (cash_bank is null or cash_bank in ('Cash','Bank')),
  payment_mode text,
  reference_number text,
  notes text,
  created_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (residual_value <= purchase_cost)
);
alter table public.finance_fixed_assets add column if not exists amount_paid numeric(14,2) not null default 0;
alter table public.finance_fixed_assets add column if not exists payment_due_date date;
alter table public.finance_fixed_assets drop constraint if exists finance_fixed_assets_amount_paid_lte_cost;
alter table public.finance_fixed_assets add constraint finance_fixed_assets_amount_paid_lte_cost check (amount_paid <= purchase_cost);
alter table public.finance_fixed_assets enable row level security;
drop policy if exists finance_fixed_assets_owner_all on public.finance_fixed_assets;
create policy finance_fixed_assets_owner_all on public.finance_fixed_assets
for all to authenticated using ((select public.is_finance_owner()))
with check ((select public.is_finance_owner()));
grant select, insert, update, delete on public.finance_fixed_assets to authenticated;

create table if not exists public.finance_liabilities (
  id uuid primary key default gen_random_uuid(),
  liability_code text unique,
  liability_name text not null,
  liability_type text not null default 'Other Liability' check (liability_type in ('Bank Loan','Property Loan','Vehicle Loan','Supplier Payable','Salary Payable','Tax Payable','Advance from Customer','Owner Loan','Other Liability')),
  party_name text,
  branch_id uuid references public.branches(id),
  initial_amount numeric(14,2) not null check (initial_amount >= 0),
  outstanding_amount numeric(14,2) not null check (outstanding_amount >= 0),
  interest_rate numeric(7,3) check (interest_rate is null or interest_rate >= 0),
  fixed_variable text not null default 'Fixed' check (fixed_variable in ('Fixed','Variable')),
  start_date date not null default current_date,
  due_date date,
  next_payment_date date,
  payment_frequency text,
  status text not null default 'active' check (status in ('active','settled','on_hold')),
  notes text,
  created_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.finance_liabilities enable row level security;
drop policy if exists finance_liabilities_owner_all on public.finance_liabilities;
create policy finance_liabilities_owner_all on public.finance_liabilities
for all to authenticated using ((select public.is_finance_owner()))
with check ((select public.is_finance_owner()));
grant select, insert, update, delete on public.finance_liabilities to authenticated;

create table if not exists public.finance_liability_transactions (
  id uuid primary key default gen_random_uuid(),
  liability_id uuid not null references public.finance_liabilities(id) on delete restrict,
  transaction_date date not null default current_date,
  transaction_type text not null check (transaction_type in ('borrowed','repayment','interest','adjustment')),
  amount numeric(14,2) not null check (amount > 0),
  payment_mode text,
  cash_bank text check (cash_bank is null or cash_bank in ('Cash','Bank')),
  reference_number text,
  notes text,
  created_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now()
);
alter table public.finance_liability_transactions enable row level security;
drop policy if exists finance_liability_transactions_owner_all on public.finance_liability_transactions;
create policy finance_liability_transactions_owner_all on public.finance_liability_transactions
for all to authenticated using ((select public.is_finance_owner()))
with check ((select public.is_finance_owner()));
grant select, insert, update, delete on public.finance_liability_transactions to authenticated;

create or replace function public.apply_finance_liability_transaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_finance_owner() then
    raise exception 'Owner access required for liability transactions' using errcode = '42501';
  end if;
  if new.transaction_type = 'borrowed' then
    update public.finance_liabilities
       set initial_amount = initial_amount + new.amount,
           outstanding_amount = outstanding_amount + new.amount,
           status = 'active', updated_at = now()
     where id = new.liability_id;
  elsif new.transaction_type = 'repayment' then
    update public.finance_liabilities
       set outstanding_amount = greatest(0, outstanding_amount - new.amount),
           status = case when outstanding_amount <= new.amount then 'settled' else 'active' end,
           updated_at = now()
     where id = new.liability_id;
  elsif new.transaction_type = 'interest' then
    update public.finance_liabilities
       set outstanding_amount = outstanding_amount + new.amount,
           status = 'active', updated_at = now()
     where id = new.liability_id;
  elsif new.transaction_type = 'adjustment' then
    update public.finance_liabilities
       set outstanding_amount = greatest(0, outstanding_amount + new.amount),
           updated_at = now()
     where id = new.liability_id;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_apply_finance_liability_transaction on public.finance_liability_transactions;
create trigger trg_apply_finance_liability_transaction
after insert on public.finance_liability_transactions
for each row execute function public.apply_finance_liability_transaction();
revoke all on function public.apply_finance_liability_transaction() from public, anon, authenticated;

create table if not exists public.finance_fee_import_staging (
  id uuid primary key default gen_random_uuid(),
  source_file text not null default 'Ramanujan_Academy_Finance_Management_Systemnew.xlsm',
  source_sheet text not null default 'Fees Register',
  source_row integer not null,
  source_receipt_id text,
  payment_date date,
  source_student_id text,
  student_name text,
  student_class text,
  program text,
  academic_year text,
  fee_type text,
  amount_billed numeric(14,2),
  amount_collected numeric(14,2),
  due_date date,
  payment_mode text,
  remarks text,
  anomalies jsonb not null default '[]'::jsonb,
  review_status text not null default 'needs_review' check (review_status in ('needs_review','matched','approved','imported','skipped')),
  matched_student_id uuid references public.students(id),
  review_notes text,
  reviewed_by uuid references public.user_profiles(id),
  reviewed_at timestamptz,
  imported_at timestamptz,
  created_at timestamptz not null default now(),
  unique (source_file, source_sheet, source_row)
);
alter table public.finance_fee_import_staging enable row level security;
drop policy if exists finance_fee_import_staging_owner_all on public.finance_fee_import_staging;
create policy finance_fee_import_staging_owner_all on public.finance_fee_import_staging
for all to authenticated using ((select public.is_finance_owner()))
with check ((select public.is_finance_owner()));
grant select, insert, update, delete on public.finance_fee_import_staging to authenticated;

alter table public.finance_expenses
  add column if not exists cash_paid boolean not null default true,
  add column if not exists expense_type text not null default 'Operating';
alter table public.finance_expenses enable row level security;
drop policy if exists "Admins manage finance expenses" on public.finance_expenses;
drop policy if exists finance_expenses_owner_all on public.finance_expenses;
create policy finance_expenses_owner_all on public.finance_expenses
for all to authenticated using ((select public.is_finance_owner()))
with check ((select public.is_finance_owner()));

alter table public.finance_opening_balances enable row level security;
drop policy if exists "Admins manage finance opening balances" on public.finance_opening_balances;
drop policy if exists finance_opening_balances_owner_all on public.finance_opening_balances;
create policy finance_opening_balances_owner_all on public.finance_opening_balances
for all to authenticated using ((select public.is_finance_owner()))
with check ((select public.is_finance_owner()));

alter table public.finance_other_income enable row level security;
drop policy if exists finance_other_income_admin_select on public.finance_other_income;
drop policy if exists finance_other_income_admin_insert on public.finance_other_income;
drop policy if exists finance_other_income_admin_update on public.finance_other_income;
drop policy if exists finance_other_income_admin_delete on public.finance_other_income;
drop policy if exists finance_other_income_owner_all on public.finance_other_income;
create policy finance_other_income_owner_all on public.finance_other_income
for all to authenticated using ((select public.is_finance_owner()))
with check ((select public.is_finance_owner()));

create index if not exists finance_fixed_assets_acquisition_date_idx on public.finance_fixed_assets(acquisition_date);
create index if not exists finance_liabilities_due_date_idx on public.finance_liabilities(due_date, next_payment_date);
create index if not exists finance_fee_import_review_status_idx on public.finance_fee_import_staging(review_status, source_row);


-- Monthly cash-flow MIS must exclude non-cash depreciation/accrual entries.
create or replace view public.finance_monthly_mis
with (security_invoker = true) as
with months as (
  select generate_series(
    date_trunc('month', least(
      coalesce((select min(fp.payment_date) from public.fee_payments fp), current_date),
      coalesce((select min(fe.expense_date) from public.finance_expenses fe where coalesce(fe.cash_paid,true)=true), current_date)
    )::timestamp with time zone),
    date_trunc('month', current_date::timestamp with time zone),
    '1 mon'::interval
  )::date as report_month
),
collections as (
  select date_trunc('month', fp.payment_date::timestamp with time zone)::date as report_month,
         sum(fp.amount) as collected
  from public.fee_payments fp
  group by date_trunc('month', fp.payment_date::timestamp with time zone)::date
),
expenses as (
  select date_trunc('month', fe.expense_date::timestamp with time zone)::date as report_month,
         sum(fe.total_amount) as expenses
  from public.finance_expenses fe
  where coalesce(fe.cash_paid,true)=true
  group by date_trunc('month', fe.expense_date::timestamp with time zone)::date
)
select m.report_month,
       coalesce(c.collected,0::numeric) as collections,
       coalesce(e.expenses,0::numeric) as expenses,
       coalesce(c.collected,0::numeric)-coalesce(e.expenses,0::numeric) as cash_surplus
from months m
left join collections c using (report_month)
left join expenses e using (report_month)
order by m.report_month;
