-- Seed the agreed 2026-27 Ramanujan Academy fee chart.
-- Idempotent: existing structures are preserved and not duplicated.
with seed(class,board,course_name,fee_amount) as (
  values
    ('10th','CBSE','Full Course',65000::numeric),
    ('10th','CBSE','Maths Only',25000::numeric),
    ('10th','CBSE','Science Only',25000::numeric),
    ('10th','CBSE','Maths + Science',50000::numeric),
    ('10th','ICSE','PCMB Full Course',65000::numeric),
    ('10th','SSC','Full Course',50000::numeric),
    ('9th','CBSE','Full Course',55000::numeric),
    ('9th','CBSE','Maths Only',25000::numeric),
    ('9th','CBSE','Maths + Science',45000::numeric),
    ('9th','ICSE','PCMB Full Course',55000::numeric),
    ('9th','ICSE','Maths Only',25000::numeric),
    ('9th','ICSE','Physics Only',20000::numeric),
    ('9th','ICSE','Chemistry Only',20000::numeric),
    ('9th','ICSE','Biology Only',20000::numeric),
    ('9th','SSC','Full Course',45000::numeric),
    ('8th','CBSE','Full Course',50000::numeric),
    ('8th','CBSE','Maths Only',20000::numeric),
    ('8th','CBSE','Maths + Science',35000::numeric),
    ('8th','ICSE','Full Course',50000::numeric),
    ('8th','SSC','Full Course',40000::numeric),
    ('7th','CBSE','Full Course',40000::numeric),
    ('7th','CBSE','Maths Only',18000::numeric),
    ('7th','ICSE','Full Course',40000::numeric),
    ('7th','SSC','Full Course',35000::numeric),
    ('6th','CBSE','Full Course',35000::numeric),
    ('6th','SSC','Full Course',30000::numeric),
    ('5th','CBSE','Full Course',30000::numeric),
    ('5th','ICSE','Full Course',30000::numeric),
    ('5th','SSC','Full Course',25000::numeric)
)
insert into public.fee_structures(academic_year,class,board,course_name,fee_amount,currency,is_active,effective_from)
select '2026-27',s.class,s.board,s.course_name,s.fee_amount,'INR',true,current_date
from seed s
where not exists (
  select 1 from public.fee_structures f
  where f.academic_year='2026-27' and f.class=s.class and f.board=s.board and f.course_name=s.course_name
);
