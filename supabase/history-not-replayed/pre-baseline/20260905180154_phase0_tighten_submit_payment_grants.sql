
-- النسخة الجديدة أُنشئت بصلاحيات افتراضية (PUBLIC execute). فشلها مغلق داخلياً،
-- لكن التوحيد مع بقية دوال المشروع يقتضي حصرها على authenticated.
REVOKE ALL ON FUNCTION public.submit_payment(uuid, numeric, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_payment(uuid, numeric, text, text, text) TO authenticated;
