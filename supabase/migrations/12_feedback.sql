-- ============================================================================
-- EduPay — نظام الشكاوى والملاحظات (Feedback)
-- مستخدمو المدرسة يرسلون شكاوى/اقتراحات/بلاغات → مدير المنصة يراها ويتابعها
-- ينفّذ بعد 01..11
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) جدول الشكاوى والملاحظات
-- ----------------------------------------------------------------------------
create table if not exists public.feedback (
  id          uuid primary key default uuid_generate_v4(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  author_id   uuid references public.profiles(id),
  author_name text,                                  -- لقطة من اسم المرسل
  kind        text not null default 'complaint',     -- complaint, bug, suggestion, question
  priority    text not null default 'normal',        -- normal, important, urgent
  body        text not null,
  status      text not null default 'open',          -- open, closed
  reply       text,                                  -- ردّ فريق المنصة (اختياري)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_feedback_school on public.feedback(school_id);
create index if not exists idx_feedback_status on public.feedback(status);
create index if not exists idx_feedback_created on public.feedback(created_at);

alter table public.feedback enable row level security;

-- ----------------------------------------------------------------------------
-- 2) سياسات RLS
--    - طاقم المدرسة (owner/admin/accountant) يرسل ويقرأ شكاوى مدرسته فقط
--    - مدير المنصة يقرأ ويحدّث كل الشكاوى (عبر كل المدارس)
-- ----------------------------------------------------------------------------
-- قراءة: المدرسة ترى شكاواها، والمنصة ترى الكل
create policy feedback_read on public.feedback
  for select using (
    public.is_platform_admin()
    or school_id = public.my_school_id()
  );

-- إنشاء: طاقم المدرسة فقط، ضمن مدرسته
create policy feedback_insert on public.feedback
  for insert with check (
    school_id = public.my_school_id()
    and public.my_role() in ('owner','admin','accountant')
  );

-- تحديث: مدير المنصة فقط (تغيير الحالة / الرد)
create policy feedback_update on public.feedback
  for update using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- ----------------------------------------------------------------------------
-- 3) دالة إرسال شكوى (طاقم المدرسة)
-- ----------------------------------------------------------------------------
create or replace function public.submit_feedback(
  p_kind text,
  p_priority text,
  p_body text
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_school uuid;
  v_name   text;
  v_id     uuid;
begin
  v_school := public.my_school_id();
  if v_school is null then
    raise exception 'لا توجد مدرسة مرتبطة بالحساب';
  end if;
  if public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح بإرسال الشكاوى';
  end if;
  if coalesce(trim(p_body),'') = '' then
    raise exception 'نص الشكوى مطلوب';
  end if;

  select full_name into v_name from public.profiles where id = auth.uid();

  insert into public.feedback(school_id, author_id, author_name, kind, priority, body)
  values (
    v_school, auth.uid(), v_name,
    coalesce(nullif(p_kind,''), 'complaint'),
    coalesce(nullif(p_priority,''), 'normal'),
    p_body
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4) قائمة شكاوى المدرسة الحالية (للمستخدم — سجلّ بلاغاته)
-- ----------------------------------------------------------------------------
create or replace function public.my_school_feedback()
returns setof public.feedback
language sql stable security definer set search_path = public as $$
  select * from public.feedback
  where school_id = public.my_school_id()
  order by created_at desc;
$$;

-- ----------------------------------------------------------------------------
-- 5) كل الشكاوى لمركز تحكّم المنصة (مع اسم المدرسة)
-- ----------------------------------------------------------------------------
create or replace function public.platform_feedback(p_limit int default 200)
returns table(
  id uuid, school_name text, author_name text,
  kind text, priority text, body text, status text,
  reply text, created_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select
    f.id, s.name, f.author_name,
    f.kind, f.priority, f.body, f.status,
    f.reply, f.created_at
  from public.feedback f
  left join public.schools s on s.id = f.school_id
  where public.is_platform_admin()
  order by
    case f.status when 'open' then 0 else 1 end,
    case f.priority when 'urgent' then 0 when 'important' then 1 else 2 end,
    f.created_at desc
  limit p_limit;
$$;

-- ----------------------------------------------------------------------------
-- 6) تحديث حالة/ردّ شكوى (مدير المنصة فقط)
-- ----------------------------------------------------------------------------
create or replace function public.resolve_feedback(
  p_id uuid,
  p_status text,
  p_reply text default null
)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'غير مصرّح: متابعة الشكاوى لمدير المنصة فقط';
  end if;
  update public.feedback
  set status = coalesce(nullif(p_status,''), status),
      reply = coalesce(p_reply, reply),
      updated_at = now()
  where id = p_id;
end;
$$;

grant execute on function public.submit_feedback(text,text,text) to authenticated;
grant execute on function public.my_school_feedback() to authenticated;
grant execute on function public.platform_feedback(int) to authenticated;
grant execute on function public.resolve_feedback(uuid,text,text) to authenticated;
