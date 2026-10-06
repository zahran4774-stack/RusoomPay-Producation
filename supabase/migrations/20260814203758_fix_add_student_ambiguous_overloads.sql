-- إزالة النسختين الأقدم من add_student للتخلص من التباس الدالة
drop function if exists public.add_student(text, text, text, text, text, text, date, text, text, numeric);
drop function if exists public.add_student(text, text, text, text, text, text, date, text, text, numeric, text);

-- التأكد من صلاحية التنفيذ على النسخة المتبقية (الأشمل: تشمل transport_type و country_code)
grant execute on function public.add_student(text, text, text, text, text, text, date, text, text, numeric, text, text) to authenticated;