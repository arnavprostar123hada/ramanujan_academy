CREATE OR REPLACE FUNCTION private.kiosk_record_face(
  p_device_token text,
  p_match_token text,
  p_direction text,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, private, pg_catalog, extensions
AS $$
DECLARE
  d public.attendance_kiosk_devices;
  v_match private.attendance_face_match_tokens;
  v_existing public.student_attendance_events;
  v_last public.student_attendance_events;
  v_event_id uuid;
  v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
BEGIN
  IF p_direction NOT IN ('in','out') THEN RETURN jsonb_build_object('ok',false,'reason','invalid_direction'); END IF;
  IF coalesce(length(p_idempotency_key),0)<8 THEN RETURN jsonb_build_object('ok',false,'reason','invalid_request'); END IF;
  d:=public._kiosk_device(p_device_token);
  IF d.id IS NULL THEN RETURN jsonb_build_object('ok',false,'reason','device_not_authorized'); END IF;

  -- Make retries after a network timeout safe without requiring the single-use match token again.
  PERFORM pg_advisory_xact_lock(hashtext('face-idempotency:'||p_idempotency_key));
  SELECT * INTO v_existing FROM public.student_attendance_events WHERE idempotency_key=p_idempotency_key;
  IF v_existing.id IS NOT NULL THEN
    IF v_existing.device_id=d.id AND v_existing.method='face' THEN
      RETURN jsonb_build_object('ok',true,'duplicate',true,'direction',v_existing.direction,'occurred_at',v_existing.occurred_at);
    END IF;
    RETURN jsonb_build_object('ok',false,'reason','idempotency_key_conflict');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('face-token:'||coalesce(p_match_token,'')));
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
  INSERT INTO public.student_attendance_events
    (student_id,direction,branch,device_id,method,confidence,needs_review,review_reason,idempotency_key)
  VALUES
    (v_match.student_id,p_direction,d.branch,d.id,'face',NULL,v_match.match_distance>0.48,
     CASE WHEN v_match.match_distance>0.48 THEN 'Face match near pilot threshold; verify manually' ELSE NULL END,
     p_idempotency_key)
  RETURNING id INTO v_event_id;
  RETURN jsonb_build_object('ok',true,'event_id',v_event_id,'student_ref',v_match.student_id,'direction',p_direction,'occurred_at',now());
END;
$$;
REVOKE ALL ON FUNCTION private.kiosk_record_face(text,text,text,text) FROM PUBLIC, anon, authenticated;
