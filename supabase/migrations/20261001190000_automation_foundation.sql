-- Ramanujan Academy: automation foundation
-- Adds idempotent communication dispatch metadata, event audit, event-driven
-- parent notifications, and hourly due-date queue generation.

create extension if not exists pg_cron;

alter table public.communication_queue
  add column if not exists idempotency_key text,
  add column if not exists template_params jsonb not null default '{}'::jsonb,
  add column if not exists attempts integer not null default 0,
  add column if not exists next_attempt_at timestamptz,
  add column if not exists last_attempt_at timestamptz;

create unique index if not exists uq_communication_queue_idempotency
  on public.communication_queue(idempotency_key)
  where idempotency_key is not null;

create index if not exists idx_communication_queue_dispatch
  on public.communication_queue(status,next_attempt_at,created_at)
  where status in ('pending','approved');

create table if not exists public.automation_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null,
  entity_type text,
  entity_id uuid,
  student_id uuid,
  payload jsonb not null default '{}'::jsonb,
  processed boolean not null default false,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists idx_automation_events_pending
  on public.automation_events(processed,created_at);

alter table public.automation_events enable row level security;
drop policy if exists "automation events insert authenticated" on public.automation_events;
create policy "automation events insert authenticated"
  on public.automation_events for insert to authenticated with check (true);
revoke select, update, delete on public.automation_events from anon, authenticated;
grant insert on public.automation_events to authenticated;
grant all on public.automation_events to service_role;

create or replace function public.enqueue_automation_event(
  p_event_key text,
  p_entity_type text default null,
  p_entity_id uuid default null,
  p_student_id uuid default null,
  p_payload jsonb default '{}'::jsonb
) returns uuid
language plpgsql
set search_path = public, pg_catalog
as $
declare v_id uuid;
begin
  insert into public.automation_events(event_key,entity_type,entity_id,student_id,payload)
  values(p_event_key,p_entity_type,p_entity_id,p_student_id,coalesce(p_payload,'{}'::jsonb))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.queue_student_absence_whatsapp()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $
declare
  v_phone text; v_name text; v_parent_id uuid; v_key text;
begin
  if new.status not in ('absent','leave') then return new; end if;

  select s.name,p.id,coalesce(p.whatsapp_phone,p.phone)
    into v_name,v_parent_id,v_phone
  from public.students s
  left join public.parents p on p.id=s.parent_id
  where s.id=new.student_id;

  if v_phone is null or btrim(v_phone)='' then return new; end if;

  v_key:='student_absence:'||new.student_id::text||':'||new.attendance_date::text;

  insert into public.communication_queue(
    event_key,channel,recipient_type,recipient_name,recipient_phone,
    parent_id,student_id,message,status,requires_approval,idempotency_key,template_params
  )
  values(
    'student_absence','whatsapp','parent',v_name,v_phone,v_parent_id,new.student_id,
    'Attendance update: '||v_name||' was marked absent on '||to_char(new.attendance_date,'DD Mon YYYY')||'.',
    'pending',false,v_key,
    jsonb_build_object('student_name',v_name,'attendance_date',new.attendance_date)
  )
  on conflict(idempotency_key) do nothing;

  perform public.enqueue_automation_event(
    'student_absence','student_attendance',new.id,new.student_id,
    jsonb_build_object('attendance_date',new.attendance_date,'status',new.status)
  );
  return new;
end;
$$;

drop trigger if exists trg_queue_student_absence on public.student_attendance;
create trigger trg_queue_student_absence
after insert or update of status on public.student_attendance
for each row execute function public.queue_student_absence_whatsapp();

create or replace function public.queue_test_result_whatsapp()
returns trigger
language plpgsql
as $$
declare
  v_phone text; v_name text; v_parent_id uuid; v_key text;
begin
  if new.approval_status<>'approved' then return new; end if;

  select s.name,p.id,coalesce(p.whatsapp_phone,p.phone)
    into v_name,v_parent_id,v_phone
  from public.students s
  left join public.parents p on p.id=s.parent_id
  where s.id=new.student_id;

  if v_phone is null or btrim(v_phone)='' then return new; end if;

  v_key:='test_result:'||new.id::text;

  insert into public.communication_queue(
    event_key,channel,recipient_type,recipient_name,recipient_phone,
    parent_id,student_id,message,status,requires_approval,idempotency_key,template_params
  )
  values(
    'test_result_published','whatsapp','parent',v_name,v_phone,v_parent_id,new.student_id,
    'Test result available for '||v_name||'. Marks: '||new.marks_obtained::text||'.',
    'pending',false,v_key,
    jsonb_build_object('student_name',v_name,'marks',new.marks_obtained,'test_result_id',new.id)
  )
  on conflict(idempotency_key) do nothing;

  perform public.enqueue_automation_event(
    'test_result_published','test_result',new.id,new.student_id,
    jsonb_build_object('marks',new.marks_obtained,'approval_status',new.approval_status)
  );
  return new;
end;
$$;

drop trigger if exists trg_queue_test_result on public.test_results;
create trigger trg_queue_test_result
after update of approval_status on public.test_results
for each row execute function public.queue_test_result_whatsapp();

create or replace function public.queue_due_automations()
returns void
language plpgsql
set search_path = public, pg_catalog
as $
declare
  r record; v_phone text; v_name text; v_parent_id uuid; v_key text; v_days integer;
begin
  for r in
    select fi.id,fi.due_date,fi.amount,fi.paid_amount,fa.student_id
    from public.fee_installments fi
    join public.fee_accounts fa on fa.id=fi.fee_account_id
    where fi.status in('pending','partial')
      and fi.due_date between current_date and current_date+7
      and fi.amount>fi.paid_amount
  loop
    select s.name,p.id,coalesce(p.whatsapp_phone,p.phone)
      into v_name,v_parent_id,v_phone
    from public.students s left join public.parents p on p.id=s.parent_id
    where s.id=r.student_id;

    if v_phone is not null and btrim(v_phone)<>'' then
      v_days:=r.due_date-current_date;
      v_key:='fee_due:'||r.id::text||':'||r.due_date::text||':'||v_days::text;

      insert into public.communication_queue(
        event_key,channel,recipient_type,recipient_name,recipient_phone,
        parent_id,student_id,message,status,requires_approval,idempotency_key,template_params
      )
      values(
        case when v_days=0 then 'fee_due_today'
             when v_days=1 then 'fee_due_1_day'
             when v_days=3 then 'fee_due_3_days'
             when v_days=7 then 'fee_due_7_days'
             else 'fee_due_upcoming' end,
        'whatsapp','parent',v_name,v_phone,v_parent_id,r.student_id,
        'Fee reminder for '||v_name||': ₹'||(r.amount-r.paid_amount)::text||
        ' is pending, due '||to_char(r.due_date,'DD Mon YYYY')||'.',
        'pending',false,v_key,
        jsonb_build_object(
          'student_name',v_name,
          'amount_due',r.amount-r.paid_amount,
          'due_date',r.due_date,
          'days_remaining',v_days
        )
      )
      on conflict(idempotency_key) do nothing;
    end if;
  end loop;

  for r in
    select rn.id,rn.student_id,rn.due_date,rn.expected_fee
    from public.renewals rn
    where rn.status='open'
      and rn.due_date between current_date and current_date+30
  loop
    select s.name,p.id,coalesce(p.whatsapp_phone,p.phone)
      into v_name,v_parent_id,v_phone
    from public.students s left join public.parents p on p.id=s.parent_id
    where s.id=r.student_id;

    if v_phone is not null and btrim(v_phone)<>'' then
      v_days:=r.due_date-current_date;
      if v_days in(30,14,7,3,1,0) then
        v_key:='renewal_due:'||r.id::text||':'||r.due_date::text||':'||v_days::text;

        insert into public.communication_queue(
          event_key,channel,recipient_type,recipient_name,recipient_phone,
          parent_id,student_id,message,status,requires_approval,idempotency_key,template_params
        )
        values(
          case when v_days=0 then 'renewal_due_today'
               else 'renewal_due_'||v_days::text||'_days' end,
          'whatsapp','parent',v_name,v_phone,v_parent_id,r.student_id,
          'Renewal reminder for '||v_name||': the next program renewal is due '||
          to_char(r.due_date,'DD Mon YYYY')||'.',
          'pending',false,v_key,
          jsonb_build_object(
            'student_name',v_name,'due_date',r.due_date,
            'days_remaining',v_days,'expected_fee',r.expected_fee
          )
        )
        on conflict(idempotency_key) do nothing;
      end if;
    end if;
  end loop;
end;
$$;

do $$
begin
  if not exists(
    select 1 from cron.job where jobname='ramanujan-due-automations-hourly'
  ) then
    perform cron.schedule(
      'ramanujan-due-automations-hourly',
      '0 * * * *',
      'select public.queue_due_automations();'
    );
  end if;
end;
$$;
