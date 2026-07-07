-- ============================================================================
-- EduPay — النقل المدرسي (Transport / Buses)
-- باصات بمسار وسائق وسعر وجهة دفع (مدرسة/سائق/توصيل خاص) + اشتراك الطلاب + فوترة
-- ينفّذ بعد 01..13
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) الباصات
--    pay_to: school = إيراد للمدرسة (يُفوتر) · driver = للسائق مباشرة · private = توصيل خاص
-- ----------------------------------------------------------------------------
create table if not exists public.buses (
  id          uuid primary key default uuid_generate_v4(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  route       text not null,                           -- المسار
  driver      text not null,                           -- اسم السائق
  capacity    int not null default 30,
  fee         numeric(12,3) not null default 0,        -- الرسم الشهري
  pay_to      text not null default 'school',          -- school | driver | private
  created_at  timestamptz not null default now()
);
create index if not exists idx_buses_school on public.buses(school_id);

-- اشتراك الطالب في باص
create table if not exists public.bus_subscriptions (
  id          uuid primary key default uuid_generate_v4(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  student_id  uuid not null references public.students(id) on delete cascade,
  bus_id      uuid not null references public.buses(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (student_id)
);
create index if not exists idx_bus_subs_school on public.bus_subscriptions(school_id);

-- تتبّع أشهر فوترة النقل
create table if not exists public.transport_billing (
  id          uuid primary key default uuid_generate_v4(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  month       text not null,
  billed_at   timestamptz not null default now(),
  unique (school_id, month)
);

alter table public.buses enable row level security;
alter table public.bus_subscriptions enable row level security;
alter table public.transport_billing enable row level security;

-- ----------------------------------------------------------------------------
-- 2) سياسات RLS
-- ----------------------------------------------------------------------------
create policy buses_rw on public.buses
  for all using (school_id = public.my_school_id())
  with check (school_id = public.my_school_id() and public.my_role() in ('owner','admin','accountant'));

create policy bus_subs_rw on public.bus_subscriptions
  for all using (school_id = public.my_school_id())
  with check (school_id = public.my_school_id() and public.my_role() in ('owner','admin','accountant'));

create policy tr_billing_read on public.transport_billing
  for select using (school_id = public.my_school_id());
create policy tr_billing_insert on public.transport_billing
  for insert with check (school_id = public.my_school_id() and public.my_role() in ('owner','admin','accountant'));

-- ----------------------------------------------------------------------------
-- 3) حساب إيرادات النقل (4210)
-- ----------------------------------------------------------------------------
create or replace function public.ensure_transport_account()
returns void
language plpgsql security definer set search_path = public as $$
declare v_school uuid;
begin
  v_school := public.my_school_id();
  if v_school is null then return; end if;
  insert into public.accounts(school_id, code, name, type)
  select v_school, '4210', 'إيرادات النقل المدرسي', 'revenue'
  where not exists (select 1 from public.accounts where school_id = v_school and code = '4210');
end;
$$;

-- ----------------------------------------------------------------------------
-- 4) إضافة باص
-- ----------------------------------------------------------------------------
create or replace function public.save_bus(
  p_route text,
  p_driver text,
  p_capacity int,
  p_fee numeric,
  p_pay_to text
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_school uuid; v_id uuid;
begin
  v_school := public.my_school_id();
  if v_school is null or public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح بإدارة الباصات';
  end if;
  if coalesce(trim(p_route),'') = '' or coalesce(trim(p_driver),'') = '' then
    raise exception 'المسار واسم السائق مطلوبان';
  end if;
  if coalesce(p_fee,0) <= 0 then raise exception 'الرسم الشهري يجب أن يكون أكبر من صفر'; end if;
  if coalesce(p_pay_to,'school') not in ('school','driver','private') then
    raise exception 'جهة الدفع غير صحيحة';
  end if;

  insert into public.buses(school_id, route, driver, capacity, fee, pay_to)
  values (v_school, p_route, p_driver, coalesce(p_capacity,30), p_fee, coalesce(p_pay_to,'school'))
  returning id into v_id;
  return v_id;
end;
$$;

-- اشتراك طالب في باص
create or replace function public.subscribe_bus(p_student uuid, p_bus uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_school uuid;
begin
  v_school := public.my_school_id();
  if v_school is null or public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح';
  end if;
  if not exists (select 1 from public.students where id = p_student and school_id = v_school) then
    raise exception 'الطالب غير موجود في مدرستك';
  end if;
  if not exists (select 1 from public.buses where id = p_bus and school_id = v_school) then
    raise exception 'الباص غير موجود في مدرستك';
  end if;
  insert into public.bus_subscriptions(school_id, student_id, bus_id)
  values (v_school, p_student, p_bus)
  on conflict (student_id) do update set bus_id = excluded.bus_id;
end;
$$;

create or replace function public.unsubscribe_bus(p_student uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح';
  end if;
  delete from public.bus_subscriptions
  where student_id = p_student and school_id = public.my_school_id();
end;
$$;

-- ----------------------------------------------------------------------------
-- 5) فوترة النقل — باصات المدرسة فقط (school)، تتخطّى driver/private
-- ----------------------------------------------------------------------------
create or replace function public.bill_transport(p_month text)
returns int
language plpgsql security definer set search_path = public as $$
declare v_school uuid; v_count int := 0; r record;
begin
  v_school := public.my_school_id();
  if v_school is null or public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح بفوترة النقل';
  end if;
  if p_month is null or p_month !~ '^\d{4}-\d{2}$' then
    raise exception 'صيغة الشهر غير صحيحة (YYYY-MM)';
  end if;
  if exists (select 1 from public.transport_billing where school_id = v_school and month = p_month) then
    raise exception 'تمت فوترة هذا الشهر مسبقاً';
  end if;

  perform public.ensure_transport_account();

  for r in
    select bs.student_id, b.route, b.fee
    from public.bus_subscriptions bs
    join public.buses b on b.id = bs.bus_id
    join public.students st on st.id = bs.student_id
    where bs.school_id = v_school and st.status = 'active'
      and b.pay_to = 'school'                          -- المدرسة تُفوتر باصاتها فقط
  loop
    insert into public.student_fees(school_id, student_id, description, total, paid, due_date)
    values (v_school, r.student_id,
            'نقل مدرسي شهري — ' || r.route || ' (' || p_month || ')',
            r.fee, 0, (p_month || '-01')::date);
    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    raise exception 'لا يوجد مشتركون يُفوترون عبر المدرسة';
  end if;

  insert into public.transport_billing(school_id, month) values (v_school, p_month);
  return v_count;
end;
$$;

-- ----------------------------------------------------------------------------
-- 6) عرض الباصات مع عدد المشتركين
-- ----------------------------------------------------------------------------
create or replace function public.transport_buses()
returns table(id uuid, route text, driver text, capacity int, fee numeric, pay_to text, subscribers bigint)
language sql stable security definer set search_path = public as $$
  select b.id, b.route, b.driver, b.capacity, b.fee, b.pay_to,
    (select count(*) from public.bus_subscriptions bs
       join public.students s on s.id = bs.student_id
       where bs.bus_id = b.id and s.status = 'active') as subscribers
  from public.buses b
  where b.school_id = public.my_school_id()
  order by b.created_at;
$$;

create or replace function public.transport_subscribers()
returns table(student_id uuid, student_name text, guardian text, route text)
language sql stable security definer set search_path = public as $$
  select s.id, s.full_name, s.guardian_name, b.route
  from public.bus_subscriptions bs
  join public.students s on s.id = bs.student_id
  join public.buses b on b.id = bs.bus_id
  where bs.school_id = public.my_school_id() and s.status = 'active'
  order by s.full_name;
$$;

grant execute on function public.save_bus(text,text,int,numeric,text) to authenticated;
grant execute on function public.subscribe_bus(uuid,uuid) to authenticated;
grant execute on function public.unsubscribe_bus(uuid) to authenticated;
grant execute on function public.bill_transport(text) to authenticated;
grant execute on function public.transport_buses() to authenticated;
grant execute on function public.transport_subscribers() to authenticated;
grant execute on function public.ensure_transport_account() to authenticated;
