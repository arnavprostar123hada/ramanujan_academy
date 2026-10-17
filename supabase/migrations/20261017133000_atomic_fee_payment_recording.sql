CREATE OR REPLACE FUNCTION public.record_fee_payment(
  p_fee_account_id uuid,
  p_payment_date date,
  p_amount numeric,
  p_payment_mode text,
  p_reference_number text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_fee_type text DEFAULT 'Tuition Fee',
  p_cash_bank text DEFAULT 'Cash'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_account public.fee_accounts%ROWTYPE;
  v_student public.students%ROWTYPE;
  v_payment public.fee_payments%ROWTYPE;
  v_paid_before numeric(12,2) := 0;
  v_outstanding_before numeric(12,2) := 0;
  v_outstanding_after numeric(12,2) := 0;
BEGIN
  IF v_actor IS NULL OR NOT public.is_admin_or_owner() THEN
    RAISE EXCEPTION 'Only an authenticated owner/admin may record a fee payment' USING ERRCODE = '42501';
  END IF;
  IF p_fee_account_id IS NULL THEN
    RAISE EXCEPTION 'Fee account is required' USING ERRCODE = '22023';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero' USING ERRCODE = '22023';
  END IF;
  IF NULLIF(btrim(COALESCE(p_payment_mode, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Payment mode is required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_account
  FROM public.fee_accounts
  WHERE id = p_fee_account_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fee account not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_account.net_fee < 0 THEN
    RAISE EXCEPTION 'Fee account has an invalid net fee' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_student FROM public.students WHERE id = v_account.student_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Linked student not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT COALESCE(sum(amount), 0) INTO v_paid_before
  FROM public.fee_payments WHERE fee_account_id = v_account.id;
  v_outstanding_before := GREATEST(0, v_account.net_fee - v_paid_before);

  IF p_amount > v_outstanding_before THEN
    RAISE EXCEPTION 'Payment amount exceeds the remaining fee of %', v_outstanding_before USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.fee_payments (
    fee_account_id, payment_date, amount, payment_mode,
    reference_number, notes, branch_id, fee_type, cash_bank
  ) VALUES (
    v_account.id,
    COALESCE(p_payment_date, CURRENT_DATE),
    round(p_amount, 2),
    btrim(p_payment_mode),
    NULLIF(btrim(COALESCE(p_reference_number, '')), ''),
    NULLIF(btrim(COALESCE(p_notes, '')), ''),
    v_student.branch_id,
    COALESCE(NULLIF(btrim(COALESCE(p_fee_type, '')), ''), 'Tuition Fee'),
    COALESCE(NULLIF(btrim(COALESCE(p_cash_bank, '')), ''), 'Cash')
  ) RETURNING * INTO v_payment;

  v_outstanding_after := GREATEST(0, v_outstanding_before - v_payment.amount);

  INSERT INTO public.finance_audit_log (
    actor_user_id, action, entity_type, entity_id, before_data, after_data, reason
  ) VALUES (
    v_actor, 'record_fee_payment', 'fee_payments', v_payment.id,
    jsonb_build_object('outstanding_before', v_outstanding_before, 'paid_before', v_paid_before),
    jsonb_build_object(
      'receipt_number', v_payment.receipt_number,
      'amount', v_payment.amount,
      'outstanding_after', v_outstanding_after,
      'payment_mode', v_payment.payment_mode
    ),
    COALESCE(NULLIF(btrim(p_notes), ''), 'Fee payment recorded')
  );

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_payment.id,
    'receipt_number', v_payment.receipt_number,
    'student_id', v_student.id,
    'student_name', v_student.name,
    'fee_account_id', v_account.id,
    'payment_date', v_payment.payment_date,
    'amount', v_payment.amount,
    'total_fee', v_account.total_fee,
    'net_fee', v_account.net_fee,
    'paid_before', v_paid_before,
    'paid_after', v_paid_before + v_payment.amount,
    'outstanding_before', v_outstanding_before,
    'outstanding_after', v_outstanding_after
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_fee_payment(uuid, date, numeric, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_fee_payment(uuid, date, numeric, text, text, text, text, text) TO authenticated;
