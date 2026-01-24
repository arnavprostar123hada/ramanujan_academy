-- Create teachers table with generated access codes
CREATE TABLE public.teachers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT NOT NULL,
  access_code TEXT NOT NULL UNIQUE DEFAULT CONCAT('TCH', UPPER(SUBSTRING(md5(random()::text), 1, 6))),
  assigned_classes TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create class logs table (what teachers did in class)
CREATE TABLE public.class_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  class TEXT NOT NULL,
  content TEXT NOT NULL,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create student complaints table
CREATE TABLE public.student_complaints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  complaint TEXT NOT NULL,
  is_sent_to_parent BOOLEAN DEFAULT false,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_complaints ENABLE ROW LEVEL SECURITY;

-- RLS policies for teachers (public read for login, admin manages)
CREATE POLICY "Anyone can read teachers for login" ON public.teachers FOR SELECT USING (true);
CREATE POLICY "Admins can manage teachers" ON public.teachers FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS policies for class_logs
CREATE POLICY "Anyone can read class logs" ON public.class_logs FOR SELECT USING (true);
CREATE POLICY "Anyone can insert class logs" ON public.class_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can manage class logs" ON public.class_logs FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS policies for student_complaints
CREATE POLICY "Anyone can read complaints" ON public.student_complaints FOR SELECT USING (true);
CREATE POLICY "Anyone can insert complaints" ON public.student_complaints FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can manage complaints" ON public.student_complaints FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at on teachers
CREATE TRIGGER update_teachers_updated_at
BEFORE UPDATE ON public.teachers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();