-- ═══════════════════════════════════════════════════════════
-- RusoomPay — نظام إضافة الطلاب (حقول + دالة)
-- طبّقه في SQL Editor على قاعدة مومباي
-- ═══════════════════════════════════════════════════════════

-- (1) إضافة الحقول الناقصة لجدول الطلاب
alter table public.students add column if not exists guardian_email text;
alter table public.students add column if not exists birth_date date;
alter table public.students add column if not exists gender text;  -- 'male' | 'female'
alter table public.students add column if not exists annual_fee numeric(12,3) default 0;

-- (2) دالة إضافة طالب — تنشئ الطالب + رسومه السنوية دفعة واحدة
create or replace function public.add_student(
  p_full_name      text,
  p_grade          text,
  p_section        text default null,
  p_guardian_name  text default null,
  p_guardian_phone text default null,
  p_guardian_email text default null,
  p_birth_date     date default null,
  p_gender         text default null,
  p_code           text default null,
  p_annual_fee     numeric default 0
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school_id uuid;
  v_role      user_role;
  v_code      text;
  v_student_id uuid;
  v_seq       int;
begin
  -- التحقّق من الهوية والدور
  select school_id, role into v_school_id, v_role
  from public.profiles where id = auth.uid();

  if v_school_id is null then
    raise exception 'لا مدرسة مرتبطة بحسابك';
  end if;

  if v_role not in ('owner', 'admin') then
    raise exception 'غير مصرّح: إضافة الطلاب للمدير أو الإداري فقط';
  end if;

  if coalesce(trim(p_full_name), '') = '' then
    raise exception 'اسم الطالب مطلوب';
  end if;

  if coalesce(trim(p_grade), '') = '' then
    raise exception 'الصف/المرحلة مطلوب';
  end if;

  -- توليd رقم مدرسي تلقائي إن لم يُدخَل (STU-001، STU-002...)
  if coalesce(trim(p_code), '') = '' then
    select count(*) + 1 into v_seq from public.students where school_id = v_school_id;
    v_code := 'STU-' || lpad(v_seq::text, 3, '0');
    -- تفادي التعارض النادر
    while exists (select 1 from public.students where school_id = v_school_id and code = v_code) loop
      v_seq := v_seq + 1;
      v_code := 'STU-' || lpad(v_seq::text, 3, '0');
    end loop;
  else
    v_code := trim(p_code);
    if exists (select 1 from public.students where school_id = v_school_id and code = v_code) then
      raise exception 'الرقم المdرسي % مستخdم بالفعل', v_code;
    end if;
  end if;

  -- إنشاء الطالب
  insert into public.students (
    school_id, code, full_name, grade, section,
    guardian_name, guardian_phone, guardian_email,
    birth_date, gender, annual_fee
  ) values (
    v_school_id, v_code, trim(p_full_name), trim(p_grade), nullif(trim(p_section), ''),
    nullif(trim(p_guardian_name), ''), nullif(trim(p_guardian_phone), ''), nullif(trim(p_guardian_email), ''),
    p_birth_date, nullif(trim(p_gender), ''), coalesce(p_annual_fee, 0)
  )
  returning id into v_student_id;

  -- إنشاء رسوم سنوية إن حُدّدت
  if coalesce(p_annual_fee, 0) > 0 then
    insert into public.student_fees (school_id, student_id, description, total, paid, due_date)
    values (v_school_id, v_student_id, 'الرسوم الدراسية السنوية', p_annual_fee, 0, current_date + interval '30 days');
  end if;

  -- توثيق في سجلّ التدقيق
  insert into public.audit_log (school_id, actor_id, action, details)
  values (v_school_id, auth.uid(), 'إضافة طالب', trim(p_full_name) || ' (' || v_code || ')');

  return v_student_id;
end;
$$;

grant execute on function public.add_student(text,text,text,text,text,text,date,text,text,numeric) to authenticated;

-- تأكيd: النتيجة
select 'تم إنشاء دالة add_student والحقول' as status;
