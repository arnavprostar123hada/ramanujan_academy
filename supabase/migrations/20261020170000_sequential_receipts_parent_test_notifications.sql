-- Ramanujan Academy finance receipt numbering and parent test notifications.
-- Receipt numbers are globally sequential: RA261, RA262, RA263...
-- The database trigger is the source of truth; clients must not generate receipt IDs.

insert into public.finance_receipt_sequence(sequence_year, last_value)
values (0, 260)
on conflict (sequence_year) do update
set last_value = greatest(public.finance_receipt_sequence.last_value, 260);

create or replace function public.next_finance_receipt_number(p_payment_date date default current_date)
returns text
language plpgsql
set search_path = public, pg_catalog
as $$
declare
  v_next bigint;
begin
  insert into public.finance_receipt_sequence(sequence_year, last_value)
  values (0, 261)
  on conflict (sequence_year)
  do update set last_value = public.finance_receipt_sequence.last_value + 1
  returning last_value into v_next;

  return 'RA' || v_next::text;
end;
$$;

create or replace function public.notify_parents_of_approved_test()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  r record;
  v_message text;
begin
  if new.approval_status <> 'approved'
     or (tg_op = 'UPDATE' and old.approval_status = 'approved') then
    return new;
  end if;

  v_message := 'New test scheduled: ' || new.title || ' (' || new.subject || ') for Class ' ||
    new.class || ' on ' || to_char(new.test_date, 'DD Mon YYYY') ||
    '. Maximum marks: ' || new.max_marks || '.';

  for r in
    select s.id as student_id, s.name as student_name, s.parent_id,
           p.name as parent_name, coalesce(p.whatsapp_phone, p.phone) as phone
    from public.students s
    left join public.parents p on p.id = s.parent_id
    where s.status = 'active'
      and s.class = new.class
      and s.batch is not distinct from new.batch
      and s.board is not distinct from new.board
  loop
    insert into public.parent_messages(student_id, message, is_from_parent, is_read)
    values (r.student_id, v_message, false, false);

    if r.phone is not null and btrim(r.phone) <> '' then
      insert into public.communication_queue(
        event_key, channel, recipient_type, recipient_name, recipient_phone,
        parent_id, student_id, message, status, requires_approval,
        idempotency_key, template_params
      ) values (
        'test_schedule_published', 'whatsapp', 'parent',
        coalesce(r.parent_name, r.student_name || ' parent'), r.phone,
        r.parent_id, r.student_id, v_message, 'pending', false,
        'test_schedule:' || new.id::text || ':' || r.student_id::text,
        jsonb_build_object('student_name', r.student_name, 'test_title', new.title,
          'subject', new.subject, 'test_date', new.test_date, 'max_marks', new.max_marks)
      ) on conflict (idempotency_key) do nothing;
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_notify_parents_approved_test on public.tests;
create trigger trg_notify_parents_approved_test
after insert or update of approval_status on public.tests
for each row execute function public.notify_parents_of_approved_test();

create or replace function public.notify_parents_of_published_online_test()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  r record;
  v_message text;
begin
  if new.is_published is not true
     or (tg_op = 'UPDATE' and old.is_published is true) then
    return new;
  end if;

  v_message := 'Online test available: ' || new.title || ' (' || new.subject ||
    ') for Class ' || new.class || '. Duration: ' || new.duration_minutes ||
    ' minutes. Maximum marks: ' || new.max_marks ||
    '. Please open the student portal to take the test.';

  for r in
    select s.id as student_id, s.name as student_name, s.parent_id,
           p.name as parent_name, coalesce(p.whatsapp_phone, p.phone) as phone
    from public.students s
    left join public.parents p on p.id = s.parent_id
    where s.status = 'active' and s.class = new.class
  loop
    insert into public.parent_messages(student_id, message, is_from_parent, is_read)
    values (r.student_id, v_message, false, false);

    if r.phone is not null and btrim(r.phone) <> '' then
      insert into public.communication_queue(
        event_key, channel, recipient_type, recipient_name, recipient_phone,
        parent_id, student_id, message, status, requires_approval,
        idempotency_key, template_params
      ) values (
        'online_test_published', 'whatsapp', 'parent',
        coalesce(r.parent_name, r.student_name || ' parent'), r.phone,
        r.parent_id, r.student_id, v_message, 'pending', false,
        'online_test_published:' || new.id::text || ':' || r.student_id::text,
        jsonb_build_object('student_name', r.student_name, 'test_title', new.title,
          'subject', new.subject, 'duration_minutes', new.duration_minutes,
          'max_marks', new.max_marks)
      ) on conflict (idempotency_key) do nothing;
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_notify_parents_published_online_test on public.online_tests;
create trigger trg_notify_parents_published_online_test
after insert or update of is_published on public.online_tests
for each row execute function public.notify_parents_of_published_online_test();
