-- ============================================================================
-- RusoomPay — School Copilot (المساعد التنفيذي الذكي)
-- محرّك قواعد (لا ذكاء اصطناعي في v1) يحسب من البيانات الحقيقية:
--   • الملخّص التنفيذي · التنبيهات · التوصيات · مؤشرات اليوم · درجة صحّة المدرسة
-- كل رؤية مبنية على بيانات فعلية عبر business rules. مصمّم ليُستبدل بـLLM لاحقاً
-- دون تغيير الواجهة.
-- ينفّذ بعد 01..30
-- ============================================================================

create or replace function public.school_copilot()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_school   uuid;
  v_role     text;
  -- مؤشرات مالية وتشغيلية
  v_students        int := 0;
  v_employees       int := 0;
  v_fees_total      numeric := 0;
  v_fees_paid       numeric := 0;
  v_outstanding     numeric := 0;
  v_overdue_count   int := 0;
  v_pending_salary  int := 0;
  v_pending_pay     int := 0;
  v_low_stock       int := 0;
  v_revenue         numeric := 0;
  v_expense         numeric := 0;
  v_collection_rate numeric := 0;
  v_today_collected numeric := 0;
  -- النتائج
  v_alerts          jsonb := '[]'::jsonb;
  v_recos           jsonb := '[]'::jsonb;
  v_health          int := 100;
  v_health_fin      int := 30;
  v_health_ops      int := 15;
  v_health_tasks    int := 15;
  v_health_inv      int := 10;
begin
  v_school := public.my_school_id();
  v_role   := public.my_role();
  if v_school is null then
    return jsonb_build_object('error', 'no_school');
  end if;

  -- ===== جمع البيانات الحقيقية =====
  select count(*) into v_students  from public.students  where school_id = v_school and status = 'active';
  select count(*) into v_employees from public.employees where school_id = v_school;

  select coalesce(sum(total),0), coalesce(sum(paid),0)
    into v_fees_total, v_fees_paid
    from public.student_fees where school_id = v_school;
  v_outstanding := v_fees_total - v_fees_paid;
  if v_fees_total > 0 then
    v_collection_rate := round(v_fees_paid / v_fees_total * 100, 1);
  end if;

  -- المتأخرات: فواتير تجاوز تاريخ استحقاقها ولم تُسدّد بالكامل
  select count(*) into v_overdue_count
    from public.student_fees
    where school_id = v_school and paid < total
      and due_date is not null and due_date < current_date;

  -- طلبات الرواتب المعلّقة
  select count(*) into v_pending_salary
    from public.salary_requests where school_id = v_school and status = 'pending';

  -- مدفوعات أولياء الأمور بانتظار اعتماد المحاسب
  select count(*) into v_pending_pay
    from public.pending_payments where school_id = v_school and status = 'pending';

  -- أصناف المخزون المنخفضة (نفدت أو شارفت)
  select count(*) into v_low_stock
    from public.inventory_items where school_id = v_school and qty <= 3;

  -- التحصيل اليوم (من الدفعات)
  select coalesce(sum(amount),0) into v_today_collected
    from public.payments where school_id = v_school and paid_at = current_date;

  -- الإيرادات والمصروفات (من الحسابات)
  select
    coalesce(sum(case when a.type='revenue' then l.credit - l.debit else 0 end),0),
    coalesce(sum(case when a.type='expense' then l.debit - l.credit else 0 end),0)
    into v_revenue, v_expense
    from public.accounts a
    left join public.journal_lines l on l.account_id = a.id
    where a.school_id = v_school;

  -- ===== توليد التنبيهات (Attention Required) — مرتّبة بالأولوية =====
  if v_overdue_count > 0 then
    v_alerts := v_alerts || jsonb_build_object(
      'severity','high','title', v_overdue_count || ' فاتورة متأخرة عن السداد',
      'detail','رسوم تجاوزت تاريخ استحقاقها','action','send_reminders','action_label','عرض الفواتير المتأخرة','href','/fees?focus=overdue#overdue');
  end if;
  if v_pending_pay > 0 then
    v_alerts := v_alerts || jsonb_build_object(
      'severity','high','title', v_pending_pay || ' دفعة بانتظار اعتمادك',
      'detail','مدفوعات أرسلها أولياء الأمور','action','approve','action_label','مراجعة المدفوعات','href','/fees?focus=pending#pending-payments');
  end if;
  if v_pending_salary > 0 then
    v_alerts := v_alerts || jsonb_build_object(
      'severity','medium','title', v_pending_salary || ' طلب راتب بانتظار الاعتماد',
      'detail','تعديلات رواتب معلّقة','action','approve_salary','action_label','مراجعة الرواتب','href','/employees?focus=salary#salary-requests');
  end if;
  if v_low_stock > 0 then
    v_alerts := v_alerts || jsonb_build_object(
      'severity','medium','title', v_low_stock || ' صنف مخزون منخفض أو نفد',
      'detail','أصناف تحتاج إعادة تعبئة','action','restock','action_label','مراجعة المخزون','href','/inventory?focus=low#low-stock');
  end if;
  if v_collection_rate < 60 and v_fees_total > 0 then
    v_alerts := v_alerts || jsonb_build_object(
      'severity','medium','title','نسبة التحصيل منخفضة (' || v_collection_rate || '%)',
      'detail','التحصيل أقلّ من المستهدف','action','review','action_label','متابعة الرسوم','href','/fees#fees-table');
  end if;

  -- ===== التوصيات (Recommended Actions) =====
  if v_overdue_count > 0 then
    v_recos := v_recos || jsonb_build_object(
      'title','إرسال تذكيرات السداد','reason', v_overdue_count || ' فاتورة متأخرة',
      'benefit','تحسين التحصيل وتقليل المتأخرات','action_label','إرسال التذكيرات','href','/fees?focus=overdue#overdue');
  end if;
  if v_pending_pay > 0 then
    v_recos := v_recos || jsonb_build_object(
      'title','اعتماد مدفوعات أولياء الأمور','reason', v_pending_pay || ' دفعة معلّقة',
      'benefit','تحديث الحسابات وإصدار الفواتير','action_label','فتح المدفوعات','href','/fees?focus=pending#pending-payments');
  end if;
  if v_pending_salary > 0 then
    v_recos := v_recos || jsonb_build_object(
      'title','اعتماد طلبات الرواتب','reason', v_pending_salary || ' طلب معلّق',
      'benefit','إتمام مسير الرواتب في وقته','action_label','فتح الرواتب','href','/employees?focus=salary#salary-requests');
  end if;
  if v_outstanding > 0 and v_overdue_count = 0 then
    v_recos := v_recos || jsonb_build_object(
      'title','متابعة الرسوم المستحقّة','reason','مستحقات قائمة بقيمة ' || round(v_outstanding,3),
      'benefit','تعزيز السيولة النقدية','action_label','عرض الرسوم','href','/fees#fees-table');
  end if;

  -- ===== درجة صحّة المدرسة (0–100) بأوزان =====
  -- المالية 30% — تعتمد نسبة التحصيل
  v_health_fin := round(30 * least(v_collection_rate,100) / 100);
  -- المهام المعلّقة 15% — تنقص مع كثرة المعلّقات
  v_health_tasks := greatest(0, 15 - (v_pending_salary + v_pending_pay) * 2);
  -- العمليات 15% — تنقص مع المتأخرات
  v_health_ops := greatest(0, 15 - v_overdue_count);
  -- المخزون 10% — كامل إن لا نقص
  v_health_inv := case when v_low_stock = 0 then 10 else greatest(0, 10 - v_low_stock) end;
  -- (الحضور والتواصل 30% — نمنحها افتراضياً حتى تُفعّل مصادرها لاحقاً)
  v_health := least(100, v_health_fin + v_health_tasks + v_health_ops + v_health_inv + 30);

  return jsonb_build_object(
    'ok', true,
    'role', v_role,
    'summary', jsonb_build_object(
      'today_collected', v_today_collected,
      'outstanding', v_outstanding,
      'collection_rate', v_collection_rate,
      'pending_approvals', v_pending_salary + v_pending_pay,
      'students', v_students,
      'employees', v_employees,
      'revenue', v_revenue,
      'expense', v_expense
    ),
    'alerts', v_alerts,
    'recommendations', v_recos,
    'kpis', jsonb_build_object(
      'collection_rate', v_collection_rate,
      'outstanding', v_outstanding,
      'overdue_count', v_overdue_count,
      'pending_payments', v_pending_pay,
      'low_stock', v_low_stock
    ),
    'health', jsonb_build_object(
      'score', v_health,
      'status', case when v_health >= 85 then 'ممتاز' when v_health >= 70 then 'جيّد'
                     when v_health >= 50 then 'متوسّط' else 'يحتاج انتباهاً' end,
      'breakdown', jsonb_build_object(
        'financial', v_health_fin, 'operations', v_health_ops,
        'tasks', v_health_tasks, 'inventory', v_health_inv)
    )
  );
end; $$;

grant execute on function public.school_copilot() to authenticated;
