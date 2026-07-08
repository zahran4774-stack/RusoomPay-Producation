-- ============================================================================
-- EduPay — دالة ملخّص لوحة التحكم الموحّدة
-- تجمع كل مؤشرات اللوحة (تشغيلية + تحليلية) في استدعاء واحد بكفاءة
-- ينفّذ بعد 01..06
-- ============================================================================

create or replace function public.dashboard_summary()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
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
begin
  if v_school is null then
    return jsonb_build_object('error', 'no_school');
  end if;

  -- أعداد أساسية
  select count(*) into v_students from public.students where school_id = v_school and status = 'active';
  select count(*) into v_employees from public.employees where school_id = v_school;

  -- التحصيل: الإجمالي والمدفوع والمتأخر
  select coalesce(sum(total),0), coalesce(sum(paid),0)
    into v_fees_total, v_fees_paid
    from public.student_fees where school_id = v_school;

  select count(*) into v_overdue
    from public.student_fees
    where school_id = v_school and (total - paid) > 0.0005
      and due_date is not null and due_date < current_date;

  -- طلبات الرواتب المعلّقة (تشغيلي — يحتاج إجراء)
  select count(*) into v_pending_salary
    from public.salary_requests where school_id = v_school and status = 'pending';

  -- الإيرادات والمصروفات (تحليلي — من المحاسبة)
  select
    coalesce(-sum(case when a.type='revenue' then l.debit - l.credit else 0 end),0),
    coalesce( sum(case when a.type='expense' then l.debit - l.credit else 0 end),0)
    into v_revenue, v_expense
    from public.journal_lines l
    join public.accounts a on a.id = l.account_id and a.school_id = v_school
    where l.school_id = v_school;

  v_result := jsonb_build_object(
    -- تشغيلي (آني — يحتاج متابعة)
    'students', v_students,
    'employees', v_employees,
    'overdue_count', v_overdue,
    'pending_salary', v_pending_salary,
    'collection_rate', case when v_fees_total > 0 then round(v_fees_paid / v_fees_total * 100) else 100 end,
    'outstanding', round(v_fees_total - v_fees_paid, 3),
    -- تحليلي (تراكمي — للتقييم)
    'fees_total', round(v_fees_total, 3),
    'fees_paid', round(v_fees_paid, 3),
    'revenue', round(v_revenue, 3),
    'expense', round(v_expense, 3),
    'profit', round(v_revenue - v_expense, 3)
  );

  return v_result;
end; $$;

-- ============================================================================
-- ملاحظة: تُرجع JSON واحد بكل المؤشرات — استدعاء واحد بدل 6 استعلامات.
-- RLS يضمن أن كل مدرسة ترى بياناتها فقط (v_school = my_school_id()).
-- ============================================================================
