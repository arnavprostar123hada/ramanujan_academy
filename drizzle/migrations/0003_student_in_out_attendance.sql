CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','owner'))
$$;

-- Kiosk devices (token stored only as SHA-256 hash)
CREATE TABLE public.attendance_kiosk_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  branch text NOT NULL DEFAULT 'Main',
  token_hash text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.attendance_kiosk_devices TO authenticated;
GRANT ALL ON public.attendance_kiosk_devices TO service_role;
ALTER TABLE public.attendance_kiosk_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view kiosk devices" ON public.attendance_kiosk_devices FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff update kiosk devices" ON public.attendance_kiosk_devices FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- Append-only IN/OUT events
CREATE TABLE public.student_attendance_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('in','out','void')),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  attendance_date date NOT NULL DEFAULT ((now() AT TIME ZONE 'Asia/Kolkata')::date),
  branch text NOT NULL DEFAULT 'Main',
  device_id uuid REFERENCES public.attendance_kiosk_devices(id) ON DELETE SET NULL,
  method text NOT NULL CHECK (method IN ('qr','manual_code','face','admin_manual','correction')),
  confidence numeric CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  needs_review boolean NOT NULL DEFAULT false,
  review_reason text,
  actor_user_id uuid,
  override_reason text,
  corrects_event_id uuid REFERENCES public.student_attendance_events(id),
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT void_needs_target CHECK (direction <> 'void' OR (corrects_event_id IS NOT NULL AND override_reason IS NOT NULL)),
  CONSTRAINT staff_override_needs_reason CHECK (method NOT IN ('admin_manual','correction') OR (actor_user_id IS NOT NULL AND override_reason IS NOT NULL))
);
CREATE INDEX idx_sae_student_time ON public.student_attendance_events (student_id, occurred_at DESC);
CREATE INDEX idx_sae_date ON public.student_attendance_events (attendance_date);
GRANT SELECT, INSERT ON public.student_attendance_events TO authenticated;
GRANT ALL ON public.student_attendance_events TO service_role;
ALTER TABLE public.student_attendance_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view attendance events" ON public.student_attendance_events FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff add manual events" ON public.student_attendance_events FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()) AND actor_user_id = auth.uid() AND method IN ('admin_manual','correction'));

-- Append-only audit log
CREATE TABLE public.attendance_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid,
  device_id uuid,
  action text NOT NULL,
  student_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_aal_created ON public.attendance_audit_log (created_at DESC);
GRANT SELECT ON public.attendance_audit_log TO authenticated;
GRANT ALL ON public.attendance_audit_log TO service_role;
ALTER TABLE public.attendance_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view audit log" ON public.attendance_audit_log FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.block_mutation() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'This table is append-only; add a correction instead'; END; $$;
CREATE TRIGGER sae_append_only BEFORE UPDATE OR DELETE ON public.student_attendance_events FOR EACH ROW EXECUTE FUNCTION public.block_mutation();
CREATE TRIGGER aal_append_only BEFORE UPDATE OR DELETE ON public.attendance_audit_log FOR EACH ROW EXECUTE FUNCTION public.block_mutation();

-- Derive daily attendance + audit staff overrides
CREATE OR REPLACE FUNCTION public.sae_after_insert() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.direction = 'in' THEN
    INSERT INTO public.student_attendance (student_id, attendance_date, status, remarks)
    VALUES (NEW.student_id, NEW.attendance_date, 'present', 'Door check-in')
    ON CONFLICT (student_id, attendance_date) DO UPDATE SET status = 'present', remarks = 'Door check-in'
    WHERE public.student_attendance.status = 'absent';
  END IF;
  IF NEW.method IN ('admin_manual','correction') OR NEW.direction = 'void' THEN
    INSERT INTO public.attendance_audit_log (actor_user_id, action, student_id, details)
    VALUES (NEW.actor_user_id, CASE WHEN NEW.direction = 'void' THEN 'event_voided' ELSE 'manual_event' END, NEW.student_id,
      jsonb_build_object('event_id', NEW.id, 'direction', NEW.direction, 'reason', NEW.override_reason, 'corrects', NEW.corrects_event_id, 'occurred_at', NEW.occurred_at));
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER sae_after_insert AFTER INSERT ON public.student_attendance_events FOR EACH ROW EXECUTE FUNCTION public.sae_after_insert();

-- Face consent (status only; no biometric data here)
CREATE TABLE public.student_face_consent (
  student_id uuid PRIMARY KEY REFERENCES public.students(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'not_requested' CHECK (status IN ('not_requested','granted','revoked')),
  guardian_name text,
  notes text,
  recorded_by uuid,
  granted_at timestamptz,
  revoked_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.student_face_consent TO authenticated;
GRANT ALL ON public.student_face_consent TO service_role;
ALTER TABLE public.student_face_consent ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view face consent" ON public.student_face_consent FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- Face templates live outside the API-exposed schema; nothing writes them yet (pending integration)
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
CREATE TABLE private.student_face_templates (
  student_id uuid PRIMARY KEY REFERENCES public.students(id) ON DELETE CASCADE,
  template bytea NOT NULL,
  model text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON private.student_face_templates FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_face_consent(p_student_id uuid, p_status text, p_guardian_name text DEFAULT NULL, p_notes text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_status NOT IN ('granted','revoked') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  IF p_status = 'granted' AND coalesce(trim(p_guardian_name),'') = '' THEN RAISE EXCEPTION 'Guardian name is required for consent'; END IF;
  INSERT INTO public.student_face_consent (student_id, status, guardian_name, notes, recorded_by, granted_at, revoked_at, updated_at)
  VALUES (p_student_id, p_status, p_guardian_name, p_notes, auth.uid(),
          CASE WHEN p_status='granted' THEN now() END, CASE WHEN p_status='revoked' THEN now() END, now())
  ON CONFLICT (student_id) DO UPDATE SET status = EXCLUDED.status,
    guardian_name = coalesce(EXCLUDED.guardian_name, public.student_face_consent.guardian_name),
    notes = EXCLUDED.notes, recorded_by = auth.uid(),
    granted_at = CASE WHEN EXCLUDED.status='granted' THEN now() ELSE public.student_face_consent.granted_at END,
    revoked_at = CASE WHEN EXCLUDED.status='revoked' THEN now() ELSE NULL END,
    updated_at = now();
  IF p_status = 'revoked' THEN
    DELETE FROM private.student_face_templates WHERE student_id = p_student_id;
  END IF;
  INSERT INTO public.attendance_audit_log (actor_user_id, action, student_id, details)
  VALUES (auth.uid(), 'face_consent_' || p_status, p_student_id, jsonb_build_object('guardian', p_guardian_name, 'notes', p_notes, 'template_deleted', p_status = 'revoked'));
END; $$;

CREATE OR REPLACE FUNCTION public.register_kiosk_device(p_name text, p_branch text DEFAULT 'Main')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_token text; v_id uuid;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF coalesce(trim(p_name),'') = '' THEN RAISE EXCEPTION 'Device name required'; END IF;
  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  INSERT INTO public.attendance_kiosk_devices (name, branch, token_hash, created_by)
  VALUES (trim(p_name), coalesce(nullif(trim(p_branch),''),'Main'), encode(extensions.digest(v_token, 'sha256'), 'hex'), auth.uid())
  RETURNING id INTO v_id;
  INSERT INTO public.attendance_audit_log (actor_user_id, device_id, action, details) VALUES (auth.uid(), v_id, 'device_registered', jsonb_build_object('name', p_name, 'branch', p_branch));
  RETURN jsonb_build_object('id', v_id, 'token', v_token);
END; $$;

CREATE OR REPLACE FUNCTION public._kiosk_device(p_token text)
RETURNS public.attendance_kiosk_devices LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
  SELECT * FROM public.attendance_kiosk_devices
  WHERE token_hash = encode(extensions.digest(coalesce(p_token,''), 'sha256'), 'hex') AND is_active LIMIT 1
$$;
REVOKE ALL ON FUNCTION public._kiosk_device(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._kiosk_resolve_student(p_code text)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_code text := trim(coalesce(p_code,'')); v_id uuid;
BEGIN
  IF v_code ILIKE 'RA_ATTENDANCE:%' THEN
    BEGIN v_id := trim(substr(v_code, 15))::uuid; EXCEPTION WHEN others THEN RETURN NULL; END;
    SELECT id INTO v_id FROM public.students WHERE id = v_id;
  ELSIF length(v_code) BETWEEN 6 AND 12 THEN
    SELECT id INTO v_id FROM public.students WHERE access_code = upper(v_code) LIMIT 1;
  END IF;
  RETURN v_id;
END; $$;
REVOKE ALL ON FUNCTION public._kiosk_resolve_student(text) FROM PUBLIC, anon, authenticated;

-- Latest effective (non-voided) event for a student
CREATE OR REPLACE FUNCTION public._last_effective_event(p_student uuid)
RETURNS public.student_attendance_events LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT e.* FROM public.student_attendance_events e
  WHERE e.student_id = p_student AND e.direction <> 'void'
    AND NOT EXISTS (SELECT 1 FROM public.student_attendance_events v WHERE v.direction='void' AND v.corrects_event_id = e.id)
  ORDER BY e.occurred_at DESC LIMIT 1
$$;
REVOKE ALL ON FUNCTION public._last_effective_event(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.kiosk_lookup(p_device_token text, p_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.attendance_kiosk_devices; v_sid uuid; s record; last public.student_attendance_events;
  v_suggest text := 'in'; v_ambiguous boolean := false; v_reason text; v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
BEGIN
  d := public._kiosk_device(p_device_token);
  IF d.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'device_not_authorized'); END IF;
  UPDATE public.attendance_kiosk_devices SET last_seen_at = now() WHERE id = d.id;
  v_sid := public._kiosk_resolve_student(p_code);
  IF v_sid IS NULL THEN
    INSERT INTO public.attendance_audit_log (device_id, action, details) VALUES (d.id, 'kiosk_unknown_code', jsonb_build_object('length', length(coalesce(p_code,''))));
    RETURN jsonb_build_object('ok', false, 'reason', 'unknown');
  END IF;
  SELECT name, class INTO s FROM public.students WHERE id = v_sid;
  last := public._last_effective_event(v_sid);
  IF last.id IS NOT NULL AND last.occurred_at > now() - interval '60 seconds' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'cooldown', 'name', split_part(s.name,' ',1), 'last_direction', last.direction, 'last_at', last.occurred_at);
  END IF;
  IF last.id IS NOT NULL AND last.direction = 'in' THEN
    IF last.attendance_date = v_today THEN v_suggest := 'out';
    ELSE v_suggest := 'in'; v_ambiguous := true; v_reason := 'Previous day has an IN without OUT'; END IF;
  END IF;
  IF last.id IS NOT NULL AND last.occurred_at > now() - interval '10 minutes' THEN
    v_ambiguous := true; v_reason := 'Last scan was only a few minutes ago';
  END IF;
  RETURN jsonb_build_object('ok', true, 'name', s.name, 'class', s.class, 'suggested', v_suggest, 'ambiguous', v_ambiguous,
    'ambiguous_reason', v_reason, 'last_direction', last.direction, 'last_at', last.occurred_at, 'branch', d.branch, 'device', d.name);
END; $$;

CREATE OR REPLACE FUNCTION public.kiosk_record(p_device_token text, p_code text, p_direction text, p_idempotency_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.attendance_kiosk_devices; v_sid uuid; last public.student_attendance_events; ex public.student_attendance_events; v_id uuid; v_name text;
BEGIN
  IF p_direction NOT IN ('in','out') THEN RETURN jsonb_build_object('ok', false, 'reason', 'invalid_direction'); END IF;
  IF coalesce(length(p_idempotency_key),0) < 8 THEN RETURN jsonb_build_object('ok', false, 'reason', 'invalid_request'); END IF;
  d := public._kiosk_device(p_device_token);
  IF d.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'device_not_authorized'); END IF;
  SELECT * INTO ex FROM public.student_attendance_events WHERE idempotency_key = p_idempotency_key;
  IF ex.id IS NOT NULL THEN RETURN jsonb_build_object('ok', true, 'duplicate', true, 'direction', ex.direction, 'occurred_at', ex.occurred_at); END IF;
  v_sid := public._kiosk_resolve_student(p_code);
  IF v_sid IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unknown'); END IF;
  PERFORM pg_advisory_xact_lock(hashtext(v_sid::text));
  last := public._last_effective_event(v_sid);
  IF last.id IS NOT NULL AND last.occurred_at > now() - interval '60 seconds' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'cooldown', 'last_direction', last.direction, 'last_at', last.occurred_at);
  END IF;
  INSERT INTO public.student_attendance_events (student_id, direction, branch, device_id, method, idempotency_key)
  VALUES (v_sid, p_direction, d.branch, d.id, CASE WHEN trim(p_code) ILIKE 'RA_ATTENDANCE:%' THEN 'qr' ELSE 'manual_code' END, p_idempotency_key)
  RETURNING id INTO v_id;
  SELECT name INTO v_name FROM public.students WHERE id = v_sid;
  RETURN jsonb_build_object('ok', true, 'direction', p_direction, 'name', v_name, 'occurred_at', now());
END; $$;

GRANT EXECUTE ON FUNCTION public.kiosk_lookup(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kiosk_record(text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_kiosk_device(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_face_consent(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;

-- Parent-scoped attendance (replaces the open read on student_attendance)
CREATE OR REPLACE FUNCTION public.parent_attendance_by_code(p_access_code text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_sid uuid;
BEGIN
  SELECT id INTO v_sid FROM public.students WHERE access_code = upper(trim(coalesce(p_access_code,''))) LIMIT 1;
  IF v_sid IS NULL THEN RETURN jsonb_build_object('daily', '[]'::jsonb, 'events', '[]'::jsonb); END IF;
  RETURN jsonb_build_object(
    'daily', coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.attendance_date DESC) FROM (SELECT id, student_id, attendance_date, status, remarks, created_at FROM public.student_attendance WHERE student_id = v_sid) a), '[]'::jsonb),
    'events', coalesce((SELECT jsonb_agg(jsonb_build_object('direction', e.direction, 'occurred_at', e.occurred_at) ORDER BY e.occurred_at DESC)
      FROM public.student_attendance_events e WHERE e.student_id = v_sid AND e.direction <> 'void' AND e.occurred_at > now() - interval '30 days'
      AND NOT EXISTS (SELECT 1 FROM public.student_attendance_events v WHERE v.direction='void' AND v.corrects_event_id = e.id)), '[]'::jsonb));
END; $$;
GRANT EXECUTE ON FUNCTION public.parent_attendance_by_code(text) TO anon, authenticated;

DROP POLICY IF EXISTS "Anyone can read student attendance" ON public.student_attendance;
CREATE POLICY "Staff can manage student attendance" ON public.student_attendance FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));