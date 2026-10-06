-- service_role كان بدون صلاحية وصول صريحة على pending_payments — هذا سبب فشل
-- التحقق التلقائي من ثواني بصمت (payment-result page يستخدم service role key)
grant select, insert, update, delete on public.pending_payments to service_role;
