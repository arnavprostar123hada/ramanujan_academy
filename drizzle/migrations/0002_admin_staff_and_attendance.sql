CREATE TABLE public.admin_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  is_active boolean NOT NULL DEFAULT true,
  expected_check_in time,
  expected_check_out time,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_staff TO authenticated;
GRANT ALL ON public.admin_staff TO service_role;
ALTER TABLE public.admin_staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages admin staff" ON public.admin_staff FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner')) WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Staff read self" ON public.admin_staff FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE TABLE public.admin_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_staff_id uuid NOT NULL REFERENCES public.admin_staff(id) ON DELETE CASCADE,
  attendance_date date NOT NULL,
  status text NOT NULL DEFAULT 'present',
  check_in_time time,
  check_out_time time,
  is_late boolean DEFAULT false,
  check_in_lat double precision,
  check_in_lng double precision,
  check_out_lat double precision,
  check_out_lng double precision,
  check_in_distance_m double precision,
  check_out_distance_m double precision,
  check_in_method text,
  geo_verified boolean DEFAULT false,
  worked_minutes integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (admin_staff_id, attendance_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_attendance TO authenticated;
GRANT ALL ON public.admin_attendance TO service_role;
ALTER TABLE public.admin_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages admin attendance" ON public.admin_attendance FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner')) WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Staff manage own attendance" ON public.admin_attendance FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_staff s WHERE s.id = admin_staff_id AND s.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_staff s WHERE s.id = admin_staff_id AND s.user_id = auth.uid()));

CREATE TRIGGER admin_staff_updated BEFORE UPDATE ON public.admin_staff
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Existing admins become owners (backfill)
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'owner'::public.app_role FROM public.user_roles WHERE role = 'admin'
ON CONFLICT DO NOTHING;