
-- Phase 0 — توحيد مصدر السياق (5/7 و 6/7)
CREATE OR REPLACE FUNCTION public.add_annual_meal_fee(p_student uuid, p_plan uuid, p_annual_amount numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_school uuid;
  v_role   user_role;
  v_plan_name text;
begin
  -- مصدر السياق الموحّد (بدل القراءة المباشرة من profiles)
  v_school := public.my_school_id();
  v_role   := public.my_role();

  if v_school is null then raise exception 'لا مدرسة مرتبطة بحسابك'; end if;
  if v_role not in ('owner','admin') then raise exception 'غير مصرّح'; end if;

  if not exists (select 1 from public.students where id = p_student and school_id = v_school) then
    raise exception 'الطالب غير موجود في مدرستك';
  end if;

  select name into v_plan_name from public.meal_plans where id = p_plan and school_id = v_school;
  if v_plan_name is null then raise exception 'الباقة غير موجودة في مدرستك'; end if;

  -- التحقق على (الطالب + الخطة) معاً — يطابق الفهرس الفريد uq_meal_subs_student_plan
  if not exists (
    select 1 from public.meal_subscriptions
    where student_id = p_student and school_id = v_school and plan_id = p_plan
  ) then
    insert into public.meal_subscriptions(school_id, student_id, plan_id, billing)
    values (v_school, p_student, p_plan, 'annual');
  end if;

  if coalesce(p_annual_amount, 0) > 0 then
    insert into public.student_fees(school_id, student_id, description, total, paid, due_date)
    values (v_school, p_student,
            'رسوم التغذية السنوية' || coalesce(' — ' || v_plan_name, ''),
            p_annual_amount, 0, current_date + interval '30 days');
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.grant_employee_access(p_employee_id uuid, p_role text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_school_id uuid;
  v_my_role   user_role;
  v_email     text;
  v_name      text;
begin
  -- مصدر السياق الموحّد (بدل القراءة المباشرة من profiles)
  v_school_id := public.my_school_id();
  v_my_role   := public.my_role();

  if v_school_id is null then
    raise exception 'لا مدرسة مرتبطة بحسابك';
  end if;
  if v_my_role <> 'owner' then
    raise exception 'غير مصرّح: منح الصلاحيات للمدير فقط';
  end if;
  if p_role not in ('admin', 'accountant') then
    raise exception 'الدور يجب أن يكون إدارياً أو محاسباً';
  end if;

  select email, full_name into v_email, v_name
  from public.employees
  where id = p_employee_id and school_id = v_school_id;

  if v_name is null then
    raise exception 'الموظف غير موجود في مدرستك';
  end if;
  if coalesce(trim(v_email), '') = '' then
    raise exception 'لا بريد إلكتروني لهذا الموظف — أضفه أولاً';
  end if;

  insert into public.staff_invites (school_id, email, role, full_name, invited_by)
  values (v_school_id, lower(trim(v_email)), p_role::user_role, v_name, auth.uid())
  on conflict (school_id, email)
  do update set role = p_role::user_role, full_name = v_name, status = 'pending';

  insert into public.audit_log (school_id, actor_id, action, details)
  values (v_school_id, auth.uid(), 'منح صلاحية دخول',
          v_name || ' (' || lower(trim(v_email)) || ') — ' ||
          (case p_role when 'admin' then 'إداري' else 'محاسب' end));

  return jsonb_build_object('ok', true, 'email', lower(trim(v_email)), 'role', p_role);
end;
$function$;
