
-- 1) جدول طلبات الشهادات (ولي الأمر يطلب، الطاقم يعتمد/يرفض)
create table if not exists public.certificate_requests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  student_id uuid not null references public.students(id),
  parent_id uuid not null references public.profiles(id),
  kind text not null default 'enrollment',
  status text not null default 'pending', -- pending | approved | rejected
  certificate_id uuid references public.certificates(id),
  reason text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.certificate_requests enable row level security;

create policy certificate_requests_select on public.certificate_requests for select
  using (
    parent_id = auth.uid()
    or school_id = public.my_school_id()
  );

-- كل الكتابة تمر عبر RPCs أدناه (SECURITY DEFINER) لا عبر REST مباشرة
revoke insert, update, delete on public.certificate_requests from anon, authenticated;

create index if not exists idx_certificate_requests_school_status on public.certificate_requests(school_id, status);
create index if not exists idx_certificate_requests_parent on public.certificate_requests(parent_id);

-- 2) ولي الأمر: تقديم طلب شهادة قيد (أو أي نوع مدعوم)
create or replace function public.request_certificate(p_student_id uuid, p_kind text default 'enrollment')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school uuid;
  v_id uuid;
begin
  if public.my_role() <> 'parent' then
    raise exception 'هذا الإجراء متاح لولي الأمر فقط';
  end if;
  if p_kind not in ('enrollment','clearance','fees_statement') then
    raise exception 'نوع شهادة غير مدعوم';
  end if;
  if not exists (select 1 from public.parent_students where parent_id = auth.uid() and student_id = p_student_id) then
    raise exception 'هذا الطالب غير مرتبط بحسابك';
  end if;
  select school_id into v_school from public.students where id = p_student_id;
  if v_school is null then raise exception 'الطالب غير موجود'; end if;

  if exists (
    select 1 from public.certificate_requests
    where student_id = p_student_id and kind = p_kind and status = 'pending'
  ) then
    raise exception 'لديك طلب سابق قيد الانتظار لهذه الشهادة';
  end if;

  insert into public.certificate_requests(school_id, student_id, parent_id, kind)
  values (v_school, p_student_id, auth.uid(), p_kind)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.request_certificate(uuid, text) from public;
grant execute on function public.request_certificate(uuid, text) to authenticated;

-- 3) ولي الأمر: عرض طلباته
create or replace function public.parent_certificate_requests()
returns table(id uuid, student_name text, kind text, status text, reason text, created_at timestamptz, reviewed_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select cr.id, s.full_name, cr.kind, cr.status, cr.reason, cr.created_at, cr.reviewed_at
  from public.certificate_requests cr
  join public.students s on s.id = cr.student_id
  where cr.parent_id = auth.uid()
  order by cr.created_at desc;
$$;

revoke all on function public.parent_certificate_requests() from public;
grant execute on function public.parent_certificate_requests() to authenticated;

-- 4) الطاقم: قائمة الطلبات (افتراضيًا المعلّقة) لكل الطلاب في مدرسته
create or replace function public.certificate_requests_list(p_status text default 'pending')
returns table(id uuid, student_id uuid, student_name text, parent_name text, kind text, status text, reason text, created_at timestamptz, reviewed_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select cr.id, cr.student_id, s.full_name, p.full_name, cr.kind, cr.status, cr.reason, cr.created_at, cr.reviewed_at
  from public.certificate_requests cr
  join public.students s on s.id = cr.student_id
  join public.profiles p on p.id = cr.parent_id
  where cr.school_id = public.my_school_id()
    and (p_status is null or cr.status = p_status)
  order by cr.created_at desc;
$$;

revoke all on function public.certificate_requests_list(text) from public;
grant execute on function public.certificate_requests_list(text) to authenticated;

-- 5) الطاقم: اعتماد الطلب → يصدر الشهادة فعليًا (نفس دالة الإصدار المعتمدة) وتظهر في حساب ولي الأمر
create or replace function public.approve_certificate_request(p_request_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school uuid;
  v_req record;
  v_cert_id uuid;
begin
  v_school := public.my_school_id();
  if public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح';
  end if;

  select * into v_req from public.certificate_requests where id = p_request_id and school_id = v_school;
  if v_req is null then raise exception 'الطلب غير موجود في مدرستك'; end if;
  if v_req.status <> 'pending' then raise exception 'هذا الطلب تمت معالجته مسبقًا'; end if;

  -- تصدر الشهادة بنفس منطق الإصدار اليدوي (يتحقق من السداد لبراءة الذمة تلقائيًا)
  v_cert_id := public.generate_certificate(v_req.student_id, v_req.kind);

  update public.certificate_requests
  set status = 'approved', certificate_id = v_cert_id, reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_request_id;

  return v_cert_id;
end;
$$;

revoke all on function public.approve_certificate_request(uuid) from public;
grant execute on function public.approve_certificate_request(uuid) to authenticated;

-- 6) الطاقم: رفض الطلب
create or replace function public.reject_certificate_request(p_request_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_school uuid;
begin
  v_school := public.my_school_id();
  if public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح';
  end if;
  update public.certificate_requests
  set status = 'rejected', reason = nullif(trim(p_reason),''), reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_request_id and school_id = v_school and status = 'pending';
  if not found then raise exception 'الطلب غير موجود أو تمت معالجته مسبقًا'; end if;
end;
$$;

revoke all on function public.reject_certificate_request(uuid, text) from public;
grant execute on function public.reject_certificate_request(uuid, text) to authenticated;
