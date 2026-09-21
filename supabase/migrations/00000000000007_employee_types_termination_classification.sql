-- 00000000000007_employee_types_termination_classification.sql
-- طُبِّقت على الإنتاج عبر Supabase MCP باسم: employee_types_termination_and_classification
-- تُشغَّل بعد ملفات baseline (01–06): تحذف توقيعَي add_employee/update_employee القديمين وتنشئ الجديدين.

-- ═══ 1) الأعمدة: نوع الموظف + سبب إنهاء الخدمة (وقت الإنهاء = deleted_at الموجود) ═══
alter table public.employees
  add column if not exists employee_type text not null default 'official',
  add column if not exists termination_reason text;

alter table public.employees
  add constraint employees_employee_type_check
    check (employee_type in ('official','contract','driver','worker')),
  add constraint employees_termination_reason_check
    check (termination_reason is null or termination_reason in ('resigned','other'));

-- ═══ 2) add_employee: إضافة p_employee_type ═══
drop function if exists public.add_employee(text, text, text, numeric, numeric, text, text, text, text, text, text, text, boolean);

create function public.add_employee(
  p_full_name text,
  p_job_title text default null,
  p_nationality text default 'OM',
  p_basic numeric default 0,
  p_allowance numeric default 0,
  p_iban text default null,
  p_code text default null,
  p_email text default null,
  p_id_type text default 'CIVIL',
  p_id_number text default null,
  p_bank_name text default null,
  p_bank_account_no text default null,
  p_subject_to_pasi boolean default true,
  p_employee_type text default 'official'
) returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_school_id uuid;
  v_role      user_role;
  v_code      text;
  v_emp_id    uuid;
  v_seq       int;
  v_nat       text;
  v_type      text;
begin
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

  v_type := coalesce(nullif(trim(p_employee_type), ''), 'official');
  if v_type not in ('official','contract','driver','worker') then
    raise exception 'نوع الموظف غير صالح';
  end if;

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
    id_type, id_number, bank_name, bank_account_no, subject_to_pasi,
    employee_type
  ) values (
    v_school_id, v_code, trim(p_full_name), nullif(trim(p_job_title), ''),
    v_nat,
    coalesce(p_basic, 0), coalesce(p_allowance, 0),
    nullif(trim(p_iban), ''), nullif(lower(trim(p_email)), ''),
    coalesce(nullif(trim(p_id_type),''), 'CIVIL'),
    nullif(trim(p_id_number), ''),
    nullif(trim(p_bank_name), ''),
    nullif(trim(p_bank_account_no), ''),
    case when v_nat = 'NON_OM' then false else coalesce(p_subject_to_pasi, true) end,
    v_type
  )
  returning id into v_emp_id;

  insert into public.audit_log (school_id, actor_id, action, details)
  values (v_school_id, auth.uid(), 'إضافة موظف', trim(p_full_name) || ' (' || v_code || ')');

  return v_emp_id;
end;
$function$;

revoke all on function public.add_employee(text, text, text, numeric, numeric, text, text, text, text, text, text, text, boolean, text) from public, anon;
grant execute on function public.add_employee(text, text, text, numeric, numeric, text, text, text, text, text, text, text, boolean, text) to authenticated;

-- ═══ 3) update_employee: إضافة p_employee_type ═══
drop function if exists public.update_employee(uuid, text, text, text, numeric, numeric, text, text, text, text, text, boolean, text, integer);

create function public.update_employee(
  p_id uuid,
  p_full_name text,
  p_job_title text default null,
  p_nationality text default null,
  p_basic numeric default null,
  p_allowance numeric default null,
  p_iban text default null,
  p_id_type text default null,
  p_id_number text default null,
  p_bank_name text default null,
  p_bank_account_no text default null,
  p_subject_to_pasi boolean default null,
  p_department text default null,
  p_org_level integer default null,
  p_employee_type text default null
) returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_school_id uuid;
  v_role user_role;
  v_nat text;
  v_type text;
begin
  v_school_id := public.my_school_id();
  v_role      := public.my_role();

  if v_role not in ('owner','admin') then
    raise exception 'غير مصرّح: تعديل الموظفين للمدير أو الإداري فقط';
  end if;

  if not exists (select 1 from public.employees
                 where id = p_id and school_id = v_school_id) then
    raise exception 'الموظف غير موجود';
  end if;

  v_type := nullif(trim(coalesce(p_employee_type, '')), '');
  if v_type is not null and v_type not in ('official','contract','driver','worker') then
    raise exception 'نوع الموظف غير صالح';
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
    employee_type   = coalesce(v_type, employee_type),
    subject_to_pasi = case
      when v_nat = 'NON_OM' then false
      else coalesce(p_subject_to_pasi, subject_to_pasi) end
  where id = p_id and school_id = v_school_id;

  insert into public.audit_log(school_id, actor_id, action, details)
  values (v_school_id, auth.uid(), 'تعديل موظف', p_id::text);
end $function$;

revoke all on function public.update_employee(uuid, text, text, text, numeric, numeric, text, text, text, text, text, boolean, text, integer, text) from public, anon;
grant execute on function public.update_employee(uuid, text, text, text, numeric, numeric, text, text, text, text, text, boolean, text, integer, text) to authenticated;

-- ═══ 4) إنهاء الخدمة (حذف ناعم + سبب اختياري) ═══
create function public.terminate_employee(p_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_school_id uuid;
  v_role      user_role;
  v_reason    text;
  v_name      text;
  v_code      text;
begin
  v_school_id := public.my_school_id();
  v_role      := public.my_role();

  if v_school_id is null then
    raise exception 'لا مدرسة مرتبطة بحسابك';
  end if;
  if v_role not in ('owner','admin') then
    raise exception 'غير مصرّح: إنهاء خدمة الموظفين للمدير أو الإداري فقط';
  end if;

  v_reason := nullif(trim(coalesce(p_reason, '')), '');
  if v_reason is not null and v_reason not in ('resigned','other') then
    raise exception 'سبب إنهاء الخدمة غير صالح';
  end if;

  update public.employees
     set deleted_at = now(),
         termination_reason = v_reason,
         manager_id = null
   where id = p_id and school_id = v_school_id and deleted_at is null
  returning full_name, code into v_name, v_code;

  if v_name is null then
    raise exception 'الموظف غير موجود أو أُنهيت خدمته مسبقاً';
  end if;

  update public.employees set manager_id = null
   where school_id = v_school_id and manager_id = p_id;

  update public.salary_requests
     set status = 'rejected', decided_at = now(), decided_by = auth.uid()
   where employee_id = p_id and status = 'pending';

  insert into public.audit_log (school_id, actor_id, action, details)
  values (v_school_id, auth.uid(), 'إنهاء خدمة موظف',
          v_name || ' (' || v_code || ')' ||
          case v_reason when 'resigned' then ' — مستقيل'
                        when 'other' then ' — أخرى'
                        else '' end);
end;
$function$;

revoke all on function public.terminate_employee(uuid, text) from public, anon;
grant execute on function public.terminate_employee(uuid, text) to authenticated;

-- ═══ 5) إعادة التفعيل ═══
create function public.reinstate_employee(p_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_school_id uuid;
  v_role      user_role;
  v_name      text;
  v_code      text;
begin
  v_school_id := public.my_school_id();
  v_role      := public.my_role();

  if v_school_id is null then
    raise exception 'لا مدرسة مرتبطة بحسابك';
  end if;
  if v_role not in ('owner','admin') then
    raise exception 'غير مصرّح: إعادة تفعيل الموظفين للمدير أو الإداري فقط';
  end if;

  update public.employees
     set deleted_at = null, termination_reason = null
   where id = p_id and school_id = v_school_id and deleted_at is not null
  returning full_name, code into v_name, v_code;

  if v_name is null then
    raise exception 'الموظف غير موجود أو ليس منتهي الخدمة';
  end if;

  insert into public.audit_log (school_id, actor_id, action, details)
  values (v_school_id, auth.uid(), 'إعادة تفعيل موظف', v_name || ' (' || v_code || ')');
end;
$function$;

revoke all on function public.reinstate_employee(uuid) from public, anon;
grant execute on function public.reinstate_employee(uuid) to authenticated;

-- ═══ 6) تقرير تصنيف الموظفين: حسب المسمى الوظيفي + حسب نوع الموظف ═══
create function public.employees_classification()
returns table(dim text, grp text, headcount integer, total_basic numeric, total_allowance numeric, total_salary numeric)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if public.my_school_id() is null or public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح';
  end if;

  return query
  with emp as (
    select
      lower(regexp_replace(btrim(coalesce(e.job_title, '')), '\s+', ' ', 'g')) as tkey,
      e.employee_type as etype,
      coalesce(e.basic_salary, 0) as b,
      coalesce(e.housing_allowance, 0) + coalesce(e.transport_allowance, 0) + coalesce(e.other_allowance, 0) as a
    from public.employees e
    where e.school_id = public.my_school_id() and e.deleted_at is null
  )
  select 'title'::text,
         case when x.tkey = '' then 'بدون مسمى' else initcap(x.tkey) end,
         x.n, x.sb, x.sa, x.sb + x.sa
  from (select tkey, count(*)::int as n, round(sum(b), 3) as sb, round(sum(a), 3) as sa
        from emp group by tkey) x
  union all
  select 'type'::text, y.etype, y.n, y.sb, y.sa, y.sb + y.sa
  from (select etype, count(*)::int as n, round(sum(b), 3) as sb, round(sum(a), 3) as sa
        from emp group by etype) y;
end;
$function$;

revoke all on function public.employees_classification() from public, anon;
grant execute on function public.employees_classification() to authenticated;
