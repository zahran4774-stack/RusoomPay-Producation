
-- Part 3 finding: dashboard_summary() aggregated revenue/expense over ALL
-- journal_lines ever created for the school (no date filter), and
-- fees_total/paid/overdue over ALL student_fees ever created — both grow
-- unbounded forever, scanning more rows every single dashboard load.
--
-- Fix: scope all financial figures to the current calendar year (no fiscal
-- year concept exists elsewhere in the schema, so calendar year is the
-- simplest, most standard default). Student/employee counts stay as
-- "current active count" (already correctly bounded, not time-series).
create or replace function public.dashboard_summary()
returns jsonb
language plpgsql stable security definer set search_path = public as $function$
declare
  v_school uuid := public.my_school_id();
  v_result jsonb;
  v_students int;
  v_employees int;
  v_fees_total numeric;
  v_fees_paid numeric;
  v_overdue int;
  v_pending_salary int;
  v_revenue numeric;
  v_expense numeric;
  v_year_start date := date_trunc('year', current_date)::date;
  v_year_end date := (date_trunc('year', current_date) + interval '1 year' - interval '1 day')::date;
begin
  if v_school is null then
    return jsonb_build_object('error', 'no_school');
  end if;

  select count(*) into v_students from public.students where school_id = v_school and status = 'active' and deleted_at is null;
  select count(*) into v_employees from public.employees where school_id = v_school and deleted_at is null;

  -- التحصيل: الإجمالي والمدفوع والمتأخر — مقيّد الآن بالسنة الميلادية
  -- الحالية (حسب تاريخ إنشاء الفاتورة) بدل جمع كل فواتير المدرسة منذ
  -- إنشائها إلى الأبد.
  select coalesce(sum(total),0), coalesce(sum(paid),0)
    into v_fees_total, v_fees_paid
    from public.student_fees
    where school_id = v_school
      and deleted_at is null
      and created_at >= v_year_start and created_at <= v_year_end + interval '1 day';

  select count(*) into v_overdue
    from public.student_fees
    where school_id = v_school and deleted_at is null and (total - paid) > 0.0005
      and due_date is not null and due_date < current_date
      and created_at >= v_year_start and created_at <= v_year_end + interval '1 day';

  select count(*) into v_pending_salary
    from public.salary_requests where school_id = v_school and status = 'pending';

  -- الإيرادات والمصروفات — مقيّدة الآن بالسنة الميلادية الحالية عبر
  -- entry_date بدل جمع كل journal_lines منذ إنشاء المدرسة إلى الأبد.
  select
    coalesce(-sum(case when a.type='revenue' then l.debit - l.credit else 0 end),0),
    coalesce( sum(case when a.type='expense' then l.debit - l.credit else 0 end),0)
    into v_revenue, v_expense
    from public.journal_lines l
    join public.journal_entries e on e.id = l.entry_id
    join public.accounts a on a.id = l.account_id and a.school_id = v_school
    where l.school_id = v_school
      and e.entry_date >= v_year_start and e.entry_date <= v_year_end;

  v_result := jsonb_build_object(
    'students', v_students,
    'employees', v_employees,
    'overdue_count', v_overdue,
    'pending_salary', v_pending_salary,
    'collection_rate', case when v_fees_total > 0 then round(v_fees_paid / v_fees_total * 100) else 100 end,
    'outstanding', round(v_fees_total - v_fees_paid, 3),
    'fees_total', round(v_fees_total, 3),
    'fees_paid', round(v_fees_paid, 3),
    'revenue', round(v_revenue, 3),
    'expense', round(v_expense, 3),
    'profit', round(v_revenue - v_expense, 3),
    'period', 'calendar_year_' || extract(year from current_date)::text
  );

  return v_result;
end; $function$;
