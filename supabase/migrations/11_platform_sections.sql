-- ============================================================================
-- EduPay — مركز التحكّم: تحليلات المدارس + سجل التدقيق + الإعلانات
-- (الأقسام 7 و10 و8) — ينفّذ بعد 01..10
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) القسم 7: تحليلات كل المدارس (School Analytics)
--    لكل مدرسة: الطلاب، الموظفون، التحصيل، المتبقّي، آخر نشاط
-- ----------------------------------------------------------------------------
create or replace function public.platform_school_analytics()
returns table(
  school_id uuid, school_name text, country text,
  students int, employees int,
  fees_total numeric, fees_paid numeric, collection_rate int,
  last_activity timestamptz
)
language sql stable security definer set search_path = public as $$
  select
    s.id, s.name, s.country,
    (select count(*) from public.students st where st.school_id = s.id and st.status = 'active')::int,
    (select count(*) from public.employees e where e.school_id = s.id)::int,
    coalesce((select sum(f.total) from public.student_fees f where f.school_id = s.id), 0),
    coalesce((select sum(f.paid) from public.student_fees f where f.school_id = s.id), 0),
    case when coalesce((select sum(f.total) from public.student_fees f where f.school_id = s.id), 0) > 0
      then round(coalesce((select sum(f.paid) from public.student_fees f where f.school_id = s.id), 0)
        / (select sum(f.total) from public.student_fees f where f.school_id = s.id) * 100)::int
      else 100 end,
    (select max(a.created_at) from public.audit_log a where a.school_id = s.id)
  from public.schools s
  where public.is_platform_admin()
  order by s.name;
$$;

-- ----------------------------------------------------------------------------
-- 2) القسم 10: سجل التدقيق عابر المستأجرين (لمدير المنصة)
--    سياسة قراءة إضافية: مدير المنصة يرى سجلّ كل المدارس
-- ----------------------------------------------------------------------------
create policy platform_admin_audit_read on public.audit_log
  for select using (public.is_platform_admin());

create or replace function public.platform_audit_log(p_limit int default 100)
returns table(
  id uuid, school_name text, actor_name text,
  action text, details text, created_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select
    a.id, s.name, coalesce(p.full_name, 'النظام'),
    a.action, a.details, a.created_at
  from public.audit_log a
  left join public.schools s on s.id = a.school_id
  left join public.profiles p on p.id = a.actor_id
  where public.is_platform_admin()
  order by a.created_at desc
  limit p_limit;
$$;

-- ----------------------------------------------------------------------------
-- 3) القسم 8: الإعلانات (Announcements)
-- ----------------------------------------------------------------------------
create table if not exists public.announcements (
  id          uuid primary key default uuid_generate_v4(),
  title       text not null,
  body        text not null,
  kind        text not null default 'info',   -- info, maintenance, emergency, update
  target      text not null default 'all',     -- all, or school_id محدّد
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now()
);
create index if not exists idx_ann_created on public.announcements(created_at);

alter table public.announcements enable row level security;

-- مدير المنصة ينشئ ويقرأ؛ المدارس تقرأ ما يخصّها
create policy ann_platform_all on public.announcements
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy ann_school_read on public.announcements
  for select using (target = 'all' or target = public.my_school_id()::text);

-- دالة إرسال إعلان (مدير المنصة فقط)
create or replace function public.send_announcement(
  p_title text, p_body text, p_kind text, p_target text
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'غير مصرّح: إرسال الإعلانات لمدير المنصة فقط';
  end if;
  if p_title is null or length(trim(p_title)) = 0 then
    raise exception 'عنوان الإعلان مطلوب';
  end if;
  insert into public.announcements(title, body, kind, target, created_by)
  values(trim(p_title), trim(p_body), coalesce(p_kind,'info'), coalesce(p_target,'all'), auth.uid())
  returning id into v_id;
  return v_id;
end; $$;

-- ============================================================================
-- ملاحظة: المراقبة الحيّة (الأخطاء، صحّة الخدمات، الجلسات) والتذاكر والانتحال
-- تتطلب خدمات خارجية (Sentry, نظام تذاكر, إدارة جلسات) — تُبنى واجهتها
-- وتُوصَل عند توفّر التكامل. لا تُولّد أرقاماً وهمية هنا.
-- ============================================================================
