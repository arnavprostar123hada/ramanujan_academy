-- Create storage bucket for test photos
INSERT INTO storage.buckets (id, name, public) VALUES ('test-photos', 'test-photos', true)
ON CONFLICT DO NOTHING;

-- Allow anyone to view test photos (public bucket)
CREATE POLICY "Test photos are publicly viewable"
ON storage.objects FOR SELECT
USING (bucket_id = 'test-photos');

-- Allow authenticated users (teachers/admins) to upload test photos
CREATE POLICY "Teachers and admins can upload test photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'test-photos');

-- Allow deletion of test photos
CREATE POLICY "Allow test photo deletion"
ON storage.objects FOR DELETE
USING (bucket_id = 'test-photos');

-- Create tests table for test announcements
CREATE TABLE public.tests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  class TEXT NOT NULL,
  test_date DATE NOT NULL,
  max_marks INTEGER NOT NULL DEFAULT 100,
  description TEXT,
  is_notified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create test results table for storing student marks
CREATE TABLE public.test_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  test_id UUID NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  marks_obtained NUMERIC(5,2) NOT NULL,
  photo_url TEXT,
  remarks TEXT,
  is_notified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(test_id, student_id)
);

-- Enable RLS
ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_results ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tests
CREATE POLICY "Anyone can view tests"
ON public.tests FOR SELECT
USING (true);

CREATE POLICY "Anyone can insert tests"
ON public.tests FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update tests"
ON public.tests FOR UPDATE
USING (true);

CREATE POLICY "Anyone can delete tests"
ON public.tests FOR DELETE
USING (true);

-- RLS Policies for test_results
CREATE POLICY "Anyone can view test results"
ON public.test_results FOR SELECT
USING (true);

CREATE POLICY "Anyone can insert test results"
ON public.test_results FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update test results"
ON public.test_results FOR UPDATE
USING (true);

CREATE POLICY "Anyone can delete test results"
ON public.test_results FOR DELETE
USING (true);

-- Add trigger for updated_at on tests
CREATE TRIGGER update_tests_updated_at
BEFORE UPDATE ON public.tests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add trigger for updated_at on test_results
CREATE TRIGGER update_test_results_updated_at
BEFORE UPDATE ON public.test_results
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for tests and test_results
ALTER PUBLICATION supabase_realtime ADD TABLE public.tests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.test_results;