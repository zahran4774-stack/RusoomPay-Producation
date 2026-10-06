create table if not exists public.meal_orders (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  student_id uuid not null references public.students(id),
  plan_id uuid not null references public.meal_plans(id),
  meal_date date not null,
  created_at timestamptz not null default now(),
  unique (student_id, plan_id, meal_date)
);

alter table public.meal_orders enable row level security;

create policy meal_orders_staff_all on public.meal_orders
for all to authenticated
using (school_id = public.my_school_id() and public.my_role() in ('owner','admin','accountant'))
with check (school_id = public.my_school_id() and public.my_role() in ('owner','admin','accountant'));

create policy meal_orders_guardian_select on public.meal_orders
for select to authenticated
using (exists (
  select 1 from public.parent_students ps
  where ps.student_id = meal_orders.student_id and ps.parent_id = auth.uid()
));

create or replace function public.record_meal_taken(p_student_id uuid, p_plan_id uuid, p_date date default current_date)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_school uuid;
begin
  v_school := public.my_school_id();
  if v_school is null or public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح بتسجيل الوجبات';
  end if;
  insert into public.meal_orders(school_id, student_id, plan_id, meal_date)
  values (v_school, p_student_id, p_plan_id, p_date)
  on conflict (student_id, plan_id, meal_date) do nothing;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.record_meals_today_bulk(p_date date default current_date)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_school uuid; v_count int := 0;
begin
  v_school := public.my_school_id();
  if v_school is null or public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح بتسجيل الوجبات';
  end if;

  insert into public.meal_orders(school_id, student_id, plan_id, meal_date)
  select ms.school_id, ms.student_id, ms.plan_id, p_date
  from public.meal_subscriptions ms
  join public.students st on st.id = ms.student_id
  where ms.school_id = v_school and st.status = 'active'
  on conflict (student_id, plan_id, meal_date) do nothing;

  get diagnostics v_count = row_count;
  return jsonb_build_object('ok', true, 'recorded', v_count);
end;
$$;

create or replace function public.unrecord_meal_taken(p_student_id uuid, p_plan_id uuid, p_date date)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_school uuid;
begin
  v_school := public.my_school_id();
  if v_school is null or public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح';
  end if;
  delete from public.meal_orders
  where school_id = v_school and student_id = p_student_id and plan_id = p_plan_id and meal_date = p_date;
end;
$$;

revoke all on function public.record_meal_taken(uuid, uuid, date) from public, anon;
grant execute on function public.record_meal_taken(uuid, uuid, date) to authenticated;
revoke all on function public.record_meals_today_bulk(date) from public, anon;
grant execute on function public.record_meals_today_bulk(date) to authenticated;
revoke all on function public.unrecord_meal_taken(uuid, uuid, date) from public, anon;
grant execute on function public.unrecord_meal_taken(uuid, uuid, date) to authenticated;

create or replace function public.bill_cafeteria(p_month text)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
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
    select mo.student_id, mp.name as plan_name, mp.fee as unit_fee, count(*) as meals_count
    from public.meal_orders mo
    join public.meal_plans mp on mp.id = mo.plan_id
    join public.students st on st.id = mo.student_id
    where mo.school_id = v_school and st.status = 'active'
      and to_char(mo.meal_date, 'YYYY-MM') = p_month
    group by mo.student_id, mp.name, mp.fee
    having count(*) > 0
  loop
    insert into public.student_fees(school_id, student_id, description, total, paid, due_date)
    values (v_school, r.student_id,
            'تغذية مدرسية شهرية — ' || r.plan_name || ' (' || r.meals_count || ' وجبة × ' ||
              to_char(r.unit_fee,'FM999990.000') || ') — ' || p_month,
            r.unit_fee * r.meals_count, 0, (p_month || '-01')::date);
    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    raise exception 'لا توجد وجبات مسجّلة لهذا الشهر';
  end if;

  insert into public.cafeteria_billing(school_id, month) values (v_school, p_month);
  return v_count;
end;
$function$;

create or replace function public.bill_cafeteria_student(p_student_id uuid, p_month text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_school uuid;
  r record;
  v_count int := 0;
begin
  v_school := public.my_school_id();
  if v_school is null or public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح بفوترة التغذية';
  end if;
  if p_month is null or p_month !~ '^\d{4}-\d{2}$' then
    raise exception 'صيغة الشهر غير صحيحة (YYYY-MM)';
  end if;

  perform public.ensure_cafeteria_account();

  for r in
    select mo.student_id, mp.name as plan_name, mp.fee as unit_fee, count(*) as meals_count
    from public.meal_orders mo
    join public.meal_plans mp on mp.id = mo.plan_id
    join public.students st on st.id = mo.student_id
    where mo.school_id = v_school and st.status = 'active'
      and to_char(mo.meal_date, 'YYYY-MM') = p_month
      and mo.student_id = p_student_id
    group by mo.student_id, mp.name, mp.fee
    having count(*) > 0
  loop
    if exists (
      select 1 from public.student_fees
      where student_id = r.student_id
        and description like 'تغذية مدرسية شهرية — ' || r.plan_name || '%' || p_month
    ) then
      continue;
    end if;

    insert into public.student_fees(school_id, student_id, description, total, paid, due_date)
    values (v_school, r.student_id,
            'تغذية مدرسية شهرية — ' || r.plan_name || ' (' || r.meals_count || ' وجبة × ' ||
              to_char(r.unit_fee,'FM999990.000') || ') — ' || p_month,
            r.unit_fee * r.meals_count, 0, (p_month || '-01')::date);
    v_count := v_count + 1;
  end loop;

  return jsonb_build_object('ok', true, 'invoices_created', v_count);
end;
$$;
