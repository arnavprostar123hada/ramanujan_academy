alter table public.students add column if not exists batch text;
alter table public.leads add column if not exists batch text;
alter table public.enquiries add column if not exists batch text;
alter table public.admissions add column if not exists batch text;
alter table public.class_logs add column if not exists batch text;
alter table public.tests add column if not exists batch text;
alter table public.question_bank add column if not exists batch text;
alter table public.zoom_links add column if not exists batch text;

create index if not exists idx_students_class_batch on public.students(class,batch);
create index if not exists idx_leads_class_batch on public.leads(class,batch);
create index if not exists idx_enquiries_class_batch on public.enquiries(class,batch);
create index if not exists idx_admissions_class_batch on public.admissions(class,batch);
create index if not exists idx_class_logs_class_batch on public.class_logs(class,batch);
create index if not exists idx_tests_class_batch on public.tests(class,batch);
create index if not exists idx_question_bank_class_batch on public.question_bank(class,batch);
create index if not exists idx_zoom_links_class_batch on public.zoom_links(class,batch);