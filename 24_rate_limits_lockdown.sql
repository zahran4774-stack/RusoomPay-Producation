-- ============================================================================
-- RusoomPay — إغلاق ثغرة تفويض في rate_limits (تدقيق أمني)
-- ينفّذ بعد 01..23
--
-- المشكلة: الجدول أُنشئ بلا RLS، وSupabase يمنح افتراضياً صلاحيات على جداول
-- public لدوري anon/authenticated — أي أن حامل anon key (عامّ في المتصفّح)
-- كان يستطيع نظرياً قراءة/تعديل/حذف عدّادات المعدّل مباشرة عبر REST API،
-- فيُبطل حماية تحديد المعدّل على الدخول والدفع.
-- كذلك: منح execute لدالة لا يلغي منح PUBLIC الافتراضي في Postgres.
--
-- الحلّ (دفاع متعدّد الطبقات):
--   1) تفعيل RLS بلا سياسات = رفض تامّ لـanon/authenticated
--      (service_role يتجاوز RLS بطبيعته، فالخادم يستمرّ بالعمل)
--   2) سحب صلاحيات الجدول المباشرة صراحةً
--   3) سحب execute للدالتين من PUBLIC/anon/authenticated
-- ============================================================================

-- 1) تفعيل RLS (بلا سياسات = مقفل لغير service_role)
alter table public.rate_limits enable row level security;

-- 2) سحب صلاحيات الجدول المباشرة (دفاع إضافي فوق RLS)
revoke all on table public.rate_limits from public, anon, authenticated;

-- 3) قصر تنفيذ الدوال على service_role حصراً
revoke execute on function public.check_rate_limit(text, int, int)
  from public, anon, authenticated;
revoke execute on function public.cleanup_rate_limits()
  from public, anon, authenticated;

-- (منح service_role موجود من migration 22 — يبقى سارياً)
