
-- Phase 0 — توحيد مصدر السياق (4/7)
-- التغيير الوحيد: مصدر v_school_id/v_role. باقي المنطق مطابق حرفياً للنسخة السابقة.
CREATE OR REPLACE FUNCTION public.update_employee(
  p_id uuid, p_full_name text, p_job_title text DEFAULT NULL::text,
  p_nationality text DEFAULT NULL::text, p_basic numeric DEFAULT NULL::numeric,
  p_allowance numeric DEFAULT NULL::numeric, p_iban text DEFAULT NULL::text,
  p_id_type text DEFAULT NULL::text, p_id_number text DEFAULT NULL::text,
  p_bank_name text DEFAULT NULL::text, p_bank_account_no text DEFAULT NULL::text,
  p_subject_to_pasi boolean DEFAULT NULL::boolean, p_department text DEFAULT NULL::text,
  p_org_level integer DEFAULT NULL::integer
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_school_id uuid;
  v_role user_role;
  v_nat text;
begin
  -- مصدر السياق الموحّد (بدل القراءة المباشرة من profiles)
  v_school_id := public.my_school_id();
  v_role      := public.my_role();

  if v_role not in ('owner','admin') then
    raise exception 'غير مصرّح: تعديل الموظفين للمدير أو الإداري فقط';
  end if;

  if not exists (select 1 from public.employees
                 where id = p_id and school_id = v_school_id) then
    raise exception 'الموظف غير موجود';
  end if;

  v_nat := case
    when p_nationality is null then null
    when lower(trim(p_nationality)) in ('om','omani','عماني') then 'OM'
    else 'NON_OM' end;

  if p_org_level = 1 then
    update public.employees
      set org_level = 2
      where school_id = v_school_id and org_level = 1 and id <> p_id;
  end if;

  update public.employees set
    full_name       = coalesce(nullif(trim(p_full_name),''), full_name),
    job_title       = coalesce(p_job_title, job_title),
    nationality     = coalesce(v_nat, nationality),
    basic_salary    = coalesce(p_basic, basic_salary),
    other_allowance = coalesce(p_allowance, other_allowance),
    iban            = coalesce(p_iban, iban),
    id_type         = coalesce(p_id_type, id_type),
    id_number       = coalesce(p_id_number, id_number),
    bank_name       = coalesce(p_bank_name, bank_name),
    bank_account_no = coalesce(p_bank_account_no, bank_account_no),
    department      = coalesce(p_department, department),
    org_level       = coalesce(p_org_level, org_level),
    subject_to_pasi = case
      when v_nat = 'NON_OM' then false
      else coalesce(p_subject_to_pasi, subject_to_pasi) end
  where id = p_id and school_id = v_school_id;

  insert into public.audit_log(school_id, actor_id, action, details)
  values (v_school_id, auth.uid(), 'تعديل موظف', p_id::text);
end $function$;
