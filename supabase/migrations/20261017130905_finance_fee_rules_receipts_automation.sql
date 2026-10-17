-- Additive finance foundations: fee rules, individual concessions and numbered receipts.
CREATE TABLE IF NOT EXISTS public.fee_structures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year text NOT NULL DEFAULT '2026-27',
  class text NOT NULL,
  board text NOT NULL DEFAULT 'Any',
  course_name text NOT NULL DEFAULT 'Tuition',
  fee_amount numeric(12,2) NOT NULL CHECK (fee_amount >= 0),
  currency text NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
  is_active boolean NOT NULL DEFAULT true,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);
CREATE INDEX IF NOT EXISTS fee_structures_lookup_idx
  ON public.fee_structures (academic_year, class, board, course_name, is_active);

CREATE TABLE IF NOT EXISTS public.student_fee_concessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE RESTRICT,
  academic_year text NOT NULL DEFAULT '2026-27',
  concession_type text NOT NULL CHECK (concession_type IN ('fixed_amount','percentage','scholarship','custom_net_fee')),
  concession_value numeric(12,2) NOT NULL CHECK (concession_value >= 0),
  reason text NOT NULL,
  approved_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  approved_at timestamptz NOT NULL DEFAULT now(),
  expires_on date,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS student_fee_concessions_student_idx
  ON public.student_fee_concessions (student_id, academic_year, active);

CREATE TABLE IF NOT EXISTS public.finance_receipt_sequence (
  sequence_year integer PRIMARY KEY,
  last_value bigint NOT NULL DEFAULT 0 CHECK (last_value >= 0)
);

CREATE OR REPLACE FUNCTION public.next_finance_receipt_number(p_payment_date date DEFAULT CURRENT_DATE)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_year integer := EXTRACT(YEAR FROM COALESCE(p_payment_date, CURRENT_DATE))::integer;
  v_next bigint;
BEGIN
  INSERT INTO public.finance_receipt_sequence(sequence_year, last_value)
  VALUES (v_year, 1)
  ON CONFLICT (sequence_year)
  DO UPDATE SET last_value = public.finance_receipt_sequence.last_value + 1
  RETURNING last_value INTO v_next;
  RETURN 'RA/' || v_year::text || '/' || lpad(v_next::text, 6, '0');
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS fee_payments_receipt_number_unique_idx
  ON public.fee_payments (receipt_number)
  WHERE receipt_number IS NOT NULL;

CREATE OR REPLACE FUNCTION public.assign_finance_receipt_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.receipt_number IS NULL OR btrim(NEW.receipt_number) = '' THEN
    NEW.receipt_number := public.next_finance_receipt_number(NEW.payment_date);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS fee_payments_assign_receipt_number ON public.fee_payments;
CREATE TRIGGER fee_payments_assign_receipt_number
BEFORE INSERT ON public.fee_payments
FOR EACH ROW EXECUTE FUNCTION public.assign_finance_receipt_number();

CREATE OR REPLACE VIEW public.finance_receipt_register
WITH (security_invoker = true)
AS
SELECT
  fp.id AS payment_id, fp.receipt_number, fp.payment_date, fp.amount,
  fp.payment_mode, fp.reference_number, fp.fee_type, fp.cash_bank, fp.notes, fp.branch_id,
  fa.student_id, s.name AS student_name, s.class, s.board, s.academic_year,
  fa.total_fee, fa.scholarship, fa.discount, fa.net_fee
FROM public.fee_payments fp
JOIN public.fee_accounts fa ON fa.id = fp.fee_account_id
JOIN public.students s ON s.id = fa.student_id;

ALTER TABLE public.fee_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_fee_concessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_receipt_sequence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fee_structures FROM anon, authenticated;
REVOKE ALL ON public.student_fee_concessions FROM anon, authenticated;
REVOKE ALL ON public.finance_receipt_sequence FROM anon, authenticated;
REVOKE ALL ON public.finance_receipt_register FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.next_finance_receipt_number(date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assign_finance_receipt_number() FROM PUBLIC, anon, authenticated;
