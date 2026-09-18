-- Geofence configuration (single campus row, extensible to multiple sites)
CREATE TABLE public.geofence_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Academy',
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  radius_meters integer NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.geofence_locations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.geofence_locations TO authenticated;
GRANT ALL ON public.geofence_locations TO service_role;

ALTER TABLE public.geofence_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view geofence locations"
  ON public.geofence_locations FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage geofence locations"
  ON public.geofence_locations FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_geofence_locations_updated_at
  BEFORE UPDATE ON public.geofence_locations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Geo metadata on teacher attendance
ALTER TABLE public.teacher_attendance
  ADD COLUMN IF NOT EXISTS check_in_lat double precision,
  ADD COLUMN IF NOT EXISTS check_in_lng double precision,
  ADD COLUMN IF NOT EXISTS check_out_lat double precision,
  ADD COLUMN IF NOT EXISTS check_out_lng double precision,
  ADD COLUMN IF NOT EXISTS check_in_distance_m double precision,
  ADD COLUMN IF NOT EXISTS check_out_distance_m double precision,
  ADD COLUMN IF NOT EXISTS check_in_method text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS geo_verified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS worked_minutes integer;

-- Unique attendance per teacher per day so auto check-in can upsert safely
CREATE UNIQUE INDEX IF NOT EXISTS teacher_attendance_teacher_date_idx
  ON public.teacher_attendance (teacher_id, attendance_date);