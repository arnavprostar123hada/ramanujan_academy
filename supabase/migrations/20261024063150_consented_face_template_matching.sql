ALTER TABLE private.student_face_templates
  ADD COLUMN IF NOT EXISTS descriptor jsonb;

CREATE OR REPLACE FUNCTION public.save_student_face_template(
  p_student_id uuid, p_descriptor jsonb, p_model text DEFAULT 'browser-face-descriptor-v1'
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, pg_catalog
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Only authenticated staff can enroll a face template';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.students WHERE id=p_student_id AND status='active') THEN
    RAISE EXCEPTION 'Student is not active';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.student_face_consent WHERE student_id=p_student_id AND status='granted') THEN
    RAISE EXCEPTION 'Recorded parent/guardian consent is required before face enrollment';
  END IF;
  IF jsonb_typeof(p_descriptor) <> 'array' OR jsonb_array_length(p_descriptor) <> 128 THEN
    RAISE EXCEPTION 'Face descriptor must contain exactly 128 numeric values';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_descriptor) AS d(v) WHERE jsonb_typeof(v) <> 'number') THEN
    RAISE EXCEPTION 'Face descriptor contains invalid values';
  END IF;

  INSERT INTO private.student_face_templates(student_id,template,model,descriptor,created_at)
  VALUES (p_student_id,convert_to(p_descriptor::text,'UTF8'),coalesce(nullif(trim(p_model),''),'browser-face-descriptor-v1'),p_descriptor,now())
  ON CONFLICT(student_id) DO UPDATE SET template=EXCLUDED.template,model=EXCLUDED.model,descriptor=EXCLUDED.descriptor,created_at=now();

  INSERT INTO public.attendance_audit_log(actor_user_id,action,student_id,details)
  VALUES(auth.uid(),'face_template_enrolled',p_student_id,
    jsonb_build_object('model',p_model,'dimensions',jsonb_array_length(p_descriptor),'raw_image_stored',false));
END;
$$;
REVOKE ALL ON FUNCTION public.save_student_face_template(uuid,jsonb,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_student_face_template(uuid,jsonb,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.match_attendance_face(
  p_device_token text, p_descriptor jsonb, p_threshold double precision DEFAULT 0.60
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, pg_catalog
AS $$
DECLARE d public.attendance_kiosk_devices; v_best record;
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
  RETURN jsonb_build_object('ok',true,'student_ref',v_best.student_id,'match_distance',round(v_best.distance::numeric,4));
END;
$$;
REVOKE ALL ON FUNCTION public.match_attendance_face(text,jsonb,double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_attendance_face(text,jsonb,double precision) TO anon,authenticated;

CREATE OR REPLACE FUNCTION public.kiosk_record_face(
  p_device_token text,p_student_id uuid,p_direction text,p_match_distance double precision,p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, pg_catalog
AS $$
DECLARE d public.attendance_kiosk_devices; last public.student_attendance_events; ex public.student_attendance_events; v_id uuid;
  v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
BEGIN
  IF p_direction NOT IN ('in','out') THEN RETURN jsonb_build_object('ok',false,'reason','invalid_direction'); END IF;
  IF coalesce(length(p_idempotency_key),0)<8 THEN RETURN jsonb_build_object('ok',false,'reason','invalid_request'); END IF;
  d:=public._kiosk_device(p_device_token); IF d.id IS NULL THEN RETURN jsonb_build_object('ok',false,'reason','device_not_authorized'); END IF;
  SELECT * INTO ex FROM public.student_attendance_events WHERE idempotency_key=p_idempotency_key;
  IF ex.id IS NOT NULL THEN RETURN jsonb_build_object('ok',true,'duplicate',true,'direction',ex.direction,'occurred_at',ex.occurred_at); END IF;
  IF NOT EXISTS(SELECT 1 FROM public.students s
    JOIN public.student_face_consent c ON c.student_id=s.id AND c.status='granted'
    JOIN private.student_face_templates t ON t.student_id=s.id AND t.descriptor IS NOT NULL
    WHERE s.id=p_student_id AND s.status='active') THEN
    RETURN jsonb_build_object('ok',false,'reason','face_consent_or_template_missing');
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext(p_student_id::text));
  last:=public._last_effective_event(p_student_id);
  IF last.id IS NOT NULL AND last.occurred_at>now()-interval '60 seconds' THEN RETURN jsonb_build_object('ok',false,'reason','cooldown'); END IF;
  IF last.id IS NOT NULL AND last.attendance_date=v_today AND last.direction=p_direction THEN
    RETURN jsonb_build_object('ok',false,'reason','duplicate_direction','last_direction',last.direction);
  END IF;
  INSERT INTO public.student_attendance_events(student_id,direction,branch,device_id,method,confidence,needs_review,review_reason,idempotency_key)
  VALUES(p_student_id,p_direction,d.branch,d.id,'face',NULL,coalesce(p_match_distance,1)>0.48,
    CASE WHEN coalesce(p_match_distance,1)>0.48 THEN 'Face match near pilot threshold; verify manually' ELSE NULL END,p_idempotency_key)
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('ok',true,'event_id',v_id,'direction',p_direction,'occurred_at',now());
END;
$$;
REVOKE ALL ON FUNCTION public.kiosk_record_face(text,uuid,text,double precision,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kiosk_record_face(text,uuid,text,double precision,text) TO anon,authenticated;
