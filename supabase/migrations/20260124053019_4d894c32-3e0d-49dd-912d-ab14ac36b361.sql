-- Add resolved status to student_concerns table
ALTER TABLE public.student_concerns 
ADD COLUMN is_resolved BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN resolved_at TIMESTAMP WITH TIME ZONE;