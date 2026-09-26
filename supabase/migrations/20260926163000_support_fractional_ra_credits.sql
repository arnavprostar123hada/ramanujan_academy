-- RA Credits are usage-metered, so fractional credits must be preserved.
alter table public.ra_points
  alter column points type numeric(10,2)
  using points::numeric;

update public.ra_points
set points = round(points, 2);
