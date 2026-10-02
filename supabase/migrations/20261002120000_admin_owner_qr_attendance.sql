-- Allow both admin and owner roles to manage classroom attendance scans.
DROP POLICY IF EXISTS "Admins can manage student attendance" ON public.student_attendance;

CREATE POLICY "Admins and owners can manage student attendance"
ON public.student_attendance
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'owner'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'owner'::app_role)
);
