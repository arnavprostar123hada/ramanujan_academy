-- Provider template parameters must be ordered arrays; JSON object values were discarded by the worker.
create or replace function public.notify_parents_of_approved_test()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare r record; v_message text;
begin
  if new.approval_status <> 'approved'
     or (tg_op = 'UPDATE' and old.approval_status = 'approved') then return new; end if;
  v_message := 'New test scheduled: ' || new.title || ' (' || new.subject || ') for Class ' ||
    new.class || ' on ' || to_char(new.test_date, 'DD Mon YYYY') || '. Maximum marks: ' || new.max_marks || '.';
  for r in
    select s.id as student_id,s.name as student_name,s.parent_id,p.name as parent_name,
           coalesce(p.whatsapp_phone,p.phone) as phone
    from public.students s left join public.parents p on p.id=s.parent_id
    where s.status='active' and s.class=new.class
      and s.batch is not distinct from new.batch and s.board is not distinct from new.board
  loop
    insert into public.parent_messages(student_id,message,is_from_parent,is_read)
    values(r.student_id,v_message,false,false);
    if r.phone is not null and btrim(r.phone)<>'' then
      insert into public.communication_queue(
        event_key,channel,recipient_type,recipient_name,recipient_phone,parent_id,student_id,
        message,status,requires_approval,idempotency_key,template_params
      ) values(
        'test_schedule_published','whatsapp','parent',coalesce(r.parent_name,r.student_name||' parent'),
        r.phone,r.parent_id,r.student_id,v_message,'pending',false,
        'test_schedule:'||new.id::text||':'||r.student_id::text,
        jsonb_build_array(r.student_name,new.title,new.subject,to_char(new.test_date,'DD Mon YYYY'),new.max_marks::text)
      ) on conflict(idempotency_key) do nothing;
    end if;
  end loop;
  return new;
end;
$$;

create or replace function public.notify_parents_of_published_online_test()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare r record; v_message text;
begin
  if new.is_published is not true
     or (tg_op = 'UPDATE' and old.is_published is true) then return new; end if;
  v_message := 'Online test available: '||new.title||' ('||new.subject||') for Class '||new.class||
    '. Duration: '||new.duration_minutes||' minutes. Maximum marks: '||new.max_marks||
    '. Please open the student portal to take the test.';
  for r in
    select s.id as student_id,s.name as student_name,s.parent_id,p.name as parent_name,
           coalesce(p.whatsapp_phone,p.phone) as phone
    from public.students s left join public.parents p on p.id=s.parent_id
    where s.status='active' and s.class=new.class
  loop
    insert into public.parent_messages(student_id,message,is_from_parent,is_read)
    values(r.student_id,v_message,false,false);
    if r.phone is not null and btrim(r.phone)<>'' then
      insert into public.communication_queue(
        event_key,channel,recipient_type,recipient_name,recipient_phone,parent_id,student_id,
        message,status,requires_approval,idempotency_key,template_params
      ) values(
        'online_test_published','whatsapp','parent',coalesce(r.parent_name,r.student_name||' parent'),
        r.phone,r.parent_id,r.student_id,v_message,'pending',false,
        'online_test_published:'||new.id::text||':'||r.student_id::text,
        jsonb_build_array(r.student_name,new.title,new.subject,new.duration_minutes::text,new.max_marks::text)
      ) on conflict(idempotency_key) do nothing;
    end if;
  end loop;
  return new;
end;
$$;

create or replace function public.queue_test_result_whatsapp()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_phone text; v_name text; v_parent_id uuid; v_test_title text; v_subject text;
  v_max_marks numeric; v_key text; v_message text;
begin
  if new.approval_status <> 'approved'
     or (tg_op = 'UPDATE' and old.approval_status = 'approved') then return new; end if;
  select s.name,p.id,coalesce(p.whatsapp_phone,p.phone),t.title,t.subject,t.max_marks
    into v_name,v_parent_id,v_phone,v_test_title,v_subject,v_max_marks
  from public.students s left join public.parents p on p.id=s.parent_id
  join public.tests t on t.id=new.test_id where s.id=new.student_id;
  if v_phone is null or btrim(v_phone)='' then return new; end if;
  v_key:='test_result:'||new.id::text;
  v_message:='Test result available for '||v_name||'. Marks: '||new.marks_obtained::text||'/'||
    coalesce(v_max_marks::text,'—')||'.';
  insert into public.communication_queue(
    event_key,channel,recipient_type,recipient_name,recipient_phone,parent_id,student_id,
    message,status,requires_approval,idempotency_key,template_params
  ) values(
    'test_result_published','whatsapp','parent',v_name,v_phone,v_parent_id,new.student_id,
    v_message,'pending',false,v_key,
    jsonb_build_array(v_name,v_test_title,v_subject,new.marks_obtained::text,
      coalesce(v_max_marks::text,''),coalesce(new.remarks,''))
  ) on conflict(idempotency_key) do nothing;
  perform public.enqueue_automation_event('test_result_published','test_result',new.id,new.student_id,
    jsonb_build_object('marks',new.marks_obtained,'approval_status',new.approval_status));
  return new;
end;
$$;

revoke execute on function public.notify_parents_of_approved_test() from public, anon, authenticated;
revoke execute on function public.notify_parents_of_published_online_test() from public, anon, authenticated;
revoke execute on function public.queue_test_result_whatsapp() from public, anon, authenticated;
