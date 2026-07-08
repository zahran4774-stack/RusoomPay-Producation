-- ============================================================================
-- EduPay — بوابة ولي الأمر (Parent Portal)
-- ولي الأمر: يشاهد رسوم أبنائه، يدفع، يحمّل الإيصالات، يتابع الإشعارات
-- ينفّذ بعد 01..17
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) ربط حساب ولي الأمر بأبنائه (جدول وصل — ولي أمر واحد لعدة أبناء)
-- ----------------------------------------------------------------------------
create table if not exists public.parent_students (
  id          uuid primary key default uuid_generate_v4(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  parent_id   uuid not null references public.profiles(id) on delete cascade,
  student_id  uuid not null references public.students(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (parent_id, student_id)
);
create index if not exists idx_parent_students_parent on public.parent_students(parent_id);
create index if not exists idx_parent_students_school on public.parent_students(school_id);

alter table public.parent_students enable row level security;

-- طاقم المدرسة يدير الربط؛ ولي الأمر يقرأ ربطه فقط
create policy ps_staff_rw on public.parent_students
  for all using (school_id = public.my_school_id() and public.my_role() in ('owner','admin','accountant'))
  with check (school_id = public.my_school_id() and public.my_role() in ('owner','admin','accountant'));
create policy ps_parent_read on public.parent_students
  for select using (parent_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 2) السماح لولي الأمر بقراءة بيانات أبنائه (طلاب + رسوم)
--    سياسات إضافية على الجداول الموجودة دون المساس بسياسات الطاقم
-- ----------------------------------------------------------------------------
create policy students_parent_read on public.students
  for select using (
    id in (select student_id from public.parent_students where parent_id = auth.uid())
  );

create policy fees_parent_read on public.student_fees
  for select using (
    student_id in (select student_id from public.parent_students where parent_id = auth.uid())
  );

-- ولي الأمر يقرأ مدفوعاته المعتمدة
create policy payments_parent_read on public.payments
  for select using (
    fee_id in (
      select f.id from public.student_fees f
      join public.parent_students ps on ps.student_id = f.student_id
      where ps.parent_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- 3) ربط ولي أمر بطالب (طاقم المدرسة) — ينشئ/يربط حساب ولي الأمر
--    ملاحظة: إنشاء حساب Auth يتم من التطبيق؛ هنا نربط profile موجوداً بطالب
-- ----------------------------------------------------------------------------
create or replace function public.link_parent_to_student(
  p_parent_id uuid,
  p_student_id uuid
)
returns void
language plpgsql security definer set search_path = public as $$
declare v_school uuid;
begin
  v_school := public.my_school_id();
  if public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح بربط أولياء الأمور';
  end if;
  if not exists (select 1 from public.students where id = p_student_id and school_id = v_school) then
    raise exception 'الطالب غير موجود في مدرستك';
  end if;
  if not exists (select 1 from public.profiles where id = p_parent_id and school_id = v_school and role = 'parent') then
    raise exception 'حساب ولي الأمر غير موجود في مدرستك';
  end if;

  insert into public.parent_students(school_id, parent_id, student_id)
  values (v_school, p_parent_id, p_student_id)
  on conflict (parent_id, student_id) do nothing;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4) لوحة ولي الأمر: أبناؤه مع ملخّص الرسوم
-- ----------------------------------------------------------------------------
create or replace function public.parent_children()
returns table(
  student_id uuid, student_name text, grade text, section text,
  total numeric, paid numeric, remaining numeric
)
language sql stable security definer set search_path = public as $$
  select
    s.id, s.full_name, s.grade, s.section,
    coalesce(sum(f.total),0), coalesce(sum(f.paid),0),
    coalesce(sum(f.total - f.paid),0)
  from public.parent_students ps
  join public.students s on s.id = ps.student_id
  left join public.student_fees f on f.student_id = s.id
  where ps.parent_id = auth.uid()
  group by s.id, s.full_name, s.grade, s.section
  order by s.full_name;
$$;

-- ----------------------------------------------------------------------------
-- 5) فواتير ولي الأمر (بنود الرسوم لكل أبنائه)
-- ----------------------------------------------------------------------------
create or replace function public.parent_fees()
returns table(
  fee_id uuid, student_name text, description text,
  total numeric, paid numeric, remaining numeric, due_date date
)
language sql stable security definer set search_path = public as $$
  select
    f.id, s.full_name, f.description,
    f.total, f.paid, (f.total - f.paid), f.due_date
  from public.parent_students ps
  join public.students s on s.id = ps.student_id
  join public.student_fees f on f.student_id = s.id
  where ps.parent_id = auth.uid()
  order by (f.total - f.paid) desc, f.due_date;
$$;

-- ----------------------------------------------------------------------------
-- 6) إيصالات ولي الأمر (المدفوعات المعتمدة)
-- ----------------------------------------------------------------------------
create or replace function public.parent_receipts()
returns table(
  payment_id uuid, student_name text, description text,
  amount numeric, method text, paid_at date
)
language sql stable security definer set search_path = public as $$
  select
    pay.id, s.full_name, f.description,
    pay.amount, pay.method, pay.paid_at
  from public.parent_students ps
  join public.students s on s.id = ps.student_id
  join public.student_fees f on f.student_id = s.id
  join public.payments pay on pay.fee_id = f.id
  where ps.parent_id = auth.uid()
  order by pay.paid_at desc;
$$;

grant execute on function public.link_parent_to_student(uuid,uuid) to authenticated;
grant execute on function public.parent_children() to authenticated;
grant execute on function public.parent_fees() to authenticated;
grant execute on function public.parent_receipts() to authenticated;

-- ----------------------------------------------------------------------------
-- 7) ربط ولي أمر بالبريد الإلكتروني (للطاقم) — يبحث عن حساب ولي أمر موجود
-- ----------------------------------------------------------------------------
create or replace function public.link_parent_by_email(
  p_email text,
  p_student_id uuid
)
returns text
language plpgsql security definer set search_path = public as $$
declare v_school uuid; v_parent uuid; v_name text;
begin
  v_school := public.my_school_id();
  if public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح بربط أولياء الأمور';
  end if;
  if not exists (select 1 from public.students where id = p_student_id and school_id = v_school) then
    raise exception 'الطالب غير موجود في مدرستك';
  end if;

  -- ابحث عن حساب ولي الأمر عبر auth.users بالبريد، ثم profile بدور parent
  select p.id, p.full_name into v_parent, v_name
  from public.profiles p
  join auth.users u on u.id = p.id
  where lower(u.email) = lower(trim(p_email))
    and p.school_id = v_school and p.role = 'parent'
  limit 1;

  if v_parent is null then
    raise exception 'لا يوجد حساب ولي أمر بهذا البريد في مدرستك. اطلب منه التسجيل أولاً بدور ولي أمر.';
  end if;

  insert into public.parent_students(school_id, parent_id, student_id)
  values (v_school, v_parent, p_student_id)
  on conflict (parent_id, student_id) do nothing;

  return v_name;
end;
$$;

-- قائمة أولياء أمور طالب (للطاقم)
create or replace function public.student_parents(p_student_id uuid)
returns table(parent_id uuid, parent_name text)
language sql stable security definer set search_path = public as $$
  select ps.parent_id, p.full_name
  from public.parent_students ps
  join public.profiles p on p.id = ps.parent_id
  where ps.student_id = p_student_id and ps.school_id = public.my_school_id();
$$;

grant execute on function public.link_parent_by_email(text,uuid) to authenticated;
grant execute on function public.student_parents(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 8) قائمة المدارس للاختيار عند تسجيل ولي الأمر (عامة — الاسم والمعرّف فقط)
-- ----------------------------------------------------------------------------
create or replace function public.public_schools()
returns table(id uuid, name text)
language sql stable security definer set search_path = public as $$
  select id, name from public.schools order by name;
$$;

-- إنشاء ملف ولي أمر بعد التسجيل (يُستدعى من العميل بعد signUp)
create or replace function public.create_parent_profile(
  p_school_id uuid,
  p_full_name text,
  p_phone text default null
)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'لديك حساب مسجّل بالفعل';
  end if;
  if not exists (select 1 from public.schools where id = p_school_id) then
    raise exception 'المدرسة غير موجودة';
  end if;
  insert into public.profiles(id, school_id, role, full_name, phone)
  values (auth.uid(), p_school_id, 'parent', coalesce(nullif(trim(p_full_name),''),'ولي أمر'), p_phone);
end;
$$;

grant execute on function public.public_schools() to anon, authenticated;
grant execute on function public.create_parent_profile(uuid,text,text) to authenticated;
