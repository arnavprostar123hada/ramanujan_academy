-- Preserve the next instalment due date on the receipt record so reprints stay historically consistent.
alter table public.fee_payments
  add column if not exists next_installment_due_date date;

create or replace function public.snapshot_fee_payment_next_installment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next_due date;
begin
  select fi.due_date into v_next_due
  from public.fee_installments fi
  where fi.fee_account_id = new.fee_account_id
    and fi.paid_amount < fi.amount
  order by fi.due_date asc, fi.created_at asc, fi.id asc
  limit 1;

  update public.fee_payments
  set next_installment_due_date = v_next_due
  where id = new.id;
  return new;
end;
$$;
revoke all on function public.snapshot_fee_payment_next_installment() from public, anon, authenticated;
drop trigger if exists trg_z_snapshot_fee_next_installment on public.fee_payments;
create trigger trg_z_snapshot_fee_next_installment
after insert on public.fee_payments
for each row execute function public.snapshot_fee_payment_next_installment();

create or replace view public.finance_receipt_register
with (security_invoker = true) as
select
  fp.id as payment_id,
  fp.receipt_number,
  fp.payment_date,
  fp.amount,
  fp.payment_mode,
  fp.reference_number,
  fp.fee_type,
  fp.cash_bank,
  fp.notes,
  fp.branch_id,
  fa.student_id,
  s.name as student_name,
  s.class,
  s.board,
  s.academic_year,
  fa.total_fee,
  fa.scholarship,
  fa.discount,
  fa.net_fee,
  fp.next_installment_due_date
from public.fee_payments fp
join public.fee_accounts fa on fa.id = fp.fee_account_id
join public.students s on s.id = fa.student_id;

grant select on public.finance_receipt_register to authenticated;
