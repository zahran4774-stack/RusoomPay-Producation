-- تقرير رواتب الموظفين حسب الفترة (من شهر إلى شهر): سطر لكل دورة راتب + سطر لكل موظف مُجمَّع على الفترة
-- الدورات المعتمدة والمصروفة فقط (نفس أساس payroll_yearly_summary)، والمسودات اختيارياً. الملغاة لا تُحسب أبداً.
-- الاستقطاعات = استقطاعات أخرى + حصة الموظف في التأمينات (مطابقة لـ payroll_runs.total_deduct).
create function public.payroll_report_period(
  p_from_year integer,
  p_from_month integer,
  p_to_year integer,
  p_to_month integer,
  p_include_draft boolean default false
) returns table(
  dim text, yr integer, mo integer, run_status text,
  emp_code text, emp_name text, cnt integer,
  basic numeric, allowances numeric, deductions numeric,
  employer_pasi numeric, net numeric
)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
#variable_conflict use_column
declare
  v_school uuid;
  v_from   integer;
  v_to     integer;
begin
  v_school := public.my_school_id();
  if v_school is null or public.my_role() not in ('owner','accountant') then
    raise exception 'غير مصرّح';
  end if;
  if p_from_month not between 1 and 12 or p_to_month not between 1 and 12 then
    raise exception 'شهر غير صالح';
  end if;

  v_from := p_from_year * 12 + p_from_month;
  v_to   := p_to_year * 12 + p_to_month;
  if v_from > v_to then
    raise exception 'بداية الفترة بعد نهايتها';
  end if;
  if v_to - v_from > 59 then
    raise exception 'الحد الأقصى للفترة 60 شهراً';
  end if;

  return query
  with runs as (
    select r.id as run_id, r.period_year as ry, r.period_month as rm, r.status as rs
    from public.payroll_runs r
    where r.school_id = v_school
      and (r.period_year * 12 + r.period_month) between v_from and v_to
      and (r.status in ('approved','paid') or (p_include_draft and r.status = 'draft'))
  ),
  items as (
    select ru.run_id, ru.ry, ru.rm, ru.rs,
           i.employee_id, i.employee_name,
           i.basic_salary as b,
           i.extra_income as a,
           (i.deductions + i.pasi_employee) as d,
           i.pasi_employer as er,
           i.net_salary as n
    from runs ru
    join public.payroll_items i on i.run_id = ru.run_id
  )
  select 'month'::text, m.ry, m.rm, m.rs, null::text, null::text,
         m.hc, m.sb, m.sa, m.sd, m.ser, m.sn
  from (
    select run_id, ry, rm, rs,
           count(*)::int as hc,
           round(sum(b), 3) as sb, round(sum(a), 3) as sa, round(sum(d), 3) as sd,
           round(sum(er), 3) as ser, round(sum(n), 3) as sn
    from items
    group by run_id, ry, rm, rs
  ) m
  union all
  select 'employee'::text, null::int, null::int, null::text, e.code, x.nm,
         x.cn, x.sb, x.sa, x.sd, x.ser, x.sn
  from (
    select employee_id,
           (array_agg(employee_name order by ry desc, rm desc))[1] as nm,
           count(*)::int as cn,
           round(sum(b), 3) as sb, round(sum(a), 3) as sa, round(sum(d), 3) as sd,
           round(sum(er), 3) as ser, round(sum(n), 3) as sn
    from items
    group by employee_id
  ) x
  left join public.employees e on e.id = x.employee_id;
end;
$function$;

revoke all on function public.payroll_report_period(integer, integer, integer, integer, boolean) from public, anon;
grant execute on function public.payroll_report_period(integer, integer, integer, integer, boolean) to authenticated;