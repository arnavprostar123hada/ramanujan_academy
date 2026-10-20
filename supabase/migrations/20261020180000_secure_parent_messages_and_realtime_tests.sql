-- Secure parent messages with access-code-validated RPCs; do not expose parent_messages via anon table policies.
create or replace function public.get_parent_portal_messages(p_access_code text)
returns table(id uuid,student_id uuid,message text,is_from_parent boolean,is_read boolean,created_at timestamptz)
language sql
security definer
set search_path = public, pg_catalog
as $$
  select pm.id,pm.student_id,pm.message,pm.is_from_parent,pm.is_read,pm.created_at
  from public.parent_messages pm
  join public.students s on s.id=pm.student_id
  where s.status='active' and nullif(btrim(p_access_code),'') is not null
    and upper(btrim(s.access_code))=upper(btrim(p_access_code))
  order by pm.created_at asc;
$$;

create or replace function public.send_parent_portal_message(p_access_code text,p_message text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare v_student_id uuid; v_row public.parent_messages%rowtype;
begin
  if nullif(btrim(p_message),'') is null or length(btrim(p_message))>2000 then
    raise exception 'Message must contain 1 to 2000 characters' using errcode='22023';
  end if;
  select s.id into v_student_id from public.students s
  where s.status='active' and nullif(btrim(p_access_code),'') is not null
    and upper(btrim(s.access_code))=upper(btrim(p_access_code)) limit 1;
  if v_student_id is null then
    raise exception 'Invalid parent portal access code' using errcode='42501';
  end if;
  insert into public.parent_messages(student_id,message,is_from_parent,is_read)
  values(v_student_id,btrim(p_message),true,false) returning * into v_row;
  return jsonb_build_object('id',v_row.id,'student_id',v_row.student_id,'message',v_row.message,
    'is_from_parent',v_row.is_from_parent,'is_read',v_row.is_read,'created_at',v_row.created_at);
end;
$$;

revoke all on function public.get_parent_portal_messages(text) from public;
revoke all on function public.send_parent_portal_message(text,text) from public;
grant execute on function public.get_parent_portal_messages(text) to anon, authenticated;
grant execute on function public.send_parent_portal_message(text,text) to anon, authenticated;

do $$
declare v_table text;
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    foreach v_table in array array['tests','online_tests'] loop
      if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=v_table) then
        execute format('alter publication supabase_realtime add table public.%I',v_table);
      end if;
    end loop;
  end if;
end;
$$;
