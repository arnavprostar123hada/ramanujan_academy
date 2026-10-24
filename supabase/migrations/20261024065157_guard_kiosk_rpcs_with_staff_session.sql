-- Move kiosk implementations out of the exposed public schema and retain guarded public wrappers.
ALTER FUNCTION public.kiosk_lookup(text,text) SET SCHEMA private;
ALTER FUNCTION public.kiosk_record(text,text,text,text) SET SCHEMA private;
ALTER FUNCTION public.match_attendance_face(text,jsonb,double precision) SET SCHEMA private;
ALTER FUNCTION public.kiosk_record_face(text,text,text,text) SET SCHEMA private;

REVOKE ALL ON FUNCTION private.kiosk_lookup(text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.kiosk_record(text,text,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.match_attendance_face(text,jsonb,double precision) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.kiosk_record_face(text,text,text,text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.kiosk_lookup(p_device_token text,p_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private,pg_catalog AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_staff(auth.uid()) THEN
    RETURN jsonb_build_object('ok',false,'reason','not_authorized');
  END IF;
  RETURN private.kiosk_lookup(p_device_token,p_code);
END;
$$;
REVOKE ALL ON FUNCTION public.kiosk_lookup(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kiosk_lookup(text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.kiosk_record(p_device_token text,p_code text,p_direction text,p_idempotency_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private,pg_catalog AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_staff(auth.uid()) THEN
    RETURN jsonb_build_object('ok',false,'reason','not_authorized');
  END IF;
  RETURN private.kiosk_record(p_device_token,p_code,p_direction,p_idempotency_key);
END;
$$;
REVOKE ALL ON FUNCTION public.kiosk_record(text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kiosk_record(text,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.match_attendance_face(p_device_token text,p_descriptor jsonb,p_threshold double precision DEFAULT 0.52)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private,pg_catalog AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_staff(auth.uid()) THEN
    RETURN jsonb_build_object('ok',false,'reason','not_authorized');
  END IF;
  RETURN private.match_attendance_face(p_device_token,p_descriptor,p_threshold);
END;
$$;
REVOKE ALL ON FUNCTION public.match_attendance_face(text,jsonb,double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_attendance_face(text,jsonb,double precision) TO authenticated;

CREATE OR REPLACE FUNCTION public.kiosk_record_face(p_device_token text,p_match_token text,p_direction text,p_idempotency_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private,pg_catalog AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_staff(auth.uid()) THEN
    RETURN jsonb_build_object('ok',false,'reason','not_authorized');
  END IF;
  RETURN private.kiosk_record_face(p_device_token,p_match_token,p_direction,p_idempotency_key);
END;
$$;
REVOKE ALL ON FUNCTION public.kiosk_record_face(text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kiosk_record_face(text,text,text,text) TO authenticated;
