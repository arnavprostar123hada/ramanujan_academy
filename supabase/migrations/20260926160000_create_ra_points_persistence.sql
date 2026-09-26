-- Persist student RA Points across refreshes and sessions.
create table if not exists public.ra_points (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null,
  points integer not null default 100,
  last_reset timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ra_points_student_id_idx
  on public.ra_points(student_id);

alter table public.ra_points enable row level security;

drop policy if exists "Anyone can read ra_points" on public.ra_points;
drop policy if exists "Anyone can insert ra_points" on public.ra_points;
drop policy if exists "Anyone can update ra_points" on public.ra_points;

create policy "Anyone can read ra_points"
  on public.ra_points for select using (true);

create policy "Anyone can insert ra_points"
  on public.ra_points for insert with check (true);

create policy "Anyone can update ra_points"
  on public.ra_points for update using (true) with check (true);

grant select, insert, update on public.ra_points to anon, authenticated;
