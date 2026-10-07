
-- عمود لحفظ مسار إيصال التحويل المرفوع (نفس نمط subscriptions.receipt_url الموجود مسبقاً)
alter table public.pending_payments add column if not exists receipt_url text;

-- bucket خاص لإيصالات دفعات أولياء الأمور (منفصل عن subscription-receipts)
insert into storage.buckets (id, name, public)
values ('fee-receipts', 'fee-receipts', false)
on conflict (id) do nothing;

-- رفع: أي مستخدم مسجَّل يرفع فقط داخل مجلد مدرسته (يشمل ولي الأمر والطاقم)
create policy fee_receipts_school_upload on storage.objects
for insert
with check (
  bucket_id = 'fee-receipts'
  and (storage.foldername(name))[1] = (select school_id::text from public.profiles where id = auth.uid())
);

-- قراءة: طاقم المدرسة (owner/admin/accountant) يرى إيصالات مدرسته، أو مالك المنصة
create policy fee_receipts_staff_read on storage.objects
for select
using (
  bucket_id = 'fee-receipts'
  and (
    is_platform_admin()
    or (
      (storage.foldername(name))[1] = (select school_id::text from public.profiles where id = auth.uid())
      and public.my_role() in ('owner','admin','accountant')
    )
  )
);
