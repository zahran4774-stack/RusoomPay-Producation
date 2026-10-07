-- إضافة تصنيف المخزون: فئة رئيسية (قائمة قابلة للتوسيع) + نوع فرعي (نص حر اختياري)
-- القيمة الافتراضية 'أخرى' تحافظ على الأصناف الموجودة حالياً بدون كسرها (يمكن تصنيفها لاحقاً)
ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'أخرى',
  ADD COLUMN IF NOT EXISTS subtype text;

-- تصنيف الأصناف الموجودة فعلياً تلقائياً بأفضل تخمين ممكن من اسمها (مساعدة أولية، قابلة للتعديل يدوياً لاحقاً)
UPDATE public.inventory_items SET category = 'كتب'
WHERE category = 'أخرى' AND (name ILIKE '%كتاب%' OR name ILIKE '%كتب%');

UPDATE public.inventory_items SET category = 'زي مدرسي'
WHERE category = 'أخرى' AND (name ILIKE '%زي%' OR name ILIKE '%قميص%' OR name ILIKE '%بنطلون%');