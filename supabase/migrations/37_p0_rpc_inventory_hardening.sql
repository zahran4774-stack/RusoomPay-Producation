-- ============================================================================
-- P0 Hardening (Part 2) — RPC/migration consistency + authorization gaps
-- found during the full RPC inventory.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- P0-8: these three functions were evolved by adding a parameter via
-- CREATE OR REPLACE FUNCTION with a NEW signature. Postgres treats a changed
-- signature as a new overload rather than a replacement, so the OLD
-- signature was never dropped and remained fully callable
-- (register_school's old signature even by `anon`, since school signup is
-- public). App code only ever calls the new signatures (verified via full
-- repo search).
-- ----------------------------------------------------------------------------
drop function if exists public.register_school(
  text, text, text, text, text, text, text, text, text, text, text
);
drop function if exists public.save_bus(
  text, text, integer, numeric, text
);
drop function if exists public.save_inventory_item(
  text, integer, numeric, numeric, numeric
);

-- ----------------------------------------------------------------------------
-- P0-7: exec_sql_diagnostic / exec_sql_diagnostic_v2 have no application
-- callers (verified via full repo search), are granted to PUBLIC + anon
-- (callable by anyone, unauthenticated), leak internal session/role info
-- (current_user, JWT role claim, RLS-bypass status), and exec_sql_diagnostic
-- is SECURITY DEFINER with NO search_path set at all. Pure debug leftovers.
-- ----------------------------------------------------------------------------
drop function if exists public.exec_sql_diagnostic();
drop function if exists public.exec_sql_diagnostic_v2();

-- ----------------------------------------------------------------------------
-- P0-10 (cross-tenant / cross-family authorization): these RPCs are called
-- exclusively from staff-facing pages (verified — none are reachable from
-- app/(app)/parent/) but only filtered by school_id, with no role check. Any
-- authenticated user in the school — including a parent — could call them
-- directly via RPC and see the whole school's data: pending_payments_list
-- leaks guardian phone numbers + bank references for every family;
-- students_without_meal / cafeteria_subscribers / transport_subscribers leak
-- every student's + guardian's name; certificate_requests_list leaks every
-- parent's name + request reasons.
-- ----------------------------------------------------------------------------
create or replace function public.cafeteria_subscribers()
returns table(student_id uuid, student_name text, guardian text, plan_name text, fee numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح';
  end if;
  return query
  select s.id, s.full_name, s.guardian_name, mp.name, mp.fee
  from public.meal_subscriptions ms
  join public.students s on s.id = ms.student_id
  join public.meal_plans mp on mp.id = ms.plan_id
  where ms.school_id = public.my_school_id()
  order by s.full_name;
end;
$$;

create or replace function public.cafeteria_plans()
returns table(id uuid, name text, fee numeric, plan_type text, subscribers bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح';
  end if;
  return query
  select mp.id, mp.name, mp.fee, mp.plan_type,
    (select count(*) from public.meal_subscriptions ms
       join public.students s on s.id = ms.student_id
       where ms.plan_id = mp.id and s.status = 'active') as subscribers
  from public.meal_plans mp
  where mp.school_id = public.my_school_id() and mp.active
  order by mp.created_at;
end;
$$;

create or replace function public.certificate_requests_list(p_status text default 'pending')
returns table(id uuid, student_id uuid, student_name text, parent_name text, kind text, status text, reason text, created_at timestamptz, reviewed_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح';
  end if;
  return query
  select cr.id, cr.student_id, s.full_name, p.full_name, cr.kind, cr.status, cr.reason, cr.created_at, cr.reviewed_at
  from public.certificate_requests cr
  join public.students s on s.id = cr.student_id
  join public.profiles p on p.id = cr.parent_id
  where cr.school_id = public.my_school_id()
    and (p_status is null or cr.status = p_status)
  order by cr.created_at desc;
end;
$$;

create or replace function public.pending_payments_list(p_page integer default 1, p_page_size integer default 20)
returns table(id uuid, guardian text, student text, amount numeric, method text, bank_ref text, created_at timestamptz, guardian_phone text, school_name text, total_count bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح';
  end if;
  return query
  select pp.id,
    coalesce(g.full_name,'ولي أمر'), s.full_name,
    pp.amount, pp.method, pp.bank_ref, pp.created_at,
    coalesce(g.phone, s.guardian_phone),
    sch.name,
    count(*) over() as total_count
  from public.pending_payments pp
  join public.student_fees f on f.id = pp.fee_id
  join public.students s on s.id = f.student_id
  left join public.profiles g on g.id = pp.guardian_id
  left join public.schools sch on sch.id = pp.school_id
  where pp.school_id = public.my_school_id() and pp.status = 'pending'
    and (pp.method <> 'thawani' or pp.txn_state = 'failed')
  order by pp.created_at
  limit greatest(1, least(coalesce(p_page_size, 20), 100))
  offset greatest(0, (coalesce(p_page, 1) - 1) * greatest(1, least(coalesce(p_page_size, 20), 100)));
end;
$$;

create or replace function public.students_without_meal()
returns table(id uuid, full_name text, guardian_name text)
language plpgsql stable security definer set search_path = public as $$
begin
  if public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح';
  end if;
  return query
  select s.id, s.full_name, s.guardian_name
  from public.students s
  where s.school_id = public.my_school_id()
    and not exists (
      select 1 from public.meal_subscriptions ms
      where ms.student_id = s.id and ms.school_id = s.school_id
    )
  order by s.full_name;
end;
$$;

create or replace function public.transport_buses()
returns table(id uuid, routes text[], routes_label text, driver text, supervisor text, capacity integer, fee numeric, pay_to text, subscribers bigint)
language plpgsql security definer set search_path = public as $$
begin
  if public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح';
  end if;
  return query
  select b.id, b.routes, array_to_string(b.routes, '، '), b.driver, b.supervisor,
    b.capacity, b.fee, b.pay_to,
    (select count(*) from public.bus_subscriptions bs
       join public.students s on s.id = bs.student_id
       where bs.bus_id = b.id and s.status = 'active') as subscribers
  from public.buses b
  where b.school_id = public.my_school_id()
  order by b.created_at;
end;
$$;

create or replace function public.transport_subscribers()
returns table(id uuid, full_name text, guardian_name text, routes_label text, driver text, supervisor text)
language plpgsql security definer set search_path = public as $$
begin
  if public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح';
  end if;
  return query
  select s.id, s.full_name, s.guardian_name, array_to_string(b.routes, '، '), b.driver, b.supervisor
  from public.bus_subscriptions bs
  join public.students s on s.id = bs.student_id
  join public.buses b on b.id = bs.bus_id
  where bs.school_id = public.my_school_id() and s.status = 'active'
  order by s.full_name;
end;
$$;

-- P0-10: create_parent_profile let ANY freshly-authenticated user (no
-- profile yet) join ANY school as a 'parent' by supplying an arbitrary
-- p_school_id — zero verification against real guardian/student records.
-- Zero application callers (verified via full repo search) — the actually
-- used signup path is parent_signup_by_phone, which properly matches
-- against existing students' guardian_phone before ever assigning a
-- school_id. Dropping the dead, dangerous function.
drop function if exists public.create_parent_profile(uuid, text, text);
