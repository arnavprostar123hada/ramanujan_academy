
-- Add student_type column to students table
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS student_type TEXT NOT NULL DEFAULT 'offline';

-- Create online_students table for external students who signup with email/password
CREATE TABLE public.online_students (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  class TEXT NOT NULL DEFAULT '10th',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id),
  UNIQUE(email)
);

-- Create zoom_links table for managing class schedules
CREATE TABLE public.zoom_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  class TEXT NOT NULL,
  subject TEXT NOT NULL,
  zoom_url TEXT NOT NULL,
  meeting_id TEXT,
  passcode TEXT,
  schedule_day TEXT NOT NULL,
  schedule_time TEXT NOT NULL,
  teacher_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.online_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zoom_links ENABLE ROW LEVEL SECURITY;

-- RLS for online_students: users can read their own record
CREATE POLICY "Users can view own online student profile" ON public.online_students
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can update own online student profile" ON public.online_students
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- Admins can manage online_students
CREATE POLICY "Admins can manage online students" ON public.online_students
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS for zoom_links: anyone authenticated can view active links
CREATE POLICY "Authenticated users can view active zoom links" ON public.zoom_links
  FOR SELECT TO authenticated USING (is_active = true);

-- Admins can manage zoom_links
CREATE POLICY "Admins can manage zoom links" ON public.zoom_links
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Also allow anon to view zoom links (for parent portal)
CREATE POLICY "Anyone can view active zoom links" ON public.zoom_links
  FOR SELECT TO anon USING (is_active = true);

-- Create RA points entry for online students automatically
CREATE OR REPLACE FUNCTION public.create_online_student_ra_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.ra_points (student_id, points, last_reset)
  VALUES (NEW.id::text, 20, now()::text)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_online_student_created
  AFTER INSERT ON public.online_students
  FOR EACH ROW
  EXECUTE FUNCTION public.create_online_student_ra_points();
