-- Enforce one current fee ledger per student and avoid duplicate course pricing rows.
create unique index if not exists fee_structures_academic_class_board_course_unique_idx
  on public.fee_structures(academic_year, class, board, course_name);
create unique index if not exists fee_accounts_one_ledger_per_student_unique_idx
  on public.fee_accounts(student_id);
