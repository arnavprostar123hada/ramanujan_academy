-- Make all student AI charging paths use the configured monthly RA Credit allowance.
-- The monthly reset itself is installed by 20261008190000_monthly_ra_credits_reset.sql.

create or replace function public.consume_student_ra_points(
  p_student_id uuid,
  p_points numeric,
  p_reason text default 'ai_usage',
  p_metadata jsonb default '{}'::jsonb
)
returns table(ok boolean, balance numeric, charged numeric)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_points numeric;
  last_reset_at timestamptz;
  allowance numeric;
  online boolean;
  charged_amount numeric;
  regular_allowance numeric;
  online_allowance numeric;
  old_points numeric;
  current_month date := date_trunc('month', timezone('Asia/Kolkata', now()))::date;
begin
  if p_student_id is null or p_points is null or p_points <= 0 or p_points > 100 then
    return query select false, 0::numeric, 0::numeric; return;
  end if;

  if not exists (
    select 1 from public.online_students o
    join public.students s on s.id = o.student_id
    where o.student_id = p_student_id and o.user_id = auth.uid()
  ) then
    return query select false, 0::numeric, 0::numeric; return;
  end if;

  select exists (select 1 from public.online_students o where o.student_id = p_student_id) into online;

  select s.regular_monthly_allowance, s.online_monthly_allowance
  into regular_allowance, online_allowance
  from public.ra_points_settings s where s.id = 1;

  allowance := case when online then coalesce(online_allowance,20) else coalesce(regular_allowance,100) end;

  select points, last_reset into current_points, last_reset_at
  from public.ra_points where student_id = p_student_id for update;

  if not found then
    current_points := allowance;
    last_reset_at := now();
    insert into public.ra_points(student_id, points, last_reset, updated_at)
    values (p_student_id, current_points, last_reset_at, now())
    on conflict (student_id) do nothing;

    select points, last_reset into current_points, last_reset_at
    from public.ra_points where student_id = p_student_id for update;
  elsif date_trunc('month', timezone('Asia/Kolkata', last_reset_at))::date < current_month then
    old_points := current_points;

    insert into public.ra_points_reset_history(
      student_id, reset_month, points_before, monthly_allowance, reset_at
    )
    values (p_student_id, current_month, old_points, allowance, now())
    on conflict (student_id, reset_month) do nothing;

    current_points := allowance;

    update public.ra_points
    set points = current_points, last_reset = now(), updated_at = now()
    where student_id = p_student_id;
  end if;

  charged_amount := round(p_points::numeric, 2);

  if current_points < charged_amount then
    return query select false, current_points, 0::numeric; return;
  end if;

  update public.ra_points
  set points = round(current_points - charged_amount, 2), updated_at = now()
  where student_id = p_student_id;

  insert into public.student_ai_usage(student_id, mode, action, credits, metadata)
  values (p_student_id, 'points', p_reason, charged_amount, p_metadata);

  return query select true, round(current_points - charged_amount, 2), charged_amount;
end;
$$;

revoke all on function public.consume_student_ra_points(uuid, numeric, text, jsonb) from public, anon;
grant execute on function public.consume_student_ra_points(uuid, numeric, text, jsonb) to authenticated;

create or replace function public.consume_student_ra_points_admin(
  p_student_id uuid,
  p_points numeric,
  p_reason text default 'ai_usage',
  p_metadata jsonb default '{}'::jsonb
)
returns table(ok boolean, balance numeric, charged numeric)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_points numeric;
  last_reset_at timestamptz;
  allowance numeric;
  online boolean;
  charged_amount numeric;
  regular_allowance numeric;
  online_allowance numeric;
  old_points numeric;
  current_month date := date_trunc('month', timezone('Asia/Kolkata', now()))::date;
begin
  if p_student_id is null or p_points is null or p_points <= 0 or p_points > 100 then
    return query select false, 0::numeric, 0::numeric; return;
  end if;

  select exists (select 1 from public.online_students o where o.student_id = p_student_id) into online;

  select s.regular_monthly_allowance, s.online_monthly_allowance
  into regular_allowance, online_allowance
  from public.ra_points_settings s where s.id = 1;

  allowance := case when online then coalesce(online_allowance,20) else coalesce(regular_allowance,100) end;

  select points, last_reset into current_points, last_reset_at
  from public.ra_points where student_id = p_student_id for update;

  if not found then
    insert into public.ra_points(student_id, points, last_reset, updated_at)
    values (p_student_id, allowance, now(), now())
    on conflict (student_id) do nothing;

    select points, last_reset into current_points, last_reset_at
    from public.ra_points where student_id = p_student_id for update;
  elsif date_trunc('month', timezone('Asia/Kolkata', last_reset_at))::date < current_month then
    old_points := current_points;

    insert into public.ra_points_reset_history(
      student_id, reset_month, points_before, monthly_allowance, reset_at
    )
    values (p_student_id, current_month, old_points, allowance, now())
    on conflict (student_id, reset_month) do nothing;

    current_points := allowance;

    update public.ra_points
    set points = current_points, last_reset = now(), updated_at = now()
    where student_id = p_student_id;
  end if;

  charged_amount := round(p_points::numeric, 2);

  if current_points < charged_amount then
    return query select false, current_points, 0::numeric; return;
  end if;

  update public.ra_points
  set points = round(current_points - charged_amount, 2), updated_at = now()
  where student_id = p_student_id;

  insert into public.student_ai_usage(student_id, mode, action, credits, metadata)
  values (p_student_id, 'points', p_reason, charged_amount, p_metadata);

  return query select true, round(current_points - charged_amount, 2), charged_amount;
end;
$$;

revoke all on function public.consume_student_ra_points_admin(uuid, numeric, text, jsonb) from public, anon, authenticated;
grant execute on function public.consume_student_ra_points_admin(uuid, numeric, text, jsonb) to service_role;
