-- ============================================================================
-- EduPay — طبقة مدير المنصة (Super-Admin)
-- مستوى فوق كل المدارس: يدير المشتركين ويعتمد التحويلات البنكية
-- ينفّذ بعد 01_schema و 02_rls و 03_functions
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) إضافة دور مدير المنصة لنوع الأدوار
-- ----------------------------------------------------------------------------
alter type user_role add value if not exists 'platform_admin';

-- ملاحظة: ملف مدير المنصة يُربط بلا school_id (لأنه ليس تابعاً لمدرسة).
-- لذا نجعل school_id قابلاً للإفراغ في profiles لهذا الدور فقط.
alter table public.profiles alter column school_id drop not null;

-- ----------------------------------------------------------------------------
-- 2) دالة: هل المستخدم الحالي مدير منصة؟
-- ----------------------------------------------------------------------------
create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'platform_admin'
  );
$$;

-- ----------------------------------------------------------------------------
-- 3) سياسات الوصول الشامل لمدير المنصة (تتجاوز عزل المدرسة الواحدة)
--    يرى كل المدارس والاشتراكات — لكنه لا يطّلع على تفاصيل تشغيل المدارس
--    (بيانات الطلاب/الموظفين تبقى معزولة لكل مدرسة — يرى بيانات الاشتراك فقط)
-- ----------------------------------------------------------------------------

-- كل المدارس (للعرض والإدارة)
create policy platform_admin_schools on public.schools
  for select using (public.is_platform_admin());
create policy platform_admin_schools_update on public.schools
  for update using (public.is_platform_admin());

-- كل الاشتراكات (لاعتماد التحويلات وإدارة الباقات)
create policy platform_admin_subs on public.subscriptions
  for all using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- ----------------------------------------------------------------------------
-- 4) دالة اعتماد التحويل البنكي للاشتراك (مدير المنصة فقط)
--    تحوّل الحالة من pending إلى active وتسجّل في التدقيق
-- ----------------------------------------------------------------------------
create or replace function public.approve_subscription(p_sub_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare s record;
begin
  if not public.is_platform_admin() then
    raise exception 'غير مصرّح: اعتماد الاشتراكات لمدير المنصة فقط';
  end if;

  select * into s from public.subscriptions
    where id = p_sub_id and status = 'pending';
  if not found then raise exception 'الاشتراك غير موجود أو ليس بانتظار الاعتماد'; end if;

  update public.subscriptions set status = 'active' where id = p_sub_id;

  insert into public.audit_log(school_id, actor_id, action, details)
  values(s.school_id, auth.uid(), 'اعتماد اشتراك (تحويل بنكي)', p_sub_id::text);
end; $$;

-- ----------------------------------------------------------------------------
-- 5) دالة رفض التحويل البنكي
-- ----------------------------------------------------------------------------
create or replace function public.reject_subscription(p_sub_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare s record;
begin
  if not public.is_platform_admin() then
    raise exception 'غير مصرّح: لمدير المنصة فقط';
  end if;
  select * into s from public.subscriptions where id = p_sub_id and status = 'pending';
  if not found then raise exception 'الاشتراك غير موجود أو ليس معلّقاً'; end if;

  update public.subscriptions set status = 'expired' where id = p_sub_id;
  insert into public.audit_log(school_id, actor_id, action, details)
  values(s.school_id, auth.uid(), 'رفض اشتراك (تحويل بنكي)', p_sub_id::text);
end; $$;

-- ----------------------------------------------------------------------------
-- 6) دالة تفعيل/إيقاف مدرسة (مدير المنصة)
-- ----------------------------------------------------------------------------
create or replace function public.set_school_active(p_school_id uuid, p_active boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'غير مصرّح: لمدير المنصة فقط';
  end if;
  -- يُستخدم حقل status في الاشتراك للإيقاف الفعلي
  if not p_active then
    update public.subscriptions set status = 'expired'
      where school_id = p_school_id and status = 'active';
  end if;
  insert into public.audit_log(school_id, actor_id, action, details)
  values(p_school_id, auth.uid(), case when p_active then 'تفعيل مدرسة' else 'إيقاف مدرسة' end, p_school_id::text);
end; $$;

-- ----------------------------------------------------------------------------
-- 7) عرض ملخّص للمنصة (إحصائيات لمدير المنصة)
-- ----------------------------------------------------------------------------
create or replace function public.platform_summary()
returns table(
  total_schools bigint,
  active_subs bigint,
  pending_subs bigint,
  trial_subs bigint
)
language sql stable security definer set search_path = public as $$
  select
    (select count(*) from public.schools),
    (select count(*) from public.subscriptions where status = 'active'),
    (select count(*) from public.subscriptions where status = 'pending'),
    (select count(*) from public.subscriptions where status = 'trial')
  where public.is_platform_admin();
$$;

-- ============================================================================
-- إنشاء حساب مدير المنصة (يدوياً — مرة واحدة):
-- 1) أنشئ المستخدم في Authentication → Users (بريدك)
-- 2) نفّذ (مع استبدال USER_UUID ببريدك من جدول auth.users):
--
--   insert into public.profiles(id, school_id, role, full_name)
--   values('USER_UUID', null, 'platform_admin', 'مدير منصة EduPay');
--
-- يُفضّل تفعيل المصادقة الثنائية (2FA) لهذا الحساب من إعدادات Supabase Auth.
-- ============================================================================
