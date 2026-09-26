create table if not exists public.geofence_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Academy',
  latitude double precision not null,
  longitude double precision not null,
  radius_meters integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint geofence_locations_radius_positive check (radius_meters > 0),
  constraint geofence_locations_latitude_valid check (latitude between -90 and 90),
  constraint geofence_locations_longitude_valid check (longitude between -180 and 180)
);

create unique index if not exists geofence_locations_one_active_idx
  on public.geofence_locations (is_active)
  where is_active = true;

alter table public.teacher_attendance
  add column if not exists check_in_lat double precision,
  add column if not exists check_in_lng double precision,
  add column if not exists check_out_lat double precision,
  add column if not exists check_out_lng double precision,
  add column if not exists check_in_distance_m double precision,
  add column if not exists check_out_distance_m double precision,
  add column if not exists check_in_method text,
  add column if not exists geo_verified boolean;

alter table public.geofence_locations enable row level security;

drop policy if exists "Authenticated users can read active geofence" on public.geofence_locations;
create policy "Authenticated users can read active geofence"
on public.geofence_locations
for select
to authenticated
using (is_active = true or is_admin_or_owner());

drop policy if exists "Owners and admins manage geofence" on public.geofence_locations;
create policy "Owners and admins manage geofence"
on public.geofence_locations
for all
to authenticated
using (is_admin_or_owner())
with check (is_admin_or_owner());

create or replace function public.set_active_geofence(
  p_name text,
  p_latitude double precision,
  p_longitude double precision,
  p_radius_meters integer
)
returns public.geofence_locations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.geofence_locations;
begin
  if not is_admin_or_owner() then
    raise exception 'Not authorized';
  end if;

  if p_latitude < -90 or p_latitude > 90 then
    raise exception 'Invalid latitude';
  end if;
  if p_longitude < -180 or p_longitude > 180 then
    raise exception 'Invalid longitude';
  end if;
  if p_radius_meters <= 0 then
    raise exception 'Radius must be greater than zero';
  end if;

  update public.geofence_locations
  set is_active = false, updated_at = now()
  where is_active = true;

  insert into public.geofence_locations(name, latitude, longitude, radius_meters, is_active)
  values (coalesce(nullif(trim(p_name), ''), 'Academy'), p_latitude, p_longitude, p_radius_meters, true)
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.set_active_geofence(text,double precision,double precision,integer) from public;
grant execute on function public.set_active_geofence(text,double precision,double precision,integer) to authenticated;
