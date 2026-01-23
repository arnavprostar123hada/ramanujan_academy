-- Add unique access code to students table for parent login
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS access_code TEXT UNIQUE;

-- Create function to generate unique access code
CREATE OR REPLACE FUNCTION generate_student_access_code()
RETURNS TRIGGER AS $$
BEGIN
  NEW.access_code := UPPER(SUBSTR(MD5(RANDOM()::TEXT), 1, 8));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger to auto-generate access code on student insert
CREATE TRIGGER set_student_access_code
  BEFORE INSERT ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION generate_student_access_code();

-- Update existing students with access codes
UPDATE public.students SET access_code = UPPER(SUBSTR(MD5(RANDOM()::TEXT), 1, 8)) WHERE access_code IS NULL;

-- Make access_code not nullable after populating
ALTER TABLE public.students ALTER COLUMN access_code SET NOT NULL;

-- Create announcements table
CREATE TABLE public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  target_classes TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage announcements" ON public.announcements
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view announcements" ON public.announcements
  FOR SELECT USING (true);

-- Create student concerns/notes table
CREATE TABLE public.student_concerns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.student_concerns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage concerns" ON public.student_concerns
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Create parent messages table
CREATE TABLE public.parent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  message TEXT NOT NULL,
  is_from_parent BOOLEAN NOT NULL DEFAULT true,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.parent_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage messages" ON public.parent_messages
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Add triggers for updated_at
CREATE TRIGGER update_announcements_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();