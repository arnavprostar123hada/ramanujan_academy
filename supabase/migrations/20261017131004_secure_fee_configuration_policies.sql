DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='fee_structures' AND policyname='owner_admin_manage_fee_structures') THEN
    CREATE POLICY owner_admin_manage_fee_structures ON public.fee_structures
      FOR ALL TO authenticated
      USING (public.is_admin_or_owner())
      WITH CHECK (public.is_admin_or_owner());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='student_fee_concessions' AND policyname='owner_admin_manage_fee_concessions') THEN
    CREATE POLICY owner_admin_manage_fee_concessions ON public.student_fee_concessions
      FOR ALL TO authenticated
      USING (public.is_admin_or_owner())
      WITH CHECK (public.is_admin_or_owner());
  END IF;
END $$;
GRANT SELECT, INSERT, UPDATE ON public.fee_structures TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.student_fee_concessions TO authenticated;
GRANT SELECT ON public.finance_receipt_register TO authenticated;
