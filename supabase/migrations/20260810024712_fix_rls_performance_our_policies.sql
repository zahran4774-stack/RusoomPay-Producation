-- سياسات RLS اللي أنشأناها اليوم كانت تستدعي auth.uid() لكل صف على حدة
-- (بطيء عند تكبر البيانات) — نلفّها بـ (select auth.uid()) عشان تُحسب مرة وحدة للاستعلام كامل
drop policy if exists pending_payments_guardian_select on public.pending_payments;
create policy pending_payments_guardian_select on public.pending_payments
for select to authenticated
using (guardian_id = (select auth.uid()));

drop policy if exists pending_payments_guardian_update on public.pending_payments;
create policy pending_payments_guardian_update on public.pending_payments
for update to authenticated
using (guardian_id = (select auth.uid()) and status = 'pending')
with check (guardian_id = (select auth.uid()));

drop policy if exists meal_orders_guardian_select on public.meal_orders;
create policy meal_orders_guardian_select on public.meal_orders
for select to authenticated
using (exists (
  select 1 from public.parent_students ps
  where ps.student_id = meal_orders.student_id and ps.parent_id = (select auth.uid())
));
