-- Restore scoped parent attendance summaries and add authenticated online-student counts.
REVOKE ALL ON FUNCTION public.parent_attendance_by_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.parent_attendance_by_code(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.online_student_attendance_summary()
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT count(DISTINCT a.attendance_date)::integer
  FROM public.online_students os
  JOIN public.student_attendance a ON a.student_id = os.student_id
  WHERE os.user_id = auth.uid()
    AND a.status = 'present'
    AND auth.uid() IS NOT NULL
$$;
REVOKE ALL ON FUNCTION public.online_student_attendance_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.online_student_attendance_summary() TO authenticated;

CREATE OR REPLACE FUNCTION public.parent_attendance_by_code(p_access_code text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_sid uuid;
BEGIN
 SELECT id INTO v_sid FROM public.students
 WHERE access_code=upper(trim(coalesce(p_access_code,''))) AND status='active' LIMIT 1;
 IF v_sid IS NULL THEN RETURN jsonb_build_object('daily','[]'::jsonb,'events','[]'::jsonb); END IF;
 RETURN jsonb_build_object(
 'daily',coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.attendance_date DESC)
   FROM (SELECT id,student_id,attendance_date,status,remarks,created_at FROM public.student_attendance WHERE student_id=v_sid) a),'[]'::jsonb),
 'events',coalesce((SELECT jsonb_agg(jsonb_build_object('direction',e.direction,'occurred_at',e.occurred_at) ORDER BY e.occurred_at DESC)
   FROM public.student_attendance_events e
   WHERE e.student_id=v_sid AND e.direction<>'void' AND e.occurred_at>now()-interval '30 days'
    AND NOT EXISTS(SELECT 1 FROM public.student_attendance_events v WHERE v.direction='void' AND v.corrects_event_id=e.id)),'[]'::jsonb));
END; $$;
REVOKE ALL ON FUNCTION public.parent_attendance_by_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.parent_attendance_by_code(text) TO anon,authenticated;

-- Arrival and departure are queued in the existing WhatsApp engine. Actual delivery requires configured AiSensy credentials/campaign.
INSERT INTO public.communication_templates(name,channel,category,body,active,event_key,requires_approval)
SELECT 'Student Arrival Alert','whatsapp','attendance',
       'Dear Parent, {{student_name}} has arrived at Ramanujan Academy at {{event_time}}.',
       true,'student_arrival',false
WHERE NOT EXISTS (SELECT 1 FROM public.communication_templates WHERE event_key='student_arrival' AND channel='whatsapp');
INSERT INTO public.communication_templates(name,channel,category,body,active,event_key,requires_approval)
SELECT 'Student Departure Alert','whatsapp','attendance',
       'Dear Parent, {{student_name}} left Ramanujan Academy at {{event_time}}.',
       true,'student_departure',false
WHERE NOT EXISTS (SELECT 1 FROM public.communication_templates WHERE event_key='student_departure' AND channel='whatsapp');

CREATE OR REPLACE FUNCTION public.sae_after_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
DECLARE
  v_phone text; v_parent_id uuid; v_parent_name text; v_student_name text;
  v_event_key text; v_event_time text; v_template_id uuid; v_template_body text; v_message text;
BEGIN
  IF NEW.direction = 'in' THEN
    INSERT INTO public.student_attendance(student_id,attendance_date,status,remarks)
    VALUES(NEW.student_id,NEW.attendance_date,'present','Door check-in')
    ON CONFLICT(student_id,attendance_date) DO UPDATE SET status='present',remarks='Door check-in'
    WHERE public.student_attendance.status='absent';
  END IF;

  IF NEW.method IN ('admin_manual','correction') OR NEW.direction='void' THEN
    INSERT INTO public.attendance_audit_log(actor_user_id,action,student_id,details)
    VALUES(NEW.actor_user_id,CASE WHEN NEW.direction='void' THEN 'event_voided' ELSE 'manual_event' END,
      NEW.student_id,jsonb_build_object('event_id',NEW.id,'direction',NEW.direction,'reason',NEW.override_reason,
      'corrects',NEW.corrects_event_id,'occurred_at',NEW.occurred_at));
  END IF;

  IF NEW.direction IN ('in','out') THEN
    SELECT s.name,p.id,coalesce(p.whatsapp_phone,p.phone),p.name
      INTO v_student_name,v_parent_id,v_phone,v_parent_name
    FROM public.students s LEFT JOIN public.parents p ON p.id=s.parent_id WHERE s.id=NEW.student_id;

    v_event_key:=CASE WHEN NEW.direction='in' THEN 'student_arrival' ELSE 'student_departure' END;
    v_event_time:=to_char(NEW.occurred_at AT TIME ZONE 'Asia/Kolkata','DD Mon YYYY, HH12:MI AM');
    SELECT id,body INTO v_template_id,v_template_body
      FROM public.communication_templates
      WHERE event_key=v_event_key AND channel='whatsapp' AND active=true
      ORDER BY updated_at DESC LIMIT 1;

    v_message:=coalesce(v_template_body,
      CASE WHEN NEW.direction='in'
        THEN 'Dear Parent, '||coalesce(v_student_name,'Your child')||' has arrived at Ramanujan Academy at '||v_event_time||'.'
        ELSE 'Dear Parent, '||coalesce(v_student_name,'Your child')||' left Ramanujan Academy at '||v_event_time||'.'
      END);
    v_message:=replace(replace(v_message,'{{student_name}}',coalesce(v_student_name,'Your child')),'{{event_time}}',v_event_time);

    IF v_phone IS NOT NULL AND btrim(v_phone)<>'' THEN
      INSERT INTO public.communication_queue
        (event_key,channel,recipient_type,recipient_name,recipient_phone,parent_id,student_id,template_id,message,
         status,requires_approval,idempotency_key,template_params)
      VALUES
        (v_event_key,'whatsapp','parent',coalesce(v_parent_name,coalesce(v_student_name,'Parent')),v_phone,v_parent_id,NEW.student_id,
         v_template_id,v_message,'pending',false,'attendance_event:'||NEW.id::text,
         jsonb_build_array(coalesce(v_student_name,'Your child'),v_event_time))
      ON CONFLICT(idempotency_key) DO NOTHING;
    END IF;

    PERFORM public.enqueue_automation_event(v_event_key,'student_attendance_event',NEW.id,NEW.student_id,
      jsonb_build_object('direction',NEW.direction,'occurred_at',NEW.occurred_at,'attendance_date',NEW.attendance_date,'branch',NEW.branch));
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.sae_after_insert() FROM PUBLIC, anon, authenticated;
