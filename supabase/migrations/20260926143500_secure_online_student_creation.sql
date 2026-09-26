-- Securely create an online student and its main Students-tab record.
CREATE OR REPLACE FUNCTION public.create_online_student_profile(
  p_name text,
  p_email text,
  p_class text
)
RETURNS TABLE(student_id uuid, online_student_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  main_student_id uuid;
  online_id uuid;
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR p_name IS NULL OR trim(p_name) = '' OR p_email IS NULL OR trim(p_email) = '' THEN
    RAISE EXCEPTION 'Invalid student profile';
  END IF;

  INSERT INTO public.students(name, email, phone, class, student_type, status)
  VALUES (
    trim(p_name),
    lower(trim(p_email)),
    'ONLINE-' || left(uid::text, 8),
    p_class,
    'online',
    'active'
  )
  RETURNING id INTO main_student_id;

  INSERT INTO public.online_students(user_id, student_id, name, email, class)
  VALUES (uid, main_student_id, trim(p_name), lower(trim(p_email)), p_class)
  RETURNING id INTO online_id;

  INSERT INTO public.ra_points(student_id, points, last_reset, updated_at)
  VALUES (main_student_id, 20, now(), now())
  ON CONFLICT (student_id) DO NOTHING;

  RETURN QUERY SELECT main_student_id, online_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_online_student_profile(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_online_student_profile(text, text, text) TO authenticated;
