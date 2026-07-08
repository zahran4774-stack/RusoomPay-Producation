-- ============================================================================
-- EduPay — التغذية المدرسية (Cafeteria / Meal Plans)
-- باقات تغذية + اشتراكات الطلاب + فوترة شهرية تدخل كإيراد للمدرسة
-- ينفّذ بعد 01..12
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) باقات التغذية
-- ----------------------------------------------------------------------------
create table if not exists public.meal_plans (
  id          uuid primary key default uuid_generate_v4(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  name        text not null,                          -- إفطار يومي، إفطار+غداء...
  fee         numeric(12,3) not null default 0,       -- الرسم الشهري
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists idx_meal_plans_school on public.meal_plans(school_id);

-- ----------------------------------------------------------------------------
-- 2) اشتراك الطالب في باقة تغذية (طالب واحد ← باقة واحدة فعّالة)
-- ----------------------------------------------------------------------------
create table if not exists public.meal_subscriptions (
  id          uuid primary key default uuid_generate_v4(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  student_id  uuid not null references public.students(id) on delete cascade,
  plan_id     uuid not null references public.meal_plans(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (student_id)                                  -- اشتراك واحد فعّال لكل طالب
);
create index if not exists idx_meal_subs_school on public.meal_subscriptions(school_id);

-- ----------------------------------------------------------------------------
-- 3) تتبّع أشهر الفوترة (منع الفوترة المزدوجة لنفس الشهر)
-- ----------------------------------------------------------------------------
create table if not exists public.cafeteria_billing (
  id          uuid primary key default uuid_generate_v4(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  month       text not null,                           -- 2026-06
  billed_at   timestamptz not null default now(),
  unique (school_id, month)
);

alter table public.meal_plans enable row level security;
alter table public.meal_subscriptions enable row level security;
alter table public.cafeteria_billing enable row level security;

-- ----------------------------------------------------------------------------
-- 4) سياسات RLS — طاقم المدرسة يدير تغذية مدرسته فقط
-- ----------------------------------------------------------------------------
create policy meal_plans_rw on public.meal_plans
  for all using (school_id = public.my_school_id())
  with check (school_id = public.my_school_id() and public.my_role() in ('owner','admin','accountant'));

create policy meal_subs_rw on public.meal_subscriptions
  for all using (school_id = public.my_school_id())
  with check (school_id = public.my_school_id() and public.my_role() in ('owner','admin','accountant'));

create policy caf_billing_read on public.cafeteria_billing
  for select using (school_id = public.my_school_id());
create policy caf_billing_insert on public.cafeteria_billing
  for insert with check (school_id = public.my_school_id() and public.my_role() in ('owner','admin','accountant'));

-- ----------------------------------------------------------------------------
-- 5) حساب إيرادات التغذية (4220) — يُضاف لشجرة كل مدرسة إن لم يوجد
-- ----------------------------------------------------------------------------
create or replace function public.ensure_cafeteria_account()
returns void
language plpgsql security definer set search_path = public as $$
declare v_school uuid;
begin
  v_school := public.my_school_id();
  if v_school is null then return; end if;
  insert into public.accounts(school_id, code, name, type)
  select v_school, '4220', 'إيرادات التغذية المدرسية', 'revenue'
  where not exists (
    select 1 from public.accounts where school_id = v_school and code = '4220'
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 6) إضافة/تعديل باقة تغذية
-- ----------------------------------------------------------------------------
create or replace function public.save_meal_plan(
  p_name text,
  p_fee numeric
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_school uuid; v_id uuid;
begin
  v_school := public.my_school_id();
  if v_school is null or public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح بإدارة باقات التغذية';
  end if;
  if coalesce(trim(p_name),'') = '' then raise exception 'اسم الباقة مطلوب'; end if;
  if coalesce(p_fee,0) <= 0 then raise exception 'الرسم الشهري يجب أن يكون أكبر من صفر'; end if;

  insert into public.meal_plans(school_id, name, fee)
  values (v_school, p_name, p_fee)
  returning id into v_id;
  return v_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- 7) اشتراك طالب في باقة (upsert — يستبدل اشتراكه السابق)
-- ----------------------------------------------------------------------------
create or replace function public.subscribe_meal(
  p_student uuid,
  p_plan uuid
)
returns void
language plpgsql security definer set search_path = public as $$
declare v_school uuid;
begin
  v_school := public.my_school_id();
  if v_school is null or public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح';
  end if;
  -- تأكّد أن الطالب والباقة من نفس المدرسة
  if not exists (select 1 from public.students where id = p_student and school_id = v_school) then
    raise exception 'الطالب غير موجود في مدرستك';
  end if;
  if not exists (select 1 from public.meal_plans where id = p_plan and school_id = v_school) then
    raise exception 'الباقة غير موجودة في مدرستك';
  end if;

  insert into public.meal_subscriptions(school_id, student_id, plan_id)
  values (v_school, p_student, p_plan)
  on conflict (student_id) do update set plan_id = excluded.plan_id;
end;
$$;

-- إلغاء اشتراك طالب
create or replace function public.unsubscribe_meal(p_student uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح';
  end if;
  delete from public.meal_subscriptions
  where student_id = p_student and school_id = public.my_school_id();
end;
$$;

-- ----------------------------------------------------------------------------
-- 8) فوترة التغذية الشهرية — تُنشئ رسوماً لكل مشترك (إيراد للمدرسة)
-- ----------------------------------------------------------------------------
create or replace function public.bill_cafeteria(p_month text)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_school uuid;
  v_count int := 0;
  r record;
begin
  v_school := public.my_school_id();
  if v_school is null or public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح بفوترة التغذية';
  end if;
  if p_month is null or p_month !~ '^\d{4}-\d{2}$' then
    raise exception 'صيغة الشهر غير صحيحة (YYYY-MM)';
  end if;
  if exists (select 1 from public.cafeteria_billing where school_id = v_school and month = p_month) then
    raise exception 'تمت فوترة هذا الشهر مسبقاً';
  end if;

  perform public.ensure_cafeteria_account();

  for r in
    select ms.student_id, mp.name as plan_name, mp.fee
    from public.meal_subscriptions ms
    join public.meal_plans mp on mp.id = ms.plan_id
    join public.students st on st.id = ms.student_id
    where ms.school_id = v_school and st.status = 'active'
  loop
    insert into public.student_fees(school_id, student_id, description, total, paid, due_date)
    values (v_school, r.student_id,
            'تغذية مدرسية شهرية — ' || r.plan_name || ' (' || p_month || ')',
            r.fee, 0, (p_month || '-01')::date);
    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    raise exception 'لا يوجد مشتركون في التغذية';
  end if;

  insert into public.cafeteria_billing(school_id, month) values (v_school, p_month);
  return v_count;
end;
$$;

-- ----------------------------------------------------------------------------
-- 9) عرض باقات التغذية مع عدد المشتركين
-- ----------------------------------------------------------------------------
create or replace function public.cafeteria_plans()
returns table(id uuid, name text, fee numeric, subscribers bigint)
language sql stable security definer set search_path = public as $$
  select mp.id, mp.name, mp.fee,
    (select count(*) from public.meal_subscriptions ms
       join public.students s on s.id = ms.student_id
       where ms.plan_id = mp.id and s.status = 'active') as subscribers
  from public.meal_plans mp
  where mp.school_id = public.my_school_id() and mp.active
  order by mp.created_at;
$$;

-- عرض الطلاب المشتركين
create or replace function public.cafeteria_subscribers()
returns table(student_id uuid, student_name text, guardian text, plan_name text)
language sql stable security definer set search_path = public as $$
  select s.id, s.full_name, s.guardian_name, mp.name
  from public.meal_subscriptions ms
  join public.students s on s.id = ms.student_id
  join public.meal_plans mp on mp.id = ms.plan_id
  where ms.school_id = public.my_school_id() and s.status = 'active'
  order by s.full_name;
$$;

grant execute on function public.save_meal_plan(text,numeric) to authenticated;
grant execute on function public.subscribe_meal(uuid,uuid) to authenticated;
grant execute on function public.unsubscribe_meal(uuid) to authenticated;
grant execute on function public.bill_cafeteria(text) to authenticated;
grant execute on function public.cafeteria_plans() to authenticated;
grant execute on function public.cafeteria_subscribers() to authenticated;
grant execute on function public.ensure_cafeteria_account() to authenticated;
