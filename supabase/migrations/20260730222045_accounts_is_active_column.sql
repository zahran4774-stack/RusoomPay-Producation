-- إضافة عمود is_active لجدول الحسابات — يسمح بإخفاء حساب من الاستخدام المستقبلي دون حذفه
-- (الحذف الفعلي مستحيل وغير مرغوب لأي حساب له قيود تاريخية، بحماية journal_lines_account_id_fkey)
-- القيمة الافتراضية true تحافظ على سلوك كل الحسابات الحالية دون أي تغيير.
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- تعطيل حساب "إيرادات النقل المدرسي" (4210) في كل المدارس — القرار: الرسم يُدرج ضمن الرسوم الدراسية
UPDATE public.accounts
SET is_active = false
WHERE code = '4210';