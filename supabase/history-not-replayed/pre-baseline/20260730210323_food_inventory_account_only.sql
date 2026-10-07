-- إنشاء حساب مخزون التغذية (1320) لكل مدرسة لديها 1310، إن لم يكن موجوداً
INSERT INTO public.accounts (school_id, code, name, type)
SELECT school_id, '1320', 'مخزون التغذية المدرسية', 'asset'
FROM public.accounts
WHERE code = '1310'
  AND NOT EXISTS (
    SELECT 1 FROM public.accounts a2 WHERE a2.school_id = public.accounts.school_id AND a2.code = '1320'
  );