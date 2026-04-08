
-- Add INSERT policy for online_students so authenticated users can create their own profile
CREATE POLICY "Users can insert own online student profile"
ON public.online_students
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Create student_attendance table
CREATE TABLE public.student_attendance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL,
  attendance_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'present',
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(student_id, attendance_date)
);

ALTER TABLE public.student_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage student attendance"
ON public.student_attendance
FOR ALL
TO public
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can read student attendance"
ON public.student_attendance
FOR SELECT
TO public
USING (true);

-- Create trigger for auto-creating RA points for online students
CREATE OR REPLACE TRIGGER create_online_student_ra_points_trigger
AFTER INSERT ON public.online_students
FOR EACH ROW
EXECUTE FUNCTION public.create_online_student_ra_points();
