-- Only owner/admin users may read or write fee account balances and payment entries directly.
-- Other authenticated roles must use explicitly authorised server-side workflows.
DROP POLICY IF EXISTS authenticated_all ON public.fee_accounts;
DROP POLICY IF EXISTS authenticated_all ON public.fee_payments;

CREATE POLICY owner_admin_manage_fee_accounts ON public.fee_accounts
  FOR ALL TO authenticated
  USING (public.is_admin_or_owner())
  WITH CHECK (public.is_admin_or_owner());

CREATE POLICY owner_admin_manage_fee_payments ON public.fee_payments
  FOR ALL TO authenticated
  USING (public.is_admin_or_owner())
  WITH CHECK (public.is_admin_or_owner());
