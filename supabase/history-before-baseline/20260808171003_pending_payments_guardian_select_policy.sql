-- يسمح لولي الأمر بقراءة دفعاته المعلّقة الخاصة به فقط
-- (لازم لعمل RETURNING بعد INSERT من واجهة ولي الأمر، وأيضاً منطقي لأي عرض حالة مستقبلي)
create policy pending_payments_guardian_select
on public.pending_payments
for select
to authenticated
using (guardian_id = auth.uid());
