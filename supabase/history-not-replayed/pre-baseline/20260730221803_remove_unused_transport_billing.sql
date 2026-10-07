-- إزالة الأدوات المبنية بناءً على افتراض خاطئ (فوترة نقل شهرية منفصلة)
-- القرار النهائي: رسم النقل يبقى مدمجاً ضمن الرسوم الدراسية السنوية (4100)، بدون حساب إيراد مستقل
DROP FUNCTION IF EXISTS public.bill_transport(text);
DROP TABLE IF EXISTS public.transport_billing;