-- ============================================================================
-- EduPay — دخول مالك المنصة لمدرسة معيّنة (Support Access)
-- قراءة تفصيلية للدعم + تعديل محدود للمعالجة + تسجيل كامل في Audit Log
-- الفلسفة: تحكّم للمالك دون كسر عزل RLS عشوائياً — كل وصول موثّق ومحصور بدوال
-- ينفّذ بعد 01..18
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) نظرة تفصيلية على مدرسة (للدعم) — تُسجّل الدخول في سجل التدقيق
-- ----------------------------------------------------------------------------
create or replace function public.platform_school_detail(p_school_id uuid)
returns json
language plpgsql security definer set search_path = public as $$
declare v_result json;
begin
  if not public.is_platform_admin() then
    raise exception 'غير مصرّح: لمدير المنصة فقط';
  end if;

  -- تسجيل دخول الدعم (شفافية كاملة — تظهر للمدرسة في سجلّها)
  insert into public.audit_log(school_id, actor_id, action, details)
  values (p_school_id, auth.uid(), 'دخول دعم من مدير المنصة', 'اطّلاع على بيانات المدرسة للمعالجة');

  select json_build_object(
    'school', (select row_to_json(s) from (
        select id, name, branch, country, currency, cr_number, moe_license,
               vat_number, phone, email, address, bank_iban, bank_enabled
        from public.schools where id = p_school_id) s),
    'subscription', (select row_to_json(sub) from (
        select plan, status, trial_ends_at, renews_at, amount
        from public.subscriptions where school_id = p_school_id
        order by created_at desc limit 1) sub),
    'counts', (select row_to_json(c) from (
        select
          (select count(*) from public.students where school_id = p_school_id) as students,
          (select count(*) from public.employees where school_id = p_school_id) as employees,
          (select count(*) from public.profiles where school_id = p_school_id) as users,
          (select count(*) from public.student_fees where school_id = p_school_id) as fees,
          (select coalesce(sum(total),0) from public.student_fees where school_id = p_school_id) as fees_total,
          (select coalesce(sum(paid),0) from public.student_fees where school_id = p_school_id) as fees_paid
        ) c),
    'recent_fees', (select coalesce(json_agg(f), '[]'::json) from (
        select sf.description, sf.total, sf.paid, st.full_name as student
        from public.student_fees sf join public.students st on st.id = sf.student_id
        where sf.school_id = p_school_id order by sf.created_at desc limit 20) f),
    'users', (select coalesce(json_agg(u), '[]'::json) from (
        select id, full_name, role, phone, active
        from public.profiles where school_id = p_school_id order by role) u)
  ) into v_result;

  return v_result;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2) سجل تدقيق مدرسة معيّنة (للاطّلاع على الأخطاء/العمليات)
-- ----------------------------------------------------------------------------
create or replace function public.platform_school_audit(p_school_id uuid, p_limit int default 60)
returns table(id uuid, actor_name text, action text, details text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select a.id, coalesce(p.full_name,'—'), a.action, a.details, a.created_at
  from public.audit_log a
  left join public.profiles p on p.id = a.actor_id
  where a.school_id = p_school_id and public.is_platform_admin()
  order by a.created_at desc
  limit p_limit;
$$;

-- ----------------------------------------------------------------------------
-- 3) تعديل محدود للمعالجة — بيانات المدرسة الأساسية (مع تسجيل)
-- ----------------------------------------------------------------------------
create or replace function public.platform_update_school(
  p_school_id uuid,
  p_name text default null,
  p_phone text default null,
  p_email text default null,
  p_address text default null
)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'غير مصرّح: لمدير المنصة فقط';
  end if;
  update public.schools set
    name = coalesce(nullif(trim(p_name),''), name),
    phone = coalesce(nullif(trim(p_phone),''), phone),
    email = coalesce(nullif(trim(p_email),''), email),
    address = coalesce(nullif(trim(p_address),''), address)
  where id = p_school_id;

  insert into public.audit_log(school_id, actor_id, action, details)
  values (p_school_id, auth.uid(), 'تعديل بيانات المدرسة من مدير المنصة', 'معالجة دعم');
end;
$$;

-- ----------------------------------------------------------------------------
-- 4) إعادة تعيين كلمة مرور مستخدم (معالجة شائعة) — عبر إرسال رابط، يُسجّل
--    ملاحظة: التنفيذ الفعلي لإعادة التعيين عبر Supabase Auth من التطبيق؛
--    هنا نسجّل الطلب ونعطّل/نفعّل الحساب عند الحاجة.
-- ----------------------------------------------------------------------------
create or replace function public.platform_set_user_active(
  p_user_id uuid,
  p_active boolean
)
returns void
language plpgsql security definer set search_path = public as $$
declare v_school uuid; v_role user_role;
begin
  if not public.is_platform_admin() then
    raise exception 'غير مصرّح: لمدير المنصة فقط';
  end if;
  select school_id, role into v_school, v_role from public.profiles where id = p_user_id;
  -- حماية: لا يمكن إيقاف مدير المدرسة (حفاظاً على وصول المدرسة لحسابها)
  if v_role = 'owner' and not p_active then
    raise exception 'لا يمكن إيقاف مدير المدرسة';
  end if;
  update public.profiles set active = p_active where id = p_user_id;

  insert into public.audit_log(school_id, actor_id, action, details)
  values (v_school, auth.uid(),
    case when p_active then 'تفعيل مستخدم من مدير المنصة' else 'إيقاف مستخدم من مدير المنصة' end,
    'معالجة دعم');
end;
$$;

grant execute on function public.platform_school_detail(uuid) to authenticated;
grant execute on function public.platform_school_audit(uuid,int) to authenticated;
grant execute on function public.platform_update_school(uuid,text,text,text,text) to authenticated;
grant execute on function public.platform_set_user_active(uuid,boolean) to authenticated;
