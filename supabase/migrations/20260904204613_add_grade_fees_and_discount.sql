
-- تخفيض على رسوم الطالب (نسبة مئوية) — مرجعي فقط، لا يُعدَّل تلقائياً على الفواتير الحالية
alter table public.students add column if not exists discount_pct numeric not null default 0;
alter table public.students add constraint students_discount_pct_range check (discount_pct >= 0 and discount_pct <= 100);

-- تسعير المراحل — سعر رسوم سنوي افتراضي لكل مرحلة، يُضبط من الإعدادات ويُستخدم
-- للتعبئة التلقائية عند اختيار المرحلة أثناء تسجيل طالب جديد
create table public.grade_fees (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  grade text not null,
  annual_fee numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(school_id, grade)
);
alter table public.grade_fees enable row level security;

create policy grade_fees_read on public.grade_fees
for select
using (school_id = public.my_school_id());

create policy grade_fees_write on public.grade_fees
for all
using (school_id = public.my_school_id() and public.my_role() in ('owner','admin'))
with check (school_id = public.my_school_id() and public.my_role() in ('owner','admin'));
