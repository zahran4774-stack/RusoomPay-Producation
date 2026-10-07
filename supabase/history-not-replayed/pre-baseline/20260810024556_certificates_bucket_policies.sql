-- دلو الشهادات كان بدون أي سياسة — يعني ميزة تحميل الشهادات معطّلة كلياً
-- (لا الموظف يرفع، ولا ولي الأمر يحمّل). نضيف حماية صحيحة:
-- الموظف: قراءة/رفع/حذف داخل مجلد مدرسته فقط (نفس نمط باقي الدلاء)
-- ولي الأمر: قراءة فقط لشهادات أبنائه تحديداً (عبر جدول certificates، لا مجرد مجلد المدرسة)

create policy certificates_staff_all on storage.objects
for all to authenticated
using (
  bucket_id = 'certificates'
  and (storage.foldername(name))[1] = (select school_id::text from public.profiles where id = auth.uid())
)
with check (
  bucket_id = 'certificates'
  and (storage.foldername(name))[1] = (select school_id::text from public.profiles where id = auth.uid())
);

create policy certificates_guardian_read on storage.objects
for select to authenticated
using (
  bucket_id = 'certificates'
  and exists (
    select 1 from public.certificates c
    join public.parent_students ps on ps.student_id = c.student_id
    where c.file_path = storage.objects.name and ps.parent_id = auth.uid()
  )
);
