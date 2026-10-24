-- Kiosk calls originate from the signed-in Admin Dashboard.
-- Parent access-code attendance remains available to anon because the existing parent portal uses custom access-code login.
REVOKE ALL ON FUNCTION public.kiosk_lookup(text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.kiosk_record(text,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.match_attendance_face(text,jsonb,double precision) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.kiosk_record_face(text,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.register_kiosk_device(text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_student_face_template(uuid,jsonb,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_face_consent(uuid,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kiosk_lookup(text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.kiosk_record(text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_attendance_face(text,jsonb,double precision) TO authenticated;
GRANT EXECUTE ON FUNCTION public.kiosk_record_face(text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_kiosk_device(text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_student_face_template(uuid,jsonb,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_face_consent(uuid,text,text,text) TO authenticated;
