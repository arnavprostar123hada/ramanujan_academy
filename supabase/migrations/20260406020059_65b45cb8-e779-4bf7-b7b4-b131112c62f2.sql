
-- Online Tests system
CREATE TABLE public.online_tests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  class TEXT NOT NULL,
  subject TEXT NOT NULL,
  test_type TEXT NOT NULL DEFAULT 'mcq' CHECK (test_type IN ('mcq', 'written', 'mixed')),
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  max_marks INTEGER NOT NULL DEFAULT 100,
  is_published BOOLEAN NOT NULL DEFAULT false,
  starts_at TIMESTAMP WITH TIME ZONE,
  ends_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.online_test_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  test_id UUID NOT NULL REFERENCES public.online_tests(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'mcq' CHECK (question_type IN ('mcq', 'written')),
  options JSONB,
  correct_answer TEXT,
  marks INTEGER NOT NULL DEFAULT 1,
  question_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.online_test_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  test_id UUID NOT NULL REFERENCES public.online_tests(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  submitted_at TIMESTAMP WITH TIME ZONE,
  total_marks_obtained NUMERIC DEFAULT 0,
  is_graded BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'graded')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(test_id, student_id)
);

CREATE TABLE public.online_test_answers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id UUID NOT NULL REFERENCES public.online_test_submissions(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.online_test_questions(id) ON DELETE CASCADE,
  answer_text TEXT,
  is_correct BOOLEAN,
  marks_awarded NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Chat messages persistence
CREATE TABLE public.student_chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'chat',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.online_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.online_test_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.online_test_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.online_test_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_chat_messages ENABLE ROW LEVEL SECURITY;

-- Online tests: admins manage, anyone can read published
CREATE POLICY "Admins can manage online tests" ON public.online_tests FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone can view published tests" ON public.online_tests FOR SELECT USING (is_published = true);

-- Questions: admins manage, anyone can read
CREATE POLICY "Admins can manage test questions" ON public.online_test_questions FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone can read test questions" ON public.online_test_questions FOR SELECT USING (true);

-- Submissions: admins manage, anyone can insert/read/update
CREATE POLICY "Admins can manage submissions" ON public.online_test_submissions FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone can insert submissions" ON public.online_test_submissions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read submissions" ON public.online_test_submissions FOR SELECT USING (true);
CREATE POLICY "Anyone can update submissions" ON public.online_test_submissions FOR UPDATE USING (true);

-- Answers: admins manage, anyone can insert/read
CREATE POLICY "Admins can manage answers" ON public.online_test_answers FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone can insert answers" ON public.online_test_answers FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read answers" ON public.online_test_answers FOR SELECT USING (true);
CREATE POLICY "Anyone can update answers" ON public.online_test_answers FOR UPDATE USING (true);

-- Chat messages: anyone can CRUD
CREATE POLICY "Anyone can insert chat messages" ON public.student_chat_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read chat messages" ON public.student_chat_messages FOR SELECT USING (true);
CREATE POLICY "Anyone can delete chat messages" ON public.student_chat_messages FOR DELETE USING (true);
