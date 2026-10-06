-- الإصلاح السابق سحب الصلاحية من anon بس، لكن الصلاحية الأصلية كانت ممنوحة
-- لـ PUBLIC (اللي anon يرث منه تلقائياً) — فما انسحبت فعلياً. هذا يصلحها صح
-- للدوال المرتبطة مباشرة بشغل اليوم فقط (ثواني + التغذية + ربط ولي الأمر).
revoke all on function public.submit_payment(uuid, numeric, text, text) from public;
grant execute on function public.submit_payment(uuid, numeric, text, text) to authenticated;

revoke all on function public.link_parent_by_student(uuid) from public;
grant execute on function public.link_parent_by_student(uuid) to authenticated;

revoke all on function public.link_parent_by_email(text, uuid) from public;
grant execute on function public.link_parent_by_email(text, uuid) to authenticated;

revoke all on function public.link_parent_to_student(uuid, uuid) from public;
grant execute on function public.link_parent_to_student(uuid, uuid) to authenticated;

revoke all on function public.bill_cafeteria(text) from public;
grant execute on function public.bill_cafeteria(text) to authenticated;
