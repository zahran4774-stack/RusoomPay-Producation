-- إضافة تصنيف حساب الإيراد لكل فاتورة — يحدَّد وقت الإصدار حسب مصدرها الحقيقي
-- القيمة الافتراضية '4100' تحافظ على السلوك الحالي لكل الفواتير الموجودة (رسوم دراسية عادية)
ALTER TABLE public.student_fees
  ADD COLUMN IF NOT EXISTS revenue_account_code text NOT NULL DEFAULT '4100';

-- تصحيح تصنيف فواتير التغذية الموجودة فعلياً (كانت ستُسجَّل بالغلط في 4100 عند أي دفعة مستقبلية)
UPDATE public.student_fees
SET revenue_account_code = '4220'
WHERE description ILIKE '%تغذية%';

-- تصحيح فاتورة النقل الموجودة (إن وُجدت) لتصنيفها الصحيح
UPDATE public.student_fees
SET revenue_account_code = '4210'
WHERE description ILIKE '%نقل%';