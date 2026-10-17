CREATE OR REPLACE FUNCTION public.assign_finance_receipt_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Authenticated browser writes must come from an owner/admin. Trusted service-role
  -- Edge Functions must independently validate the calling user's role before writes.
  IF auth.uid() IS NOT NULL AND NOT public.is_admin_or_owner() THEN
    RAISE EXCEPTION 'Not authorised to create finance receipts' USING ERRCODE = '42501';
  END IF;
  IF NEW.receipt_number IS NULL OR btrim(NEW.receipt_number) = '' THEN
    NEW.receipt_number := public.next_finance_receipt_number(NEW.payment_date);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.assign_finance_receipt_number() FROM PUBLIC, anon, authenticated;
