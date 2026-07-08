-- ============================================================================
-- EduPay — بيانات مركز التحكّم (Super Admin Control Center)
-- يجمع مؤشرات الأقسام الثلاثة: نظرة عامة + الإيرادات + الاشتراكات
-- لمدير المنصة فقط (is_platform_admin) — ينفّذ بعد 01..09
-- ============================================================================

-- أسعار الباقات (ثابتة — تُستخدم لحساب الإيراد)
-- monthly=7, annual=72, lifetime=350 (ر.ع)

create or replace function public.control_center_summary()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_result jsonb;
  v_schools int; v_active int; v_trial int; v_suspended int; v_expired int;
  v_students int; v_parents int; v_employees int; v_users int;
  v_mrr numeric; v_annual numeric; v_pending int; v_renewals int;
begin
  -- التحقق: مدير المنصة فقط
  if not public.is_platform_admin() then
    raise exception 'غير مصرّح: مركز التحكّم لمدير المنصة فقط';
  end if;

  -- القسم 1: نظرة عامة
  select count(*) into v_schools from public.schools;
  select count(*) into v_active from public.subscriptions where status = 'active';
  select count(*) into v_trial from public.subscriptions where status = 'trial';
  select count(*) into v_suspended from public.schools where coalesce(active, true) = false;
  select count(*) into v_expired from public.subscriptions
    where status = 'active' and renews_at is not null and renews_at < now();

  select count(*) into v_students from public.students where status = 'active';
  select count(*) into v_parents from public.profiles where role = 'parent';
  select count(*) into v_employees from public.employees;
  select count(*) into v_users from public.profiles;

  -- القسم 2: الإيرادات (من الاشتراكات النشطة حسب الباقة)
  select coalesce(sum(case
      when plan = 'monthly' then 7
      when plan = 'yearly' then 72.0/12      -- شهرياً مكافئاً
      when plan = 'lifetime' then 0          -- دفعة واحدة، لا تكرار
      else 0 end), 0)
    into v_mrr
    from public.subscriptions where status = 'active';

  select coalesce(sum(case
      when plan = 'monthly' then 84           -- 7×12
      when plan = 'yearly' then 72
      when plan = 'lifetime' then 350
      else 0 end), 0)
    into v_annual
    from public.subscriptions where status = 'active';

  -- القسم 3: الاشتراكات
  select count(*) into v_pending from public.subscriptions where status = 'pending';
  select count(*) into v_renewals from public.subscriptions
    where status = 'active' and renews_at is not null
      and renews_at between now() and now() + interval '30 days';

  v_result := jsonb_build_object(
    'overview', jsonb_build_object(
      'schools', v_schools, 'active', v_active, 'trial', v_trial,
      'suspended', v_suspended, 'expired', v_expired,
      'students', v_students, 'parents', v_parents,
      'employees', v_employees, 'users', v_users
    ),
    'revenue', jsonb_build_object(
      'mrr', round(v_mrr, 3), 'annual', round(v_annual, 3),
      'pending', v_pending, 'renewals_due', v_renewals
    )
  );
  return v_result;
end; $$;

-- ----------------------------------------------------------------------------
-- جدول الاشتراكات التفصيلي (للقسم 3)
-- ----------------------------------------------------------------------------
create or replace function public.control_center_subscriptions()
returns table(
  school_id uuid, school_name text, country text,
  plan text, status text,
  period_start timestamptz, period_end timestamptz,
  amount numeric
)
language sql stable security definer set search_path = public as $$
  select
    s.id, s.name, s.country,
    sub.plan, sub.status,
    sub.created_at, sub.renews_at,
    case sub.plan when 'monthly' then 7 when 'yearly' then 72 when 'lifetime' then 350 else 0 end
  from public.schools s
  left join public.subscriptions sub on sub.school_id = s.id
  where public.is_platform_admin()
  order by s.name;
$$;

-- ============================================================================
-- ملاحظة: MRR للباقة السنوية محسوب كمكافئ شهري (72÷12). الاشتراك الدائم
-- لا يدخل في MRR (دفعة واحدة) لكن يدخل في الإيراد السنوي.
-- ============================================================================
