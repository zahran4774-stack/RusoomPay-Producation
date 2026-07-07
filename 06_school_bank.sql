-- ============================================================================
-- EduPay — الحساب البنكي للمدرسة (لتحصيل رسوم الطلاب)
-- المدير يضيف حساب مدرسته، فتذهب مدفوعات أولياء الأمور إليه مباشرة
-- (منفصل عن حساب المنصة الذي يُستخدم لاشتراك المدرسة في EduPay)
-- ينفّذ بعد 01..05
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) حقول الحساب البنكي في جدول المدارس
-- ----------------------------------------------------------------------------
alter table public.schools add column if not exists bank_name      text;  -- اسم البنك
alter table public.schools add column if not exists bank_account   text;  -- رقم الحساب
alter table public.schools add column if not exists bank_iban      text;  -- الآيبان
alter table public.schools add column if not exists bank_holder    text;  -- اسم صاحب الحساب
alter table public.schools add column if not exists bank_enabled   boolean not null default false; -- مُفعّل في خيارات الدفع؟

-- ----------------------------------------------------------------------------
-- 2) دالة تحديث الحساب البنكي — للمدير فقط (owner)
--    تتحقق أن المستخدم مدير المدرسة قبل السماح بالتعديل
-- ----------------------------------------------------------------------------
create or replace function public.update_school_bank(
  p_bank_name text,
  p_bank_account text,
  p_bank_iban text,
  p_bank_holder text,
  p_enabled boolean
)
returns void
language plpgsql security definer set search_path = public as $$
declare v_school uuid;
begin
  -- التحقق من الدور: المدير فقط يدير الحساب البنكي
  if public.my_role() <> 'owner' then
    raise exception 'غير مصرّح: إدارة الحساب البنكي لمدير المدرسة فقط';
  end if;

  v_school := public.my_school_id();
  if v_school is null then
    raise exception 'لا توجد مدرسة مرتبطة بالحساب';
  end if;

  -- لا يمكن تفعيل الدفع بلا رقم حساب
  if p_enabled and (p_bank_account is null or length(trim(p_bank_account)) = 0) then
    raise exception 'لا يمكن تفعيل الدفع بلا رقم حساب بنكي';
  end if;

  update public.schools set
    bank_name    = nullif(trim(p_bank_name), ''),
    bank_account = nullif(trim(p_bank_account), ''),
    bank_iban    = nullif(trim(p_bank_iban), ''),
    bank_holder  = nullif(trim(p_bank_holder), ''),
    bank_enabled = coalesce(p_enabled, false)
  where id = v_school;

  insert into public.audit_log(school_id, actor_id, action, details)
  values(v_school, auth.uid(), 'تحديث الحساب البنكي للمدرسة',
         case when p_enabled then 'مُفعّل للدفع' else 'غير مُفعّل' end);
end; $$;

-- ============================================================================
-- ملاحظة: قراءة بيانات الحساب تتم عبر RLS العادي (المدرسة ترى بياناتها).
-- ولي الأمر يرى رقم حساب مدرسته فقط عند الدفع (ضمن سياسة قراءة المدرسة).
-- ============================================================================
