alter table public.students add column if not exists board text;
alter table public.leads add column if not exists board text;
alter table public.enquiries add column if not exists board text;
alter table public.admissions add column if not exists board text;
alter table public.class_logs add column if not exists board text;
alter table public.tests add column if not exists board text;
alter table public.question_bank add column if not exists board text;
alter table public.zoom_links add column if not exists board text;

create index if not exists idx_students_class_batch_board on public.students(class,batch,board);
create index if not exists idx_leads_class_batch_board on public.leads(class,batch,board);
create index if not exists idx_enquiries_class_batch_board on public.enquiries(class,batch,board);
create index if not exists idx_admissions_class_batch_board on public.admissions(class,batch,board);
create index if not exists idx_class_logs_class_batch_board on public.class_logs(class,batch,board);
create index if not exists idx_tests_class_batch_board on public.tests(class,batch,board);
create index if not exists idx_question_bank_class_batch_board on public.question_bank(class,batch,board);
create index if not exists idx_zoom_links_class_batch_board on public.zoom_links(class,batch,board);