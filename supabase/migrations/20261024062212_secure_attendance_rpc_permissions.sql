-- Keep low-level helper functions private to SECURITY DEFINER RPCs.
REVOKE ALL ON FUNCTION public._kiosk_device(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._kiosk_resolve_student(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._last_effective_event(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sae_after_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.block_mutation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.register_kiosk_device(text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_face_consent(uuid,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_kiosk_device(text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_face_consent(uuid,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;

-- Parent access-code sessions are handled by a scoped RPC, not direct attendance table reads.
REVOKE ALL ON FUNCTION public.parent_attendance_by_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.parent_attendance_by_code(text) TO authenticated;

DROP POLICY IF EXISTS "public attendance read" ON public.student_attendance;
DROP POLICY IF EXISTS "Anyone can read student attendance" ON public.student_attendance;
DROP POLICY IF EXISTS "Staff can manage student attendance" ON public.student_attendance;
CREATE POLICY "Staff can manage student attendance" ON public.student_attendance
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));
