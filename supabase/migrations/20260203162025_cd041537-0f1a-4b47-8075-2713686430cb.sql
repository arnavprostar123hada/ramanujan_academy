-- Create enquiries table for tracking potential students
CREATE TABLE public.enquiries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  class TEXT NOT NULL,
  board TEXT NOT NULL,
  date_of_birth DATE,
  gender TEXT NOT NULL CHECK (gender IN ('male', 'female', 'other')),
  parent_name TEXT NOT NULL,
  parent_phone TEXT NOT NULL,
  parent_email TEXT,
  parent_occupation TEXT,
  previous_school TEXT,
  previous_percentage NUMERIC,
  strong_subjects TEXT[],
  weak_subjects TEXT[],
  academic_notes TEXT,
  source TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'followup', 'promoted', 'rejected')),
  followup_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  promoted_at TIMESTAMP WITH TIME ZONE,
  promoted_student_id UUID REFERENCES public.students(id)
);

-- Enable RLS
ALTER TABLE public.enquiries ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage enquiries" 
ON public.enquiries 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can insert enquiries" 
ON public.enquiries 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can view enquiries" 
ON public.enquiries 
FOR SELECT 
USING (true);

-- Update trigger for updated_at
CREATE TRIGGER update_enquiries_updated_at
BEFORE UPDATE ON public.enquiries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();