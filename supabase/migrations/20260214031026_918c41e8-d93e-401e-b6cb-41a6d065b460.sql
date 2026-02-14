
-- Add expected timing to teachers table
ALTER TABLE public.teachers ADD COLUMN expected_check_in time DEFAULT '09:00:00';
ALTER TABLE public.teachers ADD COLUMN expected_check_out time DEFAULT '17:00:00';

-- Add check-in/out times and late mark to teacher_attendance
ALTER TABLE public.teacher_attendance ADD COLUMN check_in_time time DEFAULT NULL;
ALTER TABLE public.teacher_attendance ADD COLUMN check_out_time time DEFAULT NULL;
ALTER TABLE public.teacher_attendance ADD COLUMN is_late boolean DEFAULT false;
