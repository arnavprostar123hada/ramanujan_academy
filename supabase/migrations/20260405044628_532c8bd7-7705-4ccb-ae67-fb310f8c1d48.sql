
CREATE TABLE public.ra_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  points integer NOT NULL DEFAULT 100,
  last_reset timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX ra_points_student_id_idx ON public.ra_points(student_id);

ALTER TABLE public.ra_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read ra_points" ON public.ra_points FOR SELECT USING (true);
CREATE POLICY "Anyone can insert ra_points" ON public.ra_points FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update ra_points" ON public.ra_points FOR UPDATE USING (true);
