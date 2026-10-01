-- Ramanujan Academy: academic automation layer
-- Audit teacher reports and approved class logs; create targeted academic
-- interventions from approved test results below the 60% threshold.

create index if not exists idx_automation_events_student_created
  on public.automation_events(student_id, created_at desc);

create index if not exists idx_academic_interventions_student_status
  on public.academic_interventions(student_id, status);

create or replace function public.queue_academic_automation_event()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
declare
  pct numeric;
  t record;
  existing_id uuid;
begin
  if new.approval_status <> 'approved' then
    return new;
  end if;

  select subject, title, max_marks
    into t
  from public.tests
  where id = new.test_id;

  if t.max_marks is null or t.max_marks <= 0 then
    return new;
  end if;

  pct := round((new.marks_obtained / t.max_marks::numeric) * 100, 2);

  insert into public.automation_events(event_key, entity_type, entity_id, student_id, payload)
  values (
    'test_result_approved',
    'test_results',
    new.id,
    new.student_id,
    jsonb_build_object(
      'test_id', new.test_id,
      'test_title', t.title,
      'subject', t.subject,
      'marks_obtained', new.marks_obtained,
      'max_marks', t.max_marks,
      'percentage', pct
    )
  );

  if pct < 60 then
    select ai.id
      into existing_id
    from public.academic_interventions ai
    where ai.student_id = new.student_id
      and coalesce(ai.subject, '') = coalesce(t.subject, '')
      and ai.status in ('open', 'in_progress')
    order by ai.created_at desc
    limit 1;

    if existing_id is null then
      insert into public.academic_interventions(
        student_id, subject, reason, current_level, target_level,
        action_plan, parent_informed, status, next_review_date
      )
      values (
        new.student_id,
        t.subject,
        format(
          'Test "%s" score is %s%%, below the 60%% intervention threshold.',
          t.title, pct
        ),
        case
          when pct < 40 then 'Needs immediate support'
          when pct < 50 then 'Below expected level'
          else 'Needs improvement'
        end,
        '60%+',
        'Teacher review → targeted practice → follow-up assessment',
        false,
        'open',
        current_date + 14
      )
      returning id into existing_id;
    end if;

    insert into public.automation_events(
      event_key, entity_type, entity_id, student_id, payload
    )
    values (
      'academic_intervention_created',
      'academic_interventions',
      existing_id,
      new.student_id,
      jsonb_build_object(
        'test_result_id', new.id,
        'subject', t.subject,
        'percentage', pct,
        'threshold', 60
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_test_result_academic_automation on public.test_results;
create trigger trg_test_result_academic_automation
after insert or update of approval_status, marks_obtained on public.test_results
for each row execute function public.queue_academic_automation_event();

create or replace function public.audit_teacher_daily_report()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  insert into public.automation_events(
    event_key, entity_type, entity_id, payload
  )
  values (
    'teacher_daily_report_submitted',
    'teacher_daily_reports',
    new.id,
    jsonb_build_object(
      'teacher_id', new.teacher_id,
      'report_date', new.report_date,
      'classes_taken', new.classes_taken,
      'topics_completed', new.topics_completed,
      'students_needing_attention', new.students_needing_attention
    )
  );
  return new;
end;
$$;

drop trigger if exists trg_teacher_daily_report_automation on public.teacher_daily_reports;
create trigger trg_teacher_daily_report_automation
after insert on public.teacher_daily_reports
for each row execute function public.audit_teacher_daily_report();

create or replace function public.audit_approved_class_log()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  if new.approval_status = 'approved'
     and (tg_op = 'INSERT' or old.approval_status is distinct from new.approval_status) then
    insert into public.automation_events(
      event_key, entity_type, entity_id, payload
    )
    values (
      'class_log_approved',
      'class_logs',
      new.id,
      jsonb_build_object(
        'teacher_id', new.teacher_id,
        'class', new.class,
        'batch', new.batch,
        'board', new.board,
        'subject', new.subject,
        'topic', new.topic,
        'homework', new.homework,
        'log_date', new.log_date
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_class_log_automation on public.class_logs;
create trigger trg_class_log_automation
after insert or update of approval_status on public.class_logs
for each row execute function public.audit_approved_class_log();
