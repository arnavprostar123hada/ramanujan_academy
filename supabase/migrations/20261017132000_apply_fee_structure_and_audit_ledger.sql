-- Link applied fee rules to student fee accounts; preserve an audit trail; calculate concessions at application time.
ALTER TABLE public.fee_accounts
  ADD COLUMN IF NOT EXISTS fee_structure_id uuid REFERENCES public.fee_structures(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fee_applied_at timestamptz,
  ADD COLUMN IF NOT EXISTS fee_applied_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.finance_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS finance_audit_log_created_idx ON public.finance_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS finance_audit_log_entity_idx ON public.finance_audit_log(entity_type, entity_id, created_at DESC);
ALTER TABLE public.finance_audit_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.finance_audit_log FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.finance_audit_log TO authenticated;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='finance_audit_log' AND policyname='owner_admin_read_finance_audit') THEN
    CREATE POLICY owner_admin_read_finance_audit ON public.finance_audit_log
      FOR SELECT TO authenticated
      USING (public.is_admin_or_owner());
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.apply_student_fee_structure(
  p_student_id uuid,
  p_fee_structure_id uuid,
  p_reason text DEFAULT 'Apply standard fee structure'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_student public.students%ROWTYPE;
  v_fee public.fee_structures%ROWTYPE;
  v_account public.fee_accounts%ROWTYPE;
  v_has_account boolean := false;
  v_paid numeric(12,2) := 0;
  v_custom_count integer := 0;
  v_custom_net numeric(12,2);
  v_scholarship numeric(12,2) := 0;
  v_fixed numeric(12,2) := 0;
  v_percent numeric(12,2) := 0;
  v_discount numeric(12,2) := 0;
  v_net numeric(12,2) := 0;
  v_before jsonb;
  v_after jsonb;
BEGIN
  IF v_actor IS NULL OR NOT public.is_admin_or_owner() THEN
    RAISE EXCEPTION 'Only an authenticated owner/admin may apply a fee structure' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_student FROM public.students WHERE id = p_student_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Student not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_fee FROM public.fee_structures
  WHERE id = p_fee_structure_id
    AND is_active = true
    AND academic_year = COALESCE(v_student.academic_year, '2026-27')
    AND class = v_student.class
    AND (board = 'Any' OR board = COALESCE(v_student.board, ''))
    AND effective_from <= CURRENT_DATE
    AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active fee structure matches this student class, board and academic year' USING ERRCODE = '22023';
  END IF;

  SELECT count(*), max(concession_value)
    INTO v_custom_count, v_custom_net
  FROM public.student_fee_concessions
  WHERE student_id = p_student_id
    AND academic_year = v_fee.academic_year
    AND active = true
    AND (expires_on IS NULL OR expires_on >= CURRENT_DATE)
    AND concession_type = 'custom_net_fee';

  IF v_custom_count > 0 THEN
    IF v_custom_count <> 1 OR EXISTS (
      SELECT 1 FROM public.student_fee_concessions
      WHERE student_id = p_student_id
        AND academic_year = v_fee.academic_year
        AND active = true
        AND (expires_on IS NULL OR expires_on >= CURRENT_DATE)
        AND concession_type <> 'custom_net_fee'
    ) THEN
      RAISE EXCEPTION 'Custom net fee must be the only active concession for this student and year' USING ERRCODE = '22023';
    END IF;

    IF v_custom_net > v_fee.fee_amount THEN
      RAISE EXCEPTION 'Custom net fee cannot exceed the standard fee' USING ERRCODE = '22023';
    END IF;
    v_net := GREATEST(0, v_custom_net);
    v_discount := v_fee.fee_amount - v_net;
  ELSE
    SELECT
      COALESCE(sum(concession_value) FILTER (WHERE concession_type = 'scholarship'), 0),
      COALESCE(sum(concession_value) FILTER (WHERE concession_type = 'fixed_amount'), 0),
      COALESCE(sum(concession_value) FILTER (WHERE concession_type = 'percentage'), 0)
    INTO v_scholarship, v_fixed, v_percent
    FROM public.student_fee_concessions
    WHERE student_id = p_student_id
      AND academic_year = v_fee.academic_year
      AND active = true
      AND (expires_on IS NULL OR expires_on >= CURRENT_DATE);

    IF v_percent > 100 THEN
      RAISE EXCEPTION 'Combined percentage concessions cannot exceed 100 percent' USING ERRCODE = '22023';
    END IF;

    v_discount := LEAST(v_fee.fee_amount, v_fixed + round(v_fee.fee_amount * v_percent / 100, 2));
    v_scholarship := LEAST(v_fee.fee_amount - v_discount, v_scholarship);
    v_net := GREATEST(0, v_fee.fee_amount - v_discount - v_scholarship);
  END IF;

  SELECT * INTO v_account FROM public.fee_accounts
  WHERE student_id = p_student_id
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;
  v_has_account := FOUND;

  IF v_has_account THEN
    SELECT COALESCE(sum(amount), 0) INTO v_paid FROM public.fee_payments WHERE fee_account_id = v_account.id;
    IF v_paid > v_net THEN
      RAISE EXCEPTION 'Collected amount exceeds the proposed net fee; reconcile the account before applying the change' USING ERRCODE = '22023';
    END IF;
    v_before := to_jsonb(v_account);
    UPDATE public.fee_accounts SET
      total_fee = v_fee.fee_amount,
      scholarship = v_scholarship,
      discount = v_discount,
      net_fee = v_net,
      fee_structure_id = v_fee.id,
      fee_applied_at = now(),
      fee_applied_by = v_actor,
      updated_at = now()
    WHERE id = v_account.id
    RETURNING * INTO v_account;
  ELSE
    INSERT INTO public.fee_accounts (
      student_id, total_fee, scholarship, discount, net_fee,
      fee_structure_id, fee_applied_at, fee_applied_by
    )
    VALUES (
      p_student_id, v_fee.fee_amount, v_scholarship, v_discount, v_net,
      v_fee.id, now(), v_actor
    )
    RETURNING * INTO v_account;
    v_before := NULL;
  END IF;

  v_after := to_jsonb(v_account);
  INSERT INTO public.finance_audit_log (
    actor_user_id, action, entity_type, entity_id, before_data, after_data, reason
  ) VALUES (
    v_actor, 'apply_fee_structure', 'fee_accounts', v_account.id,
    v_before, v_after, COALESCE(NULLIF(btrim(p_reason), ''), 'Apply standard fee structure')
  );

  RETURN jsonb_build_object(
    'success', true,
    'student_id', p_student_id,
    'fee_account_id', v_account.id,
    'fee_structure_id', v_fee.id,
    'total_fee', v_fee.fee_amount,
    'scholarship', v_scholarship,
    'discount', v_discount,
    'net_fee', v_net,
    'collected', v_paid,
    'outstanding', GREATEST(0, v_net - v_paid)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_student_fee_structure(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_student_fee_structure(uuid, uuid, text) TO authenticated;
