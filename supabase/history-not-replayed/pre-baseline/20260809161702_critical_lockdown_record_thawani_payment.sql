-- 🚨 ثغرة حرجة: record_thawani_payment كانت قابلة للاستدعاء المباشر من
-- anon و authenticated — أي شخص (حتى بدون تسجيل دخول) يقدر يستدعيها بمعرّف
-- pending_payment عشوائي ويعتمد دفعة كأنها مدفوعة، بدون ما يدفع فلس فعلياً
-- عند ثواني. هذا استغلال مالي مباشر (Free Money Exploit).
revoke all on function public.record_thawani_payment(uuid) from public, anon, authenticated;
grant execute on function public.record_thawani_payment(uuid) to service_role;

-- submit_payment: منطقها آمن فعلياً (ownership check صريح عبر auth.uid())،
-- لكن anon ما له داعي يقدر يستدعيها أصلاً — تشديد احترازي إضافي
revoke execute on function public.submit_payment(uuid, numeric, text, text) from anon;
