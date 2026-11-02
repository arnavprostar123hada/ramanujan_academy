-- AI Paper Setter storage. All saved assessments are staff-owned and protected by RLS.
create table if not exists public.ai_generated_papers (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  title text not null,
  board text not null check (board in ('CBSE','ICSE')),
  class_name text not null,
  subject text not null,
  academic_year text not null default '2026–27',
  total_marks integer not null check (total_marks > 0 and total_marks <= 300),
  duration_minutes integer not null check (duration_minutes > 0 and duration_minutes <= 600),
  difficulty text not null default 'Balanced' check (difficulty in ('Easy','Moderate','Difficult','Balanced')),
  chapters text not null,
  instructions text,
  question_types jsonb not null default '[]'::jsonb,
  questions jsonb not null default '[]'::jsonb,
  answer_key boolean not null default true,
  marking_scheme boolean not null default true,
  status text not null default 'draft' check (status in ('draft','reviewed','approved','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ai_generated_papers_created_by_created_at_idx
  on public.ai_generated_papers (created_by, created_at desc);
create index if not exists ai_generated_papers_board_class_idx
  on public.ai_generated_papers (board, class_name, subject);
alter table public.ai_generated_papers enable row level security;
drop policy if exists "staff manage own generated papers" on public.ai_generated_papers;
create policy "staff manage own generated papers" on public.ai_generated_papers
for all to authenticated
using (
  created_by = auth.uid()
  and exists (
    select 1 from public.user_profiles p
    where p.id = auth.uid() and p.active = true
      and p.role in ('owner','admin','teacher')
  )
)
with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.user_profiles p
    where p.id = auth.uid() and p.active = true
      and p.role in ('owner','admin','teacher')
  )
);
