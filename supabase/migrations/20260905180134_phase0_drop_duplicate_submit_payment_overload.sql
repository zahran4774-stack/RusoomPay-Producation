
-- إصلاح دَين مخطط: نسخة submit_payment القديمة (4 معاملات) بقيت حيّة بجانب
-- الجديدة (5 معاملات) لأن CREATE OR REPLACE مع معامل إضافي يُنشئ overload لا يستبدل.
-- الجديدة تُعرّف p_receipt_url DEFAULT NULL، لذا استدعاء api/payments/submit
-- بأربعة معاملات مُسمّاة سيُحلّ إليها تلقائياً — لا حاجة لتغيير الكود.
DROP FUNCTION IF EXISTS public.submit_payment(uuid, numeric, text, text);
