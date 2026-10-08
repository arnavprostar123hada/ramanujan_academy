-- Monthly RA Credits policy, reset audit trail and automatic reset.
-- Academy month boundary: Asia/Kolkata. Database itself remains UTC.

create table if not exists public.ra_points_settings (
  id integer primary key default 1 check (id = 1),
  regular_monthly_allowance numeric(10,2) not null default 100,
  online_monthly_allowance numeric(10,2) not null default 20,
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id) on delete set null,
  constraint ra_points_settings_positive check (
    regular_monthly_allowance > 0 and regular_monthly_allowance <= 1000
    and online_monthly_allowance > 0 and online_monthly_allowance <= 1000
  )
);

insert into public.ra_points_settings(id, regular_monthly_allowance, online_monthly_allowance)
values (1, 100, 20)
on conflict (id) do nothing;

alter table public.ra_points_settings enable row level security;
revoke all on public.ra_points_settings from anon, authenticated;
drop policy if exists "Admins can manage RA points settings" on public.ra_points_settings;
create policy "Admins can manage RA points settings"
on public.ra_points_settings for all to authenticated
using ((select public.is_admin_or_owner()))
with check ((select public.is_admin_or_owner()));

create table if not exists public.ra_points_reset_history (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  reset_month date not null,
  points_before numeric(10,2) not null,
  monthly_allowance numeric(10,2) not null,
  reset_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(student_id, reset_month)
);

create index if not exists idx_ra_points_reset_history_student_month
on public.ra_points_reset_history(student_id, reset_month desc);

alter table public.ra_points_reset_history enable row level security;
revoke all on public.ra_points_reset_history from anon, authenticated;
drop policy if exists "Admins can view RA points reset history" on public.ra_points_reset_history;
create policy "Admins can view RA points reset history"
on public.ra_points_reset_history for select to authenticated
using ((select public.is_admin_or_owner()));

create or replace function public.get_ra_points_allowances()
returns table(regular_monthly_allowance numeric, online_monthly_allowance numeric)
language sql
security definer
set search_path = ''
as $$
  select s.regular_monthly_allowance, s.online_monthly_allowance
  from public.ra_points_settings s
  where s.id = 1;
$$;

revoke all on function public.get_ra_points_allowances() from public, anon;
grant execute on function public.get_ra_points_allowances() to authenticated;

create or replace function public.update_ra_points_allowances(
  p_regular_monthly_allowance numeric,
  p_online_monthly_allowance numeric
)
returns table(ok boolean, regular_monthly_allowance numeric, online_monthly_allowance numeric)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.is_admin_or_owner()) then
    return query select false, null::numeric, null::numeric;
    return;
  end if;

  if p_regular_monthly_allowance is null
     or p_online_monthly_allowance is null
     or p_regular_monthly_allowance <= 0
     or p_online_monthly_allowance <= 0
     or p_regular_monthly_allowance > 1000
     or p_online_monthly_allowance > 1000 then
    return query select false, null::numeric, null::numeric;
    return;
  end if;

  update public.ra_points_settings
  set regular_monthly_allowance = round(p_regular_monthly_allowance, 2),
      online_monthly_allowance = round(p_online_monthly_allowance, 2),
      updated_at = now(),
      updated_by = auth.uid()
  where id = 1;

  return query
    select true, s.regular_monthly_allowance, s.online_monthly_allowance
    from public.ra_points_settings s
    where s.id = 1;
end;
$$;

revoke all on function public.update_ra_points_allowances(numeric, numeric) from public, anon;
grant execute on function public.update_ra_points_allowances(numeric, numeric) to authenticated;

create or replace function public.reset_monthly_ra_points()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  reset_count integer := 0;
  current_month date := date_trunc('month', timezone('Asia/Kolkata', now()))::date;
  regular_allowance numeric;
  online_allowance numeric;
  r record;
  allowance numeric;
begin
  select s.regular_monthly_allowance, s.online_monthly_allowance
  into regular_allowance, online_allowance
  from public.ra_points_settings s
  where s.id = 1;

  regular_allowance := coalesce(regular_allowance, 100);
  online_allowance := coalesce(online_allowance, 20);

  for r in
    select rp.student_id, rp.points, rp.last_reset
    from public.ra_points rp
    where date_trunc('month', timezone('Asia/Kolkata', rp.last_reset))::date < current_month
    for update
  loop
    select case when exists (
      select 1 from public.online_students o where o.student_id = r.student_id
    ) then online_allowance else regular_allowance end into allowance;

    insert into public.ra_points_reset_history(
      student_id, reset_month, points_before, monthly_allowance, reset_at
    )
    values (r.student_id, current_month, r.points, allowance, now())
    on conflict (student_id, reset_month) do nothing;

    update public.ra_points
    set points = allowance, last_reset = now(), updated_at = now()
    where student_id = r.student_id
      and date_trunc('month', timezone('Asia/Kolkata', last_reset))::date < current_month;

    if found then reset_count := reset_count + 1; end if;
  end loop;

  return reset_count;
end;
$$;

revoke all on function public.reset_monthly_ra_points() from public, anon, authenticated;
grant execute on function public.reset_monthly_ra_points() to service_role;

create or replace function public.get_student_ra_points(p_student_id uuid)
returns table(points numeric, last_reset timestamptz, monthly_allowance numeric, next_reset timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  online boolean;
  regular_allowance numeric;
  online_allowance numeric;
  current_points numeric;
  current_last_reset timestamptz;
  allowance numeric;
  current_month date := date_trunc('month', timezone('Asia/Kolkata', now()))::date;
begin
  if p_student_id is null then return; end if;

  if not exists (
    select 1 from public.online_students o
    where o.student_id = p_student_id and o.user_id = auth.uid()
  ) then
    return;
  end if;

  select exists (
    select 1 from public.online_students o where o.student_id = p_student_id
  ) into online;

  select s.regular_monthly_allowance, s.online_monthly_allowance
  into regular_allowance, online_allowance
  from public.ra_points_settings s where s.id = 1;

  regular_allowance := coalesce(regular_allowance, 100);
  online_allowance := coalesce(online_allowance, 20);
  allowance := case when online then online_allowance else regular_allowance end;

  select rp.points, rp.last_reset
  into current_points, current_last_reset
  from public.ra_points rp
  where rp.student_id = p_student_id
  for update;

  if not found then
    current_points := allowance;
    current_last_reset := now();
    insert into public.ra_points(student_id, points, last_reset, updated_at)
    values (p_student_id, current_points, current_last_reset, now())
    on conflict (student_id) do nothing;
  elsif date_trunc('month', timezone('Asia/Kolkata', current_last_reset))::date < current_month then
    insert into public.ra_points_reset_history(
      student_id, reset_month, points_before, monthly_allowance, reset_at
    )
    values (p_student_id, current_month, current_points, allowance, now())
    on conflict (student_id, reset_month) do nothing;

    update public.ra_points
    set points = allowance, last_reset = now(), updated_at = now()
    where student_id = p_student_id;

    current_points := allowance;
    current_last_reset := now();
  end if;

  return query
  select current_points,
         current_last_reset,
         allowance,
         (date_trunc('month', timezone('Asia/Kolkata', now())) + interval '1 month') at time zone 'Asia/Kolkata';
end;
$$;

revoke all on function public.get_student_ra_points(uuid) from public, anon;
grant execute on function public.get_student_ra_points(uuid) to authenticated;

select public.reset_monthly_ra_points();

select cron.unschedule(jobid)
from cron.job
where jobname = 'ra-points-monthly-reset';

select cron.schedule(
  'ra-points-monthly-reset',
  '35 18 1 * *',
  'select public.reset_monthly_ra_points();'
);
