
-- Phase 0 — توحيد مصدر السياق (3/7)
CREATE OR REPLACE FUNCTION public.add_employee(
  p_full_name text, p_job_title text DEFAULT NULL::text, p_nationality text DEFAULT 'OM'::text,
  p_basic numeric DEFAULT 0, p_allowance numeric DEFAULT 0, p_iban text DEFAULT NULL::text,
  p_code text DEFAULT NULL::text, p_email text DEFAULT NULL::text,
  p_id_type text DEFAULT 'CIVIL'::text, p_id_number text DEFAULT NULL::text,
  p_bank_name text DEFAULT NULL::text, p_bank_account_no text DEFAULT NULL::text,
  p_subject_to_pasi boolean DEFAULT true
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_school_id uuid;
  v_role      user_role;
  v_code      text;
  v_emp_id    uuid;
  v_seq       int;
  v_nat       text;
begin
  -- مصدر السياق الموحّد (بدل القراءة المباشرة من profiles)
  v_school_id := public.my_school_id();
  v_role      := public.my_role();

  if v_school_id is null then
    raise exception 'لا مدرسة مرتبطة بحسابك';
  end if;
  if v_role not in ('owner', 'admin') then
    raise exception 'غير مصرّح: إضافة الموظفين للمدير أو الإداري فقط';
  end if;
  if coalesce(trim(p_full_name), '') = '' then
    raise exception 'اسم الموظف مطلوب';
  end if;

  -- توحيد ترميز الجنسية
  v_nat := case
    when lower(coalesce(trim(p_nationality),'om')) in ('om','omani','عماني') then 'OM'
    else 'NON_OM' end;

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
    school_id, code, full_name, job_title, nationality,
    basic_salary, other_allowance, iban, email,
    id_type, id_number, bank_name, bank_account_no, subject_to_pasi
  ) values (
    v_school_id, v_code, trim(p_full_name), nullif(trim(p_job_title), ''),
    v_nat,
    coalesce(p_basic, 0), coalesce(p_allowance, 0),
    nullif(trim(p_iban), ''), nullif(lower(trim(p_email)), ''),
    coalesce(nullif(trim(p_id_type),''), 'CIVIL'),
    nullif(trim(p_id_number), ''),
    nullif(trim(p_bank_name), ''),
    nullif(trim(p_bank_account_no), ''),
    case when v_nat = 'NON_OM' then false else coalesce(p_subject_to_pasi, true) end
  )
  returning id into v_emp_id;

  insert into public.audit_log (school_id, actor_id, action, details)
  values (v_school_id, auth.uid(), 'إضافة موظف', trim(p_full_name) || ' (' || v_code || ')');

  return v_emp_id;
end;
$function$;
