-- Show approved test results as parent-portal messages, even if the parent has no WhatsApp number.
create or replace function public.notify_parent_of_approved_test_result()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_student_name text;
  v_test_title text;
  v_subject text;
  v_max_marks numeric;
  v_message text;
begin
  if new.approval_status <> 'approved'
     or (tg_op = 'UPDATE' and old.approval_status = 'approved') then
    return new;
  end if;

  select s.name, t.title, t.subject, t.max_marks
    into v_student_name, v_test_title, v_subject, v_max_marks
  from public.students s
  join public.tests t on t.id = new.test_id
  where s.id = new.student_id;

  v_message := 'Test result published for ' || coalesce(v_student_name, 'your child') ||
    ': ' || coalesce(v_test_title, 'Test') || ' (' || coalesce(v_subject, 'Subject') ||
    '). Marks: ' || coalesce(new.marks_obtained::text, '—') || '/' ||
    coalesce(v_max_marks::text, '—') ||
    case when nullif(btrim(new.remarks), '') is not null then '. Teacher remark: ' || new.remarks else '.' end;

  insert into public.parent_messages(student_id, message, is_from_parent, is_read)
  values (new.student_id, v_message, false, false);
  return new;
end;
$$;

drop trigger if exists trg_notify_parent_approved_test_result on public.test_results;
create trigger trg_notify_parent_approved_test_result
after insert or update of approval_status on public.test_results
for each row execute function public.notify_parent_of_approved_test_result();

revoke execute on function public.notify_parent_of_approved_test_result() from public, anon, authenticated;
