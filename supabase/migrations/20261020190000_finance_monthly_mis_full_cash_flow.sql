-- Full owner monthly cash movement: fees + other income + borrowing - cash expenses - asset payments - repayments.
-- Preserve the existing first four view columns so CREATE OR REPLACE remains compatible.
create or replace view public.finance_monthly_mis
with (security_invoker = true) as
with first_dates as (
  select
    coalesce((select min(fp.payment_date) from public.fee_payments fp), current_date) as fees_start,
    coalesce((select min(fe.expense_date) from public.finance_expenses fe where coalesce(fe.cash_paid,true)=true), current_date) as expense_start,
    coalesce((select min(oi.income_date) from public.finance_other_income oi), current_date) as income_start,
    coalesce((select min(a.acquisition_date) from public.finance_fixed_assets a where coalesce(a.payment_mode,'') not in ('Loan','Non-cash') and a.amount_paid > 0), current_date) as assets_start,
    coalesce((select min(t.transaction_date) from public.finance_liability_transactions t where t.transaction_type in ('borrowed','repayment') and coalesce(t.payment_mode,'') <> 'Non-cash'), current_date) as liability_start
),
months as (
  select generate_series(
    date_trunc('month', least(fees_start,expense_start,income_start,assets_start,liability_start)::timestamp with time zone),
    date_trunc('month', current_date::timestamp with time zone),
    '1 mon'::interval
  )::date as report_month
  from first_dates
),
collections as (
  select date_trunc('month',fp.payment_date::timestamp with time zone)::date as report_month, sum(fp.amount) as collections
  from public.fee_payments fp group by 1
),
other_income as (
  select date_trunc('month',oi.income_date::timestamp with time zone)::date as report_month, sum(oi.amount) as other_income
  from public.finance_other_income oi group by 1
),
expenses as (
  select date_trunc('month',fe.expense_date::timestamp with time zone)::date as report_month, sum(coalesce(fe.total_amount,fe.amount)) as expenses
  from public.finance_expenses fe where coalesce(fe.cash_paid,true)=true group by 1
),
asset_payments as (
  select date_trunc('month',a.acquisition_date::timestamp with time zone)::date as report_month, sum(a.amount_paid) as asset_purchases
  from public.finance_fixed_assets a where coalesce(a.payment_mode,'') not in ('Loan','Non-cash') group by 1
),
borrowings as (
  select date_trunc('month',t.transaction_date::timestamp with time zone)::date as report_month, sum(t.amount) as borrowings
  from public.finance_liability_transactions t where t.transaction_type='borrowed' and coalesce(t.payment_mode,'') <> 'Non-cash' group by 1
),
repayments as (
  select date_trunc('month',t.transaction_date::timestamp with time zone)::date as report_month, sum(t.amount) as repayments
  from public.finance_liability_transactions t where t.transaction_type='repayment' and coalesce(t.payment_mode,'') <> 'Non-cash' group by 1
)
select m.report_month,
       coalesce(c.collections,0::numeric) as collections,
       coalesce(e.expenses,0::numeric) as expenses,
       coalesce(c.collections,0::numeric)+coalesce(oi.other_income,0::numeric)+coalesce(b.borrowings,0::numeric)
        -coalesce(e.expenses,0::numeric)-coalesce(ap.asset_purchases,0::numeric)-coalesce(r.repayments,0::numeric) as cash_surplus,
       coalesce(oi.other_income,0::numeric) as other_income,
       coalesce(ap.asset_purchases,0::numeric) as asset_purchases,
       coalesce(b.borrowings,0::numeric) as borrowings,
       coalesce(r.repayments,0::numeric) as repayments
from months m
left join collections c using(report_month)
left join other_income oi using(report_month)
left join expenses e using(report_month)
left join asset_payments ap using(report_month)
left join borrowings b using(report_month)
left join repayments r using(report_month)
order by m.report_month;
