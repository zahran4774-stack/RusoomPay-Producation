-- ═══════════════════════════════════════════════════════════
-- RusoomPay — نظام دعوة الطاقم (محاسب/إداري بحساب خاص)
-- طبّقه في SQL Editor على قاعدة مومباي
-- ═══════════════════════════════════════════════════════════

-- (1) جدول دعوات الطاقم
create table if not exists public.staff_invites (
  id          uuid primary key default uuid_generate_v4(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  email       text not null,
  role        user_role not null,          -- 'admin' | 'accountant'
  full_name   text,
  status      text not null default 'pending',  -- pending | accepted
  invited_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now(),
  accepted_at timestamptz,
  unique (school_id, email)
);
create index if not exists idx_staff_invites_email on public.staff_invites(email);

alter table public.staff_invites enable row level security;

-- المدير يرى/يدير دعوات مدرسته
drop policy if exists staff_invites_owner on public.staff_invites;
create policy staff_invites_owner on public.staff_invites
  for all to authenticated
  using (school_id = (select school_id from public.profiles where id = auth.uid())
         and (select role from public.profiles where id = auth.uid()) = 'owner')
  with check (school_id = (select school_id from public.profiles where id = auth.uid())
         and (select role from public.profiles where id = auth.uid()) = 'owner');

-- (2) دالة: المدير يدعو عضو طاقم
create or replace function public.invite_staff(
  p_email     text,
  p_role      text,               -- 'admin' | 'accountant'
  p_full_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school_id uuid;
  v_my_role   user_role;
  v_invite_id uuid;
begin
  select school_id, role into v_school_id, v_my_role
  from public.profiles where id = auth.uid();

  if v_school_id is null then
    raise exception 'لا مدرسة مرتبطة بحسابك';
  end if;

  if v_my_role <> 'owner' then
    raise exception 'غير مصرّح: دعوة الطاقم للمدير فقط';
  end if;

  if p_role not in ('admin', 'accountant') then
    raise exception 'الدور يجب أن يكون admin أو accountant';
  end if;

  if coalesce(trim(p_email), '') = '' then
    raise exception 'البريد الإلكتروني مطلوب';
  end if;

  insert into public.staff_invites (school_id, email, role, full_name, invited_by)
  values (v_school_id, lower(trim(p_email)), p_role::user_role, nullif(trim(p_full_name), ''), auth.uid())
  on conflict (school_id, email)
  do update set role = p_role::user_role, full_name = nullif(trim(p_full_name), ''), status = 'pending'
  returning id into v_invite_id;

  insert into public.audit_log (school_id, actor_id, action, details)
  values (v_school_id, auth.uid(), 'دعوة عضو طاقم',
          lower(trim(p_email)) || ' (' || (case p_role when 'admin' then 'إداري' else 'محاسب' end) || ')');

  return v_invite_id;
end;
$$;

grant execute on function public.invite_staff(text,text,text) to authenticated;

-- (3) دالة: عند تسجيل مستخدم جديد، تُربط دعوته تلقائياً (يستدعيها التطبيق بعد التسجيل)
create or replace function public.accept_staff_invite()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email  text;
  v_invite record;
begin
  select email into v_email from auth.users where id = auth.uid();
  if v_email is null then
    return jsonb_build_object('ok', false, 'reason', 'no_user');
  end if;

  -- ابحث عن دعوة معلّقة بهذا البريد
  select * into v_invite from public.staff_invites
  where email = lower(v_email) and status = 'pending' limit 1;

  if v_invite.id is null then
    return jsonb_build_object('ok', false, 'reason', 'no_invite');
  end if;

  -- أنشئ/حدّث ملف المستخدم بالدور والمدرسة
  insert into public.profiles (id, school_id, role, full_name)
  values (auth.uid(), v_invite.school_id, v_invite.role, coalesce(v_invite.full_name, split_part(v_email, '@', 1)))
  on conflict (id) do update
    set school_id = v_invite.school_id, role = v_invite.role;

  update public.staff_invites
  set status = 'accepted', accepted_at = now()
  where id = v_invite.id;

  return jsonb_build_object('ok', true, 'role', v_invite.role, 'school_id', v_invite.school_id);
end;
$$;

grant execute on function public.accept_staff_invite() to authenticated;

select 'تم إنشاء نظام دعوة الطاقم (staff_invites + invite_staff + accept_staff_invite)' as status;
