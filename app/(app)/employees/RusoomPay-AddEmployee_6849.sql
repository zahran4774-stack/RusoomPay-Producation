-- ═══════════════════════════════════════════════════════════
-- RusoomPay — نظام إضافة الموظفين (دالة add_employee)
-- طبّقه في SQL Editor على قاعدة مومباي
-- ═══════════════════════════════════════════════════════════

create or replace function public.add_employee(
  p_full_name   text,
  p_job_title   text default null,
  p_nationality text default 'om',       -- 'om' عُماني | 'expat' وافد
  p_basic       numeric default 0,
  p_allowance   numeric default 0,
  p_iban        text default null,
  p_code        text default null
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
  v_emp_id    uuid;
  v_seq       int;
begin
  select school_id, role into v_school_id, v_role
  from public.profiles where id = auth.uid();

  if v_school_id is null then
    raise exception 'لا مدرسة مرتبطة بحسابك';
  end if;

  if v_role not in ('owner', 'admin') then
    raise exception 'غير مصرّح: إضافة الموظفين للمدير أو الإداري فقط';
  end if;

  if coalesce(trim(p_full_name), '') = '' then
    raise exception 'اسم الموظف مطلوب';
  end if;

  -- توليد رقم وظيفي تلقائي (EMP-001...)
  if coalesce(trim(p_code), '') = '' then
    select count(*) + 1 into v_seq from public.employees where school_id = v_school_id;
    v_code := 'EMP-' || lpad(v_seq::text, 3, '0');
    while exists (select 1 from public.employees where school_id = v_school_id and code = v_code) loop
      v_seq := v_seq + 1;
      v_code := 'EMP-' || lpad(v_seq::text, 3, '0');
    end loop;
  else
    v_code := trim(p_code);
    if exists (select 1 from public.employees where school_id = v_school_id and code = v_code) then
      raise exception 'الرقم الوظيفي % مستخدم بالفعل', v_code;
    end if;
  end if;

  insert into public.employees (
    school_id, code, full_name, job_title, nationality, basic, allowance, iban
  ) values (
    v_school_id, v_code, trim(p_full_name), nullif(trim(p_job_title), ''),
    coalesce(nullif(trim(p_nationality), ''), 'om'),
    coalesce(p_basic, 0), coalesce(p_allowance, 0), nullif(trim(p_iban), '')
  )
  returning id into v_emp_id;

  insert into public.audit_log (school_id, actor_id, action, details)
  values (v_school_id, auth.uid(), 'إضافة موظف', trim(p_full_name) || ' (' || v_code || ')');

  return v_emp_id;
end;
$$;

grant execute on function public.add_employee(text,text,text,numeric,numeric,text,text) to authenticated;

select 'تم إنشاء دالة add_employee' as status;
