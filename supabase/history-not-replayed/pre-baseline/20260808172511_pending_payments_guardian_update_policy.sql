-- يسمح لولي الأمر بتحديث دفعته المعلّقة الخاصة به فقط، وفقط وهي لسه بحالة pending
-- (مطلوب عشان route.ts يقدر يخزّن provider_ref = session_id بعد إنشاء جلسة ثواني)
create policy pending_payments_guardian_update
on public.pending_payments
for update
to authenticated
using (guardian_id = auth.uid() and status = 'pending')
with check (guardian_id = auth.uid());
