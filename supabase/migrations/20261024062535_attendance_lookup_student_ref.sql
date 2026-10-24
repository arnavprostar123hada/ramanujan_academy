CREATE OR REPLACE FUNCTION public._kiosk_resolve_student(p_code text)
RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_code text := upper(trim(coalesce(p_code,''))); v_id uuid;
BEGIN
  IF v_code ILIKE 'RA_ATTENDANCE:%' THEN
    v_code := upper(trim(substr(v_code, 15)));
  END IF;
  IF v_code !~ '^[A-Z0-9]{8}$' THEN RETURN NULL; END IF;
  SELECT id INTO v_id FROM public.students
  WHERE upper(access_code) = v_code AND status = 'active'
  LIMIT 1;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public._kiosk_resolve_student(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.kiosk_lookup(p_device_token text,p_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d public.attendance_kiosk_devices; v_sid uuid; last public.student_attendance_events;
 v_suggest text:='in'; v_ambiguous boolean:=false; v_reason text; v_today date:=(now() AT TIME ZONE 'Asia/Kolkata')::date;
BEGIN
 d:=public._kiosk_device(p_device_token);
 IF d.id IS NULL THEN RETURN jsonb_build_object('ok',false,'reason','device_not_authorized'); END IF;
 UPDATE public.attendance_kiosk_devices SET last_seen_at=now() WHERE id=d.id;
 v_sid:=public._kiosk_resolve_student(p_code);
 IF v_sid IS NULL THEN
  INSERT INTO public.attendance_audit_log(device_id,action,details)
  VALUES(d.id,'kiosk_unknown_code',jsonb_build_object('length',length(coalesce(p_code,''))));
  RETURN jsonb_build_object('ok',false,'reason','unknown');
 END IF;
 last:=public._last_effective_event(v_sid);
 IF last.id IS NOT NULL AND last.occurred_at>now()-interval '60 seconds' THEN
  RETURN jsonb_build_object('ok',false,'reason','cooldown');
 END IF;
 IF last.id IS NOT NULL AND last.direction='in' THEN
  IF last.attendance_date=v_today THEN v_suggest:='out';
  ELSE v_suggest:='in'; v_ambiguous:=true; v_reason:='Previous day has an IN without OUT'; END IF;
 END IF;
 IF last.id IS NOT NULL AND last.occurred_at>now()-interval '10 minutes' THEN
  v_ambiguous:=true; v_reason:=coalesce(v_reason,'Last scan was only a few minutes ago');
 END IF;
 RETURN jsonb_build_object('ok',true,'student_ref',v_sid,'suggested',v_suggest,'ambiguous',v_ambiguous,
   'ambiguous_reason',v_reason,'last_direction',last.direction,'last_at',last.occurred_at,'branch',d.branch,'device',d.name);
END;
$$;
REVOKE ALL ON FUNCTION public.kiosk_lookup(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kiosk_lookup(text,text) TO anon,authenticated;
