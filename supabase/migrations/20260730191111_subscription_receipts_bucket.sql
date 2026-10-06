-- bucket خاص لإيصالات تحويل اشتراكات المدارس — غير عام (خصوصية بيانات مالية)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'subscription-receipts', 'subscription-receipts', false,
  5242880, -- 5MB حد أقصى
  array['image/jpeg','image/png','image/webp','application/pdf']
)
on conflict (id) do nothing;

-- المدرسة ترفع إيصالها فقط ضمن مجلد باسم school_id الخاص بها
create policy "subscription_receipts_school_upload"
on storage.objects for insert
with check (
  bucket_id = 'subscription-receipts'
  and (storage.foldername(name))[1] = (select school_id::text from public.profiles where id = auth.uid())
);

-- المدرسة تقرأ إيصالاتها فقط، ومالك المنصة يقرأ الكل
create policy "subscription_receipts_read"
on storage.objects for select
using (
  bucket_id = 'subscription-receipts'
  and (
    (storage.foldername(name))[1] = (select school_id::text from public.profiles where id = auth.uid())
    or public.is_platform_admin()
  )
);