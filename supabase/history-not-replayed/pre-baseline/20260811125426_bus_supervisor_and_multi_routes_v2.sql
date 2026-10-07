
-- 0) إسقاط الدوال التي سيتغيّر شكل مخرجاتها قبل التعديل
drop function if exists public.transport_buses();
drop function if exists public.transport_subscribers();

-- 1) عمود المشرفة + مصفوفة المسارات (تدعم أكثر من مسار للباص الواحد)
alter table public.buses add column if not exists supervisor text;
alter table public.buses add column if not exists routes text[] not null default '{}';

update public.buses
set routes = array[route]
where (routes is null or routes = '{}') and coalesce(trim(route),'') <> '';

-- 2) نسخة جديدة من save_bus تقبل مصفوفة مسارات + اسم المشرفة (النسخة القديمة تبقى للتوافق الخلفي)
create or replace function public.save_bus(
  p_routes text[], p_driver text, p_supervisor text, p_capacity integer, p_fee numeric, p_pay_to text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school uuid; v_id uuid; v_routes text[];
begin
  v_school := public.my_school_id();
  if v_school is null or public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح بإدارة الباصات';
  end if;

  select array_agg(nullif(trim(x),'')) filter (where nullif(trim(x),'') is not null)
    into v_routes from unnest(coalesce(p_routes, '{}')) x;

  if v_routes is null or array_length(v_routes,1) is null then
    raise exception 'مسار واحد على الأقل مطلوب';
  end if;
  if coalesce(trim(p_driver),'') = '' then
    raise exception 'اسم السائق مطلوب';
  end if;
  if coalesce(p_fee,0) <= 0 then raise exception 'الرسم الشهري يجب أن يكون أكبر من صفر'; end if;
  if coalesce(p_pay_to,'school') not in ('school','driver','private') then
    raise exception 'جهة الدفع غير صحيحة';
  end if;

  insert into public.buses(school_id, route, routes, driver, supervisor, capacity, fee, pay_to)
  values (v_school, array_to_string(v_routes,' / '), v_routes, trim(p_driver),
          nullif(trim(p_supervisor),''), coalesce(p_capacity,30), p_fee, coalesce(p_pay_to,'school'))
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.save_bus(text[], text, text, integer, numeric, text) from public;
grant execute on function public.save_bus(text[], text, text, integer, numeric, text) to authenticated;

-- 3) تعديل باص موجود (لم تكن هذه القدرة متاحة سابقًا)
create or replace function public.update_bus(
  p_id uuid, p_routes text[], p_driver text, p_supervisor text, p_capacity integer, p_fee numeric, p_pay_to text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school uuid; v_routes text[];
begin
  v_school := public.my_school_id();
  if v_school is null or public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح بإدارة الباصات';
  end if;

  select array_agg(nullif(trim(x),'')) filter (where nullif(trim(x),'') is not null)
    into v_routes from unnest(coalesce(p_routes, '{}')) x;

  if v_routes is null or array_length(v_routes,1) is null then
    raise exception 'مسار واحد على الأقل مطلوب';
  end if;
  if coalesce(trim(p_driver),'') = '' then
    raise exception 'اسم السائق مطلوب';
  end if;
  if coalesce(p_fee,0) <= 0 then raise exception 'الرسم الشهري يجب أن يكون أكبر من صفر'; end if;
  if coalesce(p_pay_to,'school') not in ('school','driver','private') then
    raise exception 'جهة الدفع غير صحيحة';
  end if;

  update public.buses set
    route = array_to_string(v_routes,' / '), routes = v_routes, driver = trim(p_driver),
    supervisor = nullif(trim(p_supervisor),''), capacity = coalesce(p_capacity,30),
    fee = p_fee, pay_to = coalesce(p_pay_to,'school')
  where id = p_id and school_id = v_school;

  if not found then raise exception 'الباص غير موجود في مدرستك'; end if;
end;
$$;

revoke all on function public.update_bus(uuid, text[], text, text, integer, numeric, text) from public;
grant execute on function public.update_bus(uuid, text[], text, text, integer, numeric, text) to authenticated;

-- 4) عرض الباصات: يضيف المشرفة والمسارات (مصفوفة + نص مُجمَّع للعرض)
create or replace function public.transport_buses()
returns table(
  id uuid, routes text[], routes_label text, driver text, supervisor text,
  capacity int, fee numeric, pay_to text, subscribers bigint
)
language sql
security definer
set search_path = public
as $$
  select b.id, b.routes, array_to_string(b.routes, '، '), b.driver, b.supervisor,
    b.capacity, b.fee, b.pay_to,
    (select count(*) from public.bus_subscriptions bs
       join public.students s on s.id = bs.student_id
       where bs.bus_id = b.id and s.status = 'active') as subscribers
  from public.buses b
  where b.school_id = public.my_school_id()
  order by b.created_at;
$$;

-- 5) كشف الطلاب لكل باص: يضيف المشرفة والمسارات لملف الطباعة
create or replace function public.transport_roster()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school uuid;
  v_result jsonb;
begin
  v_school := my_school_id();
  if v_school is null or my_role() not in ('owner','admin','accountant') then
    return jsonb_build_object('ok', false, 'reason', 'unauthorized');
  end if;

  select jsonb_build_object(
    'ok', true,
    'generated_at', now(),
    'buses', coalesce(jsonb_agg(bus_data order by bus_data->>'routes_label'), '[]'::jsonb)
  ) into v_result
  from (
    select jsonb_build_object(
      'bus_id', b.id,
      'routes', to_jsonb(b.routes),
      'routes_label', array_to_string(b.routes, '، '),
      'driver', b.driver,
      'supervisor', b.supervisor,
      'capacity', b.capacity,
      'fee', b.fee,
      'students', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'student_id', s.id,
          'full_name', s.full_name,
          'grade', s.grade,
          'section', s.section,
          'guardian_name', s.guardian_name,
          'guardian_phone', s.guardian_phone
        ) order by s.grade, s.full_name), '[]'::jsonb)
        from public.bus_subscriptions bs
        join public.students s on s.id = bs.student_id and s.status = 'active'
        where bs.bus_id = b.id
      ),
      'student_count', (
        select count(*)
        from public.bus_subscriptions bs
        join public.students s on s.id = bs.student_id and s.status = 'active'
        where bs.bus_id = b.id
      )
    ) as bus_data
    from public.buses b
    where b.school_id = v_school
  ) sub;

  return v_result;
exception when others then
  return jsonb_build_object('ok', false, 'reason', 'error', 'detail', sqlerrm);
end;
$$;

-- 6) مشتركو النقل: يعرض مسارات الباص المُجمَّعة + المشرفة
create or replace function public.transport_subscribers()
returns table(
  id uuid, full_name text, guardian_name text, routes_label text, driver text, supervisor text
)
language sql
security definer
set search_path = public
as $$
  select s.id, s.full_name, s.guardian_name, array_to_string(b.routes, '، '), b.driver, b.supervisor
  from public.bus_subscriptions bs
  join public.students s on s.id = bs.student_id
  join public.buses b on b.id = bs.bus_id
  where bs.school_id = public.my_school_id() and s.status = 'active'
  order by s.full_name;
$$;
