-- Student AI history + atomic RA Points accounting
ALTER TABLE public.online_students
  ADD COLUMN IF NOT EXISTS student_id uuid REFERENCES public.students(id) ON DELETE SET NULL;

-- Link existing online students to the main Students registry.
INSERT INTO public.students (name, email, phone, class, student_type)
SELECT o.name, o.email, 'ONLINE-' || LEFT(o.id::text, 8), o.class, 'online'
FROM public.online_students o
WHERE o.student_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.students s WHERE lower(coalesce(s.email, '')) = lower(o.email)
  );

UPDATE public.online_students o
SET student_id = s.id
FROM public.students s
WHERE o.student_id IS NULL
  AND lower(coalesce(s.email, '')) = lower(o.email);

-- AI usage ledger: immutable audit trail for every charged AI action.
CREATE TABLE IF NOT EXISTS public.student_ai_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  mode text NOT NULL,
  action text NOT NULL DEFAULT 'ai_response',
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  total_tokens integer NOT NULL DEFAULT 0,
  credits numeric(10,2) NOT NULL DEFAULT 0,
  provider text,
  cached boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_student_ai_usage_student_created
  ON public.student_ai_usage(student_id, created_at DESC);

ALTER TABLE public.student_ai_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can view student AI usage" ON public.student_ai_usage;
CREATE POLICY "Admins can view student AI usage"
  ON public.student_ai_usage FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

-- Atomic point consumption. Browser never supplies the resulting balance.
CREATE OR REPLACE FUNCTION public.consume_student_ra_points(
  p_student_id uuid,
  p_points numeric,
  p_reason text DEFAULT 'ai_usage',
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE(ok boolean, balance numeric, charged numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_points numeric;
  last_reset_at timestamptz;
  allowance numeric;
  online boolean;
  charged_amount numeric;
BEGIN
  IF p_student_id IS NULL OR p_points IS NULL OR p_points <= 0 OR p_points > 100 THEN
    RETURN QUERY SELECT false, 0::numeric, 0::numeric;
    RETURN;
  END IF;

  -- Only the logged-in student can spend their own points.
  IF NOT EXISTS (
    SELECT 1
    FROM public.online_students o
    JOIN public.students s ON s.id = o.student_id
    WHERE o.student_id = p_student_id
      AND o.user_id = auth.uid()
  ) THEN
    RETURN QUERY SELECT false, 0::numeric, 0::numeric;
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.online_students o WHERE o.student_id = p_student_id
  ) INTO online;

  allowance := CASE WHEN online THEN 20 ELSE 100 END;

  SELECT points, last_reset
  INTO current_points, last_reset_at
  FROM public.ra_points
  WHERE student_id = p_student_id
  FOR UPDATE;

  IF NOT FOUND THEN
    current_points := allowance;
    last_reset_at := now();
    INSERT INTO public.ra_points(student_id, points, last_reset, updated_at)
    VALUES (p_student_id, current_points, last_reset_at, now())
    ON CONFLICT (student_id) DO NOTHING;
    SELECT points, last_reset INTO current_points, last_reset_at
    FROM public.ra_points WHERE student_id = p_student_id FOR UPDATE;
  END IF;

  IF date_trunc('month', last_reset_at) < date_trunc('month', now()) THEN
    current_points := allowance;
    UPDATE public.ra_points
    SET points = current_points, last_reset = now(), updated_at = now()
    WHERE student_id = p_student_id;
  END IF;

  charged_amount := round(p_points::numeric, 2);
  IF current_points < charged_amount THEN
    RETURN QUERY SELECT false, current_points, 0::numeric;
    RETURN;
  END IF;

  UPDATE public.ra_points
  SET points = round(current_points - charged_amount, 2), updated_at = now()
  WHERE student_id = p_student_id;

  INSERT INTO public.student_ai_usage(
    student_id, mode, action, credits, metadata
  ) VALUES (
    p_student_id, 'points', p_reason, charged_amount, p_metadata
  );

  RETURN QUERY
  SELECT true, round(current_points - charged_amount, 2), charged_amount;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_student_ra_points(uuid, numeric, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_student_ra_points(uuid, numeric, text, jsonb) TO authenticated;

-- Atomic refund for failed fixed-cost generation.
CREATE OR REPLACE FUNCTION public.refund_student_ra_points(
  p_student_id uuid,
  p_points numeric,
  p_reason text DEFAULT 'refund',
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE(ok boolean, balance numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_points numeric;
  refund_amount numeric;
BEGIN
  IF p_student_id IS NULL OR p_points IS NULL OR p_points <= 0 OR p_points > 100 THEN
    RETURN QUERY SELECT false, 0::numeric;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.online_students o
    WHERE o.student_id = p_student_id
      AND o.user_id = auth.uid()
  ) THEN
    RETURN QUERY SELECT false, 0::numeric;
    RETURN;
  END IF;

  refund_amount := round(p_points::numeric, 2);

  SELECT points INTO current_points
  FROM public.ra_points
  WHERE student_id = p_student_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0::numeric;
    RETURN;
  END IF;

  UPDATE public.ra_points
  SET points = round(current_points + refund_amount, 2), updated_at = now()
  WHERE student_id = p_student_id;

  INSERT INTO public.student_ai_usage(student_id, mode, action, credits, metadata)
  VALUES (p_student_id, 'points', p_reason, -refund_amount, p_metadata);

  RETURN QUERY SELECT true, round(current_points + refund_amount, 2);
END;
$$;

REVOKE ALL ON FUNCTION public.refund_student_ra_points(uuid, numeric, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refund_student_ra_points(uuid, numeric, text, jsonb) TO authenticated;


-- Service-side atomic consumption for authenticated Edge Functions.
CREATE OR REPLACE FUNCTION public.consume_student_ra_points_admin(
  p_student_id uuid,
  p_points numeric,
  p_reason text DEFAULT 'ai_usage',
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE(ok boolean, balance numeric, charged numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_points numeric;
  last_reset_at timestamptz;
  allowance numeric;
  online boolean;
  charged_amount numeric;
BEGIN
  IF p_student_id IS NULL OR p_points IS NULL OR p_points <= 0 OR p_points > 100 THEN
    RETURN QUERY SELECT false, 0::numeric, 0::numeric; RETURN;
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.online_students o WHERE o.student_id = p_student_id) INTO online;
  allowance := CASE WHEN online THEN 20 ELSE 100 END;

  SELECT points, last_reset INTO current_points, last_reset_at
  FROM public.ra_points WHERE student_id = p_student_id FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.ra_points(student_id, points, last_reset, updated_at)
    VALUES (p_student_id, allowance, now(), now())
    ON CONFLICT (student_id) DO NOTHING;
    SELECT points, last_reset INTO current_points, last_reset_at
    FROM public.ra_points WHERE student_id = p_student_id FOR UPDATE;
  END IF;

  IF date_trunc('month', last_reset_at) < date_trunc('month', now()) THEN
    current_points := allowance;
    UPDATE public.ra_points SET points = current_points, last_reset = now(), updated_at = now()
    WHERE student_id = p_student_id;
  END IF;

  charged_amount := round(p_points::numeric, 2);
  IF current_points < charged_amount THEN
    RETURN QUERY SELECT false, current_points, 0::numeric; RETURN;
  END IF;

  UPDATE public.ra_points
  SET points = round(current_points - charged_amount, 2), updated_at = now()
  WHERE student_id = p_student_id;

  INSERT INTO public.student_ai_usage(student_id, mode, action, credits, metadata)
  VALUES (p_student_id, 'points', p_reason, charged_amount, p_metadata);

  RETURN QUERY SELECT true, round(current_points - charged_amount, 2), charged_amount;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_student_ra_points_admin(uuid, numeric, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_student_ra_points_admin(uuid, numeric, text, jsonb) TO service_role;
