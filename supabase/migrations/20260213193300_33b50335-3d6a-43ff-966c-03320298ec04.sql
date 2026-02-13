
-- Add monthly salary to teachers
ALTER TABLE public.teachers ADD COLUMN monthly_salary numeric DEFAULT 0;

-- Teacher attendance tracking
CREATE TABLE public.teacher_attendance (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  attendance_date date NOT NULL,
  status text NOT NULL DEFAULT 'present', -- present, absent, half_day
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(teacher_id, attendance_date)
);

ALTER TABLE public.teacher_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage teacher attendance" ON public.teacher_attendance
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can read teacher attendance" ON public.teacher_attendance
  FOR SELECT USING (true);

-- Teacher salary records (monthly payroll)
CREATE TABLE public.teacher_salary_records (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  month text NOT NULL,
  year integer NOT NULL,
  total_days integer NOT NULL DEFAULT 0,
  days_present integer NOT NULL DEFAULT 0,
  half_days integer NOT NULL DEFAULT 0,
  days_absent integer NOT NULL DEFAULT 0,
  base_salary numeric NOT NULL DEFAULT 0,
  calculated_salary numeric NOT NULL DEFAULT 0,
  deductions numeric NOT NULL DEFAULT 0,
  bonus numeric NOT NULL DEFAULT 0,
  final_salary numeric NOT NULL DEFAULT 0,
  notes text,
  paid_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(teacher_id, month, year)
);

ALTER TABLE public.teacher_salary_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage salary records" ON public.teacher_salary_records
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
