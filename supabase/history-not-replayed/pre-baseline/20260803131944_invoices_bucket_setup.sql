-- bucket خاص لفواتير PDF المُرسَلة عبر واتساب — خاص تماماً (لا رابط دائم مفتوح)
-- يُستخدَم مع رابط موقّع مؤقت (نفس نمط subscription-receipts المُختبَر سابقاً اليوم)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('invoices', 'invoices', false, 2097152, array['application/pdf'])
on conflict (id) do nothing;

-- كل مدرسة ترفع/تقرأ فواتيرها فقط ضمن مجلد باسم school_id الخاص بها
create policy "invoices_school_upload"
on storage.objects for insert
with check (
  bucket_id = 'invoices'
  and (storage.foldername(name))[1] = (select school_id::text from public.profiles where id = auth.uid())
);

create policy "invoices_school_read"
on storage.objects for select
using (
  bucket_id = 'invoices'
  and (storage.foldername(name))[1] = (select school_id::text from public.profiles where id = auth.uid())
);