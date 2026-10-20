-- Finance workspace: instalment schedules, other income, batch reporting and student ledger.
-- Applied to the connected Supabase project; kept here for repository history and repeatable environments.

alter table public.finance_expenses
  add column if not exists batch text,
  add column if not exists branch_id uuid references public.branches(id);

create table if not exists public.finance_other_income (
  id uuid primary key default gen_random_uuid(),
  income_date date not null default current_date,
  source text not null,
  category text not null default 'Other Income',
  description text,
  amount numeric(12,2) not null check (amount > 0),
  payment_mode text,
  cash_bank text not null default 'Bank' check (cash_bank in ('Cash','Bank')),
  branch_id uuid references public.branches(id),
  batch text,
  reference_number text,
  notes text,
  created_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now()
);
alter table public.finance_other_income enable row level security;
drop policy if exists "finance_other_income_admin_select" on public.finance_other_income;
create policy "finance_other_income_admin_select" on public.finance_other_income
  for select to authenticated using ((select public.is_admin_or_owner()));
drop policy if exists "finance_other_income_admin_insert" on public.finance_other_income;
create policy "finance_other_income_admin_insert" on public.finance_other_income
  for insert to authenticated with check ((select public.is_admin_or_owner()));
drop policy if exists "finance_other_income_admin_update" on public.finance_other_income;
create policy "finance_other_income_admin_update" on public.finance_other_income
  for update to authenticated using ((select public.is_admin_or_owner())) with check ((select public.is_admin_or_owner()));
drop policy if exists "finance_other_income_admin_delete" on public.finance_other_income;
create policy "finance_other_income_admin_delete" on public.finance_other_income
  for delete to authenticated using ((select public.is_admin_or_owner()));
grant select, insert, update, delete on public.finance_other_income to authenticated;

create index if not exists fee_installments_due_date_idx on public.fee_installments(due_date);
create index if not exists fee_installments_account_due_idx on public.fee_installments(fee_account_id, due_date);
create index if not exists finance_expenses_date_batch_idx on public.finance_expenses(expense_date, batch);
create index if not exists finance_other_income_date_batch_idx on public.finance_other_income(income_date, batch);

create or replace function public.create_fee_installment_schedule(
  p_fee_account_id uuid,
  p_installment_count integer,
  p_first_due_date date,
  p_interval_months integer default 1
) returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_account public.fee_accounts%rowtype;
  v_existing integer;
  v_i integer;
  v_base numeric(12,2);
  v_amount numeric(12,2);
  v_total numeric(12,2) := 0;
  v_paid numeric(12,2) := 0;
  v_remaining numeric(12,2) := 0;
begin
  if v_actor is null or not public.is_admin_or_owner() then
    raise exception 'Only an authenticated owner/admin may create an instalment schedule' using errcode = '42501';
  end if;
  if p_installment_count < 1 or p_installment_count > 24 then
    raise exception 'Instalment count must be between 1 and 24' using errcode = '22023';
  end if;
  if p_first_due_date is null or p_interval_months < 1 or p_interval_months > 12 then
    raise exception 'Enter a valid first due date and interval' using errcode = '22023';
  end if;
  select * into v_account from public.fee_accounts where id = p_fee_account_id for update;
  if not found then raise exception 'Fee account not found' using errcode = 'P0002'; end if;
  select count(*) into v_existing from public.fee_installments where fee_account_id = p_fee_account_id;
  if v_existing > 0 then
    raise exception 'An instalment schedule already exists. Do not create a duplicate schedule' using errcode = '23505';
  end if;
  select coalesce(sum(amount), 0) into v_paid from public.fee_payments where fee_account_id = p_fee_account_id;
  v_remaining := greatest(0, v_account.net_fee - v_paid);
  if v_remaining <= 0 then
    raise exception 'No outstanding balance remains to schedule' using errcode = '22023';
  end if;
  v_base := floor((v_remaining / p_installment_count) * 100) / 100;
  for v_i in 1..p_installment_count loop
    if v_i = p_installment_count then
      v_amount := round(v_remaining - v_total, 2);
    else
      v_amount := v_base;
    end if;
    insert into public.fee_installments(fee_account_id, due_date, amount, paid_amount, status)
    values (p_fee_account_id, (p_first_due_date + make_interval(months => (v_i - 1) * p_interval_months))::date, v_amount, 0, 'pending');
    v_total := v_total + v_amount;
  end loop;
  return jsonb_build_object('success', true, 'fee_account_id', p_fee_account_id, 'installments_created', p_installment_count, 'scheduled_amount', v_total, 'already_collected', v_paid, 'outstanding_scheduled', v_remaining);
end;
$$;
revoke all on function public.create_fee_installment_schedule(uuid, integer, date, integer) from public, anon;
grant execute on function public.create_fee_installment_schedule(uuid, integer, date, integer) to authenticated;

create or replace function public.allocate_fee_payment_to_installments()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_remaining numeric(12,2) := new.amount;
  v_row record;
  v_due numeric(12,2);
  v_apply numeric(12,2);
begin
  for v_row in
    select id, amount, paid_amount
    from public.fee_installments
    where fee_account_id = new.fee_account_id and paid_amount < amount
    order by due_date asc, created_at asc, id asc
    for update
  loop
    exit when v_remaining <= 0;
    v_due := greatest(0, v_row.amount - v_row.paid_amount);
    v_apply := least(v_remaining, v_due);
    update public.fee_installments
    set paid_amount = paid_amount + v_apply,
        status = case
          when paid_amount + v_apply >= amount then 'paid'
          when paid_amount + v_apply > 0 then 'partial'
          else 'pending'
        end,
        updated_at = now()
    where id = v_row.id;
    v_remaining := v_remaining - v_apply;
  end loop;
  return new;
end;
$$;
revoke all on function public.allocate_fee_payment_to_installments() from public, anon, authenticated;
drop trigger if exists trg_allocate_fee_payment_to_installments on public.fee_payments;
create trigger trg_allocate_fee_payment_to_installments
after insert on public.fee_payments
for each row execute function public.allocate_fee_payment_to_installments();

-- Finance data is sensitive: do not leave instalment rows readable to every signed-in user.
drop policy if exists "authenticated_all" on public.fee_installments;
drop policy if exists "owner_admin_manage_fee_installments" on public.fee_installments;
create policy "owner_admin_manage_fee_installments" on public.fee_installments
for all to authenticated
using ((select public.is_admin_or_owner()))
with check ((select public.is_admin_or_owner()));

create or replace view public.finance_student_ledger
with (security_invoker = true) as
select
  s.id as student_id, s.name as student_name, s.class, s.board, s.batch, s.branch_id, s.academic_year,
  fa.id as fee_account_id,
  coalesce(fa.total_fee, 0) as total_fee,
  coalesce(fa.scholarship, 0) as scholarship,
  coalesce(fa.discount, 0) as discount,
  coalesce(fa.net_fee, 0) as net_fee,
  coalesce(pay.paid, 0) as paid,
  greatest(0, coalesce(fa.net_fee, 0) - coalesce(pay.paid, 0)) as pending,
  nxt.due_date as next_instalment_due_date,
  greatest(0, coalesce(nxt.amount, 0) - coalesce(nxt.paid_amount, 0)) as next_instalment_amount
from public.students s
left join lateral (
  select fa0.* from public.fee_accounts fa0
  where fa0.student_id = s.id order by fa0.created_at desc limit 1
) fa on true
left join lateral (
  select sum(fp.amount) as paid from public.fee_payments fp where fp.fee_account_id = fa.id
) pay on true
left join lateral (
  select fi.due_date, fi.amount, fi.paid_amount from public.fee_installments fi
  where fi.fee_account_id = fa.id and fi.paid_amount < fi.amount
  order by fi.due_date asc, fi.created_at asc limit 1
) nxt on true
where s.status = 'active';
grant select on public.finance_student_ledger to authenticated;
