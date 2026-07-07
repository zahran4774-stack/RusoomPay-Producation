-- ============================================================================
-- EduPay — سجلّ شهادات الطالب (Certificates)
-- (أ) شهادات يولّدها النظام نصّياً: قيد · براءة ذمة مالية · إفادة رسوم
-- (ب) رفع ملفات خارجية (PDF/صور) عبر Supabase Storage + أرشفتها
-- ينفّذ بعد 01..19
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) جدول الشهادات (يخزّن النوعين: مُولّدة نصّياً + ملفات مرفوعة)
--    kind: enrollment (قيد) · clearance (براءة ذمة) · fees_statement (إفادة رسوم) · uploaded (ملف مرفوع)
-- ----------------------------------------------------------------------------
create table if not exists public.certificates (
  id           uuid primary key default uuid_generate_v4(),
  school_id    uuid not null references public.schools(id) on delete cascade,
  student_id   uuid not null references public.students(id) on delete cascade,
  kind         text not null,                          -- enrollment | clearance | fees_statement | uploaded
  title        text not null,                          -- عنوان الشهادة المعروض
  serial       text not null,                          -- رقم تسلسلي فريد (CRT-...)
  body         text,                                   -- نص الشهادة المُولّد (للأنواع النصّية)
  file_path    text,                                   -- مسار الملف في Storage (للمرفوعات)
  file_name    text,                                   -- اسم الملف الأصلي
  issued_by    uuid references public.profiles(id),
  created_at   timestamptz not null default now()
);
create index if not exists idx_certificates_school on public.certificates(school_id);
create index if not exists idx_certificates_student on public.certificates(student_id);

alter table public.certificates enable row level security;

-- ----------------------------------------------------------------------------
-- 2) سياسات RLS
--    طاقم المدرسة يدير شهادات مدرسته؛ ولي الأمر يقرأ شهادات أبنائه
-- ----------------------------------------------------------------------------
create policy cert_staff_rw on public.certificates
  for all using (school_id = public.my_school_id() and public.my_role() in ('owner','admin','accountant'))
  with check (school_id = public.my_school_id() and public.my_role() in ('owner','admin','accountant'));

create policy cert_parent_read on public.certificates
  for select using (
    student_id in (select student_id from public.parent_students where parent_id = auth.uid())
  );

-- ----------------------------------------------------------------------------
-- 3) توليد شهادة نصّياً (قيد / براءة ذمة / إفادة رسوم)
--    يبني النص من بيانات الطالب والرسوم، ويحفظه في السجلّ
-- ----------------------------------------------------------------------------
create or replace function public.generate_certificate(
  p_student_id uuid,
  p_kind text
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_school uuid; v_st record; v_school_name text; v_serial text; v_id uuid;
  v_title text; v_body text;
  v_total numeric; v_paid numeric; v_remaining numeric;
begin
  v_school := public.my_school_id();
  if public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح بإصدار الشهادات';
  end if;
  select * into v_st from public.students where id = p_student_id and school_id = v_school;
  if v_st is null then raise exception 'الطالب غير موجود في مدرستك'; end if;
  if p_kind not in ('enrollment','clearance','fees_statement') then
    raise exception 'نوع شهادة غير مدعوم';
  end if;

  select name into v_school_name from public.schools where id = v_school;
  select coalesce(sum(total),0), coalesce(sum(paid),0)
    into v_total, v_paid
    from public.student_fees where student_id = p_student_id;
  v_remaining := v_total - v_paid;

  v_serial := 'CRT-' || to_char(now(),'YYYYMMDD') || '-' || upper(substr(p_student_id::text,1,6));

  if p_kind = 'enrollment' then
    v_title := 'شهادة قيد';
    v_body := 'تشهد ' || v_school_name || ' بأن الطالب/ة: ' || v_st.full_name ||
              ' (رقم القيد: ' || v_st.code || ') مقيّد/ة لدينا في الصف ' || v_st.grade ||
              coalesce(' شعبة ' || v_st.section, '') ||
              '، وهو/هي طالب/ة منتظم/ة. حُرّرت هذه الشهادة بناءً على طلب ولي الأمر لتقديمها لمن يهمه الأمر.';
  elsif p_kind = 'clearance' then
    v_title := 'شهادة براءة ذمة مالية';
    if v_remaining > 0.0005 then
      raise exception 'لا يمكن إصدار براءة ذمة: على الطالب رسوم متبقّية بقيمة %', to_char(v_remaining,'FM999990.000');
    end if;
    v_body := 'تشهد ' || v_school_name || ' بأن الطالب/ة: ' || v_st.full_name ||
              ' (رقم القيد: ' || v_st.code || ') قد سدّد/ت كامل الرسوم المستحقة عليه/ا، وليس عليه/ا أي التزامات مالية تجاه المدرسة حتى تاريخه.';
  else -- fees_statement
    v_title := 'إفادة رسوم';
    v_body := 'إفادة بحالة رسوم الطالب/ة: ' || v_st.full_name || ' (رقم القيد: ' || v_st.code || ').' ||
              ' إجمالي الرسوم: ' || to_char(v_total,'FM999990.000') ||
              ' — المسدّد: ' || to_char(v_paid,'FM999990.000') ||
              ' — المتبقّي: ' || to_char(v_remaining,'FM999990.000') || '.';
  end if;

  insert into public.certificates(school_id, student_id, kind, title, serial, body, issued_by)
  values (v_school, p_student_id, p_kind, v_title, v_serial, v_body, auth.uid())
  returning id into v_id;

  insert into public.audit_log(school_id, actor_id, action, details)
  values (v_school, auth.uid(), 'إصدار ' || v_title, v_st.full_name || ' · ' || v_serial);

  return v_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4) تسجيل ملف شهادة مرفوع (بعد رفعه لـStorage من العميل)
-- ----------------------------------------------------------------------------
create or replace function public.record_uploaded_certificate(
  p_student_id uuid,
  p_title text,
  p_file_path text,
  p_file_name text
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_school uuid; v_serial text; v_id uuid; v_name text;
begin
  v_school := public.my_school_id();
  if public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح برفع الشهادات';
  end if;
  if not exists (select 1 from public.students where id = p_student_id and school_id = v_school) then
    raise exception 'الطالب غير موجود في مدرستك';
  end if;
  select full_name into v_name from public.students where id = p_student_id;
  v_serial := 'UPL-' || to_char(now(),'YYYYMMDD') || '-' || upper(substr(p_student_id::text,1,6));

  insert into public.certificates(school_id, student_id, kind, title, serial, file_path, file_name, issued_by)
  values (v_school, p_student_id, 'uploaded', coalesce(nullif(trim(p_title),''),'شهادة مرفوعة'), v_serial, p_file_path, p_file_name, auth.uid())
  returning id into v_id;

  insert into public.audit_log(school_id, actor_id, action, details)
  values (v_school, auth.uid(), 'رفع شهادة', v_name || ' · ' || coalesce(p_file_name,''));

  return v_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5) قوائم العرض
-- ----------------------------------------------------------------------------
-- شهادات طالب معيّن (للطاقم)
create or replace function public.student_certificates(p_student_id uuid)
returns table(id uuid, kind text, title text, serial text, body text, file_path text, file_name text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select id, kind, title, serial, body, file_path, file_name, created_at
  from public.certificates
  where student_id = p_student_id and school_id = public.my_school_id()
  order by created_at desc;
$$;

-- شهادات أبناء ولي الأمر (لبوابته)
create or replace function public.parent_certificates()
returns table(id uuid, student_name text, kind text, title text, serial text, body text, file_path text, file_name text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.id, s.full_name, c.kind, c.title, c.serial, c.body, c.file_path, c.file_name, c.created_at
  from public.certificates c
  join public.students s on s.id = c.student_id
  join public.parent_students ps on ps.student_id = c.student_id
  where ps.parent_id = auth.uid()
  order by c.created_at desc;
$$;

-- حذف شهادة (طاقم المدرسة)
create or replace function public.delete_certificate(p_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح';
  end if;
  delete from public.certificates where id = p_id and school_id = public.my_school_id();
end;
$$;

grant execute on function public.generate_certificate(uuid,text) to authenticated;
grant execute on function public.record_uploaded_certificate(uuid,text,text,text) to authenticated;
grant execute on function public.student_certificates(uuid) to authenticated;
grant execute on function public.parent_certificates() to authenticated;
grant execute on function public.delete_certificate(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 6) Supabase Storage — حاوية الشهادات المرفوعة (خاصة، بسياسات عزل)
--    ملاحظة: إنشاء الحاوية وسياساتها يُنفّذ مرّة واحدة في Supabase
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('certificates', 'certificates', false)
on conflict (id) do nothing;

-- رفع/قراءة: طاقم المدرسة ضمن مجلد مدرسته (المسار يبدأ بـ school_id/)
create policy cert_storage_staff on storage.objects
  for all to authenticated
  using (
    bucket_id = 'certificates'
    and (storage.foldername(name))[1] = public.my_school_id()::text
    and public.my_role() in ('owner','admin','accountant')
  )
  with check (
    bucket_id = 'certificates'
    and (storage.foldername(name))[1] = public.my_school_id()::text
    and public.my_role() in ('owner','admin','accountant')
  );
