CREATE TABLE IF NOT EXISTS private.attendance_face_match_tokens (
  token_hash text PRIMARY KEY,
  device_id uuid NOT NULL REFERENCES public.attendance_kiosk_devices(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  match_distance double precision NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_face_match_tokens_expiry ON private.attendance_face_match_tokens(expires_at);
REVOKE ALL ON private.attendance_face_match_tokens FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.match_attendance_face(
  p_device_token text,p_descriptor jsonb,p_threshold double precision DEFAULT 0.52
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, pg_catalog, extensions
AS $$
DECLARE
  d public.attendance_kiosk_devices;
  v_best record;
  v_last public.student_attendance_events;
  v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_suggested text := 'in';
  v_ambiguous boolean := false;
  v_reason text;
  v_match_token text;
BEGIN
  d:=public._kiosk_device(p_device_token);
  IF d.id IS NULL THEN RETURN jsonb_build_object('ok',false,'reason','device_not_authorized'); END IF;
  UPDATE public.attendance_kiosk_devices SET last_seen_at=now() WHERE id=d.id;
  IF jsonb_typeof(p_descriptor)<>'array' OR jsonb_array_length(p_descriptor)<>128
     OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_descriptor) AS x(v) WHERE jsonb_typeof(v)<>'number') THEN
    RETURN jsonb_build_object('ok',false,'reason','invalid_descriptor');
  END IF;
  IF p_threshold<0.25 OR p_threshold>0.60 THEN p_threshold:=0.52; END IF;

  WITH distances AS (
    SELECT t.student_id,
      sqrt(sum(power((t.descriptor ->> i)::double precision-(p_descriptor ->> i)::double precision,2))) AS distance
    FROM private.student_face_templates t
    JOIN public.student_face_consent c ON c.student_id=t.student_id AND c.status='granted'
    JOIN public.students s ON s.id=t.student_id AND s.status='active'
    CROSS JOIN generate_series(0,127) AS i
    WHERE t.descriptor IS NOT NULL AND jsonb_typeof(t.descriptor)='array' AND jsonb_array_length(t.descriptor)=128
    GROUP BY t.student_id,t.descriptor
  ), ranked AS (
    SELECT student_id,distance,lead(distance) OVER (ORDER BY distance) AS next_distance FROM distances
  )
  SELECT * INTO v_best FROM ranked ORDER BY distance LIMIT 1;

  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason','no_consented_templates'); END IF;
  IF v_best.distance>p_threshold THEN RETURN jsonb_build_object('ok',false,'reason','no_match'); END IF;
  IF v_best.next_distance IS NOT NULL AND (v_best.next_distance-v_best.distance)<0.08 THEN
    RETURN jsonb_build_object('ok',false,'reason','ambiguous_match');
  END IF;

  v_last:=public._last_effective_event(v_best.student_id);
  IF v_last.id IS NOT NULL AND v_last.direction='in' THEN
    IF v_last.attendance_date=v_today THEN v_suggested:='out';
    ELSE v_suggested:='in'; v_ambiguous:=true; v_reason:='Previous day has an IN without OUT'; END IF;
  END IF;
  IF v_last.id IS NOT NULL AND v_last.occurred_at>now()-interval '10 minutes' THEN
    v_ambiguous:=true; v_reason:=coalesce(v_reason,'Last scan was only a few minutes ago');
  END IF;

  v_match_token:=encode(extensions.gen_random_bytes(24),'hex');
  INSERT INTO private.attendance_face_match_tokens(token_hash,device_id,student_id,match_distance,expires_at)
  VALUES(encode(extensions.digest(v_match_token,'sha256'),'hex'),d.id,v_best.student_id,v_best.distance,now()+interval '45 seconds');

  RETURN jsonb_build_object('ok',true,'student_ref',v_best.student_id,'match_distance',round(v_best.distance::numeric,4),
    'match_token',v_match_token,'suggested',v_suggested,'ambiguous',v_ambiguous,'ambiguous_reason',v_reason,
    'last_direction',v_last.direction,'last_at',v_last.occurred_at);
END;
$$;
REVOKE ALL ON FUNCTION public.match_attendance_face(text,jsonb,double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_attendance_face(text,jsonb,double precision) TO anon,authenticated;

DROP FUNCTION IF EXISTS public.kiosk_record_face(text,uuid,text,double precision,text);
CREATE OR REPLACE FUNCTION public.kiosk_record_face(
  p_device_token text,p_match_token text,p_direction text,p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, pg_catalog, extensions
AS $$
DECLARE
  d public.attendance_kiosk_devices;
  v_match private.attendance_face_match_tokens;
  v_last public.student_attendance_events;
  v_event_id uuid;
  v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
BEGIN
  IF p_direction NOT IN ('in','out') THEN RETURN jsonb_build_object('ok',false,'reason','invalid_direction'); END IF;
  IF coalesce(length(p_idempotency_key),0)<8 THEN RETURN jsonb_build_object('ok',false,'reason','invalid_request'); END IF;
  d:=public._kiosk_device(p_device_token);
  IF d.id IS NULL THEN RETURN jsonb_build_object('ok',false,'reason','device_not_authorized'); END IF;

  PERFORM pg_advisory_xact_lock(hashtext(coalesce(p_match_token,'')));
  SELECT * INTO v_match FROM private.attendance_face_match_tokens
  WHERE token_hash=encode(extensions.digest(coalesce(p_match_token,''),'sha256'),'hex')
    AND device_id=d.id AND consumed_at IS NULL AND expires_at>now()
  FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason','face_match_token_invalid_or_expired'); END IF;

  v_last:=public._last_effective_event(v_match.student_id);
  IF v_last.id IS NOT NULL AND v_last.occurred_at>now()-interval '60 seconds' THEN
    RETURN jsonb_build_object('ok',false,'reason','cooldown');
  END IF;
  IF v_last.id IS NOT NULL AND v_last.attendance_date=v_today AND v_last.direction=p_direction THEN
    RETURN jsonb_build_object('ok',false,'reason','duplicate_direction','last_direction',v_last.direction);
  END IF;

  UPDATE private.attendance_face_match_tokens SET consumed_at=now() WHERE token_hash=v_match.token_hash;
  INSERT INTO public.student_attendance_events(student_id,direction,branch,device_id,method,confidence,needs_review,review_reason,idempotency_key)
  VALUES(v_match.student_id,p_direction,d.branch,d.id,'face',NULL,v_match.match_distance>0.48,
    CASE WHEN v_match.match_distance>0.48 THEN 'Face match near pilot threshold; verify manually' ELSE NULL END,p_idempotency_key)
  RETURNING id INTO v_event_id;
  RETURN jsonb_build_object('ok',true,'event_id',v_event_id,'student_ref',v_match.student_id,'direction',p_direction,'occurred_at',now());
END;
$$;
REVOKE ALL ON FUNCTION public.kiosk_record_face(text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kiosk_record_face(text,text,text,text) TO anon,authenticated;

CREATE OR REPLACE FUNCTION public.kiosk_record(p_device_token text,p_code text,p_direction text,p_idempotency_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_catalog AS $$
DECLARE d public.attendance_kiosk_devices; v_sid uuid; last public.student_attendance_events; ex public.student_attendance_events; v_id uuid; v_name text;
  v_today date:=(now() AT TIME ZONE 'Asia/Kolkata')::date;
BEGIN
 IF p_direction NOT IN ('in','out') THEN RETURN jsonb_build_object('ok',false,'reason','invalid_direction'); END IF;
 IF coalesce(length(p_idempotency_key),0)<8 THEN RETURN jsonb_build_object('ok',false,'reason','invalid_request'); END IF;
 d:=public._kiosk_device(p_device_token);
 IF d.id IS NULL THEN RETURN jsonb_build_object('ok',false,'reason','device_not_authorized'); END IF;
 SELECT * INTO ex FROM public.student_attendance_events WHERE idempotency_key=p_idempotency_key;
 IF ex.id IS NOT NULL THEN RETURN jsonb_build_object('ok',true,'duplicate',true,'direction',ex.direction,'occurred_at',ex.occurred_at); END IF;
 v_sid:=public._kiosk_resolve_student(p_code);
 IF v_sid IS NULL THEN RETURN jsonb_build_object('ok',false,'reason','unknown'); END IF;
 PERFORM pg_advisory_xact_lock(hashtext(v_sid::text));
 last:=public._last_effective_event(v_sid);
 IF last.id IS NOT NULL AND last.occurred_at>now()-interval '60 seconds' THEN
   RETURN jsonb_build_object('ok',false,'reason','cooldown','last_direction',last.direction,'last_at',last.occurred_at);
 END IF;
 IF last.id IS NOT NULL AND last.attendance_date=v_today AND last.direction=p_direction THEN
   RETURN jsonb_build_object('ok',false,'reason','duplicate_direction','last_direction',last.direction);
 END IF;
 INSERT INTO public.student_attendance_events(student_id,direction,branch,device_id,method,idempotency_key)
 VALUES(v_sid,p_direction,d.branch,d.id,CASE WHEN trim(p_code) ILIKE 'RA_ATTENDANCE:%' THEN 'qr' ELSE 'manual_code' END,p_idempotency_key)
 RETURNING id INTO v_id;
 SELECT name INTO v_name FROM public.students WHERE id=v_sid;
 RETURN jsonb_build_object('ok',true,'direction',p_direction,'name',v_name,'occurred_at',now());
END; $$;
REVOKE ALL ON FUNCTION public.kiosk_record(text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kiosk_record(text,text,text,text) TO anon,authenticated;
