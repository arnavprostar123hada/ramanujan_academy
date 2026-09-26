-- Lock the RA balance table: clients may read, but cannot write balances directly.
REVOKE INSERT, UPDATE, DELETE ON public.ra_points FROM anon, authenticated;
GRANT SELECT ON public.ra_points TO authenticated;

DROP POLICY IF EXISTS "Anyone can insert ra_points" ON public.ra_points;
DROP POLICY IF EXISTS "Anyone can update ra_points" ON public.ra_points;
DROP POLICY IF EXISTS "Anyone can read ra_points" ON public.ra_points;

CREATE POLICY "Authenticated users can read RA points"
  ON public.ra_points FOR SELECT TO authenticated
  USING (true);

-- Controlled reward path for legitimate student actions.
CREATE OR REPLACE FUNCTION public.award_student_ra_points(
  p_student_id uuid,
  p_points numeric,
  p_reason text DEFAULT 'reward',
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE(ok boolean, balance numeric, awarded numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_points numeric;
  award_amount numeric;
BEGIN
  IF p_student_id IS NULL OR p_points IS NULL OR p_points <= 0 OR p_points > 20 THEN
    RETURN QUERY SELECT false, 0::numeric, 0::numeric; RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.online_students o
    WHERE o.student_id = p_student_id AND o.user_id = auth.uid()
  ) THEN
    RETURN QUERY SELECT false, 0::numeric, 0::numeric; RETURN;
  END IF;

  award_amount := round(p_points::numeric, 2);

  SELECT points INTO current_points
  FROM public.ra_points
  WHERE student_id = p_student_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0::numeric, 0::numeric; RETURN;
  END IF;

  UPDATE public.ra_points
  SET points = round(current_points + award_amount, 2), updated_at = now()
  WHERE student_id = p_student_id;

  INSERT INTO public.student_ai_usage(student_id, mode, action, credits, metadata)
  VALUES (p_student_id, 'points', p_reason, -award_amount, p_metadata);

  RETURN QUERY SELECT true, round(current_points + award_amount, 2), award_amount;
END;
$$;

REVOKE ALL ON FUNCTION public.award_student_ra_points(uuid, numeric, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.award_student_ra_points(uuid, numeric, text, jsonb) TO authenticated;

DROP POLICY IF EXISTS "Students can delete own chat messages" ON public.student_chat_messages;
CREATE POLICY "Students can delete own chat messages"
  ON public.student_chat_messages FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.online_students o
      WHERE o.student_id = student_chat_messages.student_id
        AND o.user_id = auth.uid()
    )
  );
