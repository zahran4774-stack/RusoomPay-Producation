-- ============================================================================
-- RusoomPay — محرّك خطورة التعثّر (Risk Engine)
-- المحرّك الثاني في طبقة School Intelligence Core.
-- يرتّب أولياء الأمور حسب احتمال تأخّرهم عن السداد — أداة تحصيل استباقية.
-- يقرأ V1 فقط (student_fees, payments, students) ولا يكتب فيه.
-- يحترم مفتاح التفعيل 'risk'. ينفّذ بعد 01..32
-- ============================================================================

-- درجة الخطورة لكل ولي أمر (0–100)، محسوبة بقواعد عمل من بيانات حقيقية:
--   • عمر أقدم فاتورة متأخرة  (كلّما زاد → أخطر)
--   • نسبة المبلغ المتبقّي من الإجمالي
--   • عدد الفواتير المتأخرة
--   • سلوك السداد السابق (هل يدفع عادةً؟)
create or replace function public.risk_scores()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_school uuid;
  v_rows   jsonb := '[]'::jsonb;
  r        record;
  v_score      numeric;
  v_age_pts    numeric;
  v_ratio_pts  numeric;
  v_count_pts  numeric;
  v_level      text;
  v_action     text;
begin
  v_school := public.my_school_id();
  if v_school is null then return jsonb_build_object('error','no_school'); end if;

  -- احترام مفتاح التفعيل
  if not public.intelligence_enabled('risk') then
    return jsonb_build_object('ok', false, 'disabled', true);
  end if;

  for r in
    select
      s.id as student_id, s.full_name, s.code,
      coalesce(s.guardian_name, '—') as guardian, s.guardian_phone as phone,
      -- إجماليات الفواتير غير المسدّدة
      coalesce(sum(f.total - f.paid), 0) as outstanding,
      coalesce(sum(f.total), 0)          as total_billed,
      -- عدد الفواتير المتأخرة
      count(*) filter (where f.paid < f.total and f.due_date is not null and f.due_date < current_date) as overdue_count,
      -- عمر أقدم فاتورة متأخرة (بالأيام)
      coalesce(max(current_date - f.due_date) filter (where f.paid < f.total and f.due_date is not null and f.due_date < current_date), 0) as oldest_days
    from public.students s
    join public.student_fees f on f.student_id = s.id and f.school_id = v_school
    where s.school_id = v_school and s.status = 'active'
    group by s.id, s.full_name, s.code, s.guardian_name, s.guardian_phone
    having coalesce(sum(f.total - f.paid), 0) > 0.0005   -- فقط من عليهم مستحقات
    order by
      coalesce(max(current_date - f.due_date) filter (where f.paid < f.total and f.due_date is not null and f.due_date < current_date), 0) desc,
      coalesce(sum(f.total - f.paid), 0) desc
  loop
    -- حساب الدرجة (0–100) بأوزان
    -- عمر التأخّر: حتى 45 نقطة (يتشبّع عند 90 يوماً)
    v_age_pts   := least(45, r.oldest_days::numeric / 90 * 45);
    -- نسبة المتبقّي: حتى 35 نقطة
    v_ratio_pts := case when r.total_billed > 0 then least(35, r.outstanding / r.total_billed * 35) else 0 end;
    -- عدد الفواتير المتأخرة: حتى 20 نقطة (5 نقاط لكلّ، حدّ 4)
    v_count_pts := least(20, r.overdue_count * 5);

    v_score := round(v_age_pts + v_ratio_pts + v_count_pts);
    v_level := case when v_score >= 70 then 'عالية' when v_score >= 40 then 'متوسّطة' else 'منخفضة' end;
    v_action := case
      when v_score >= 70 then 'اتصال مباشر بولي الأمر'
      when v_score >= 40 then 'إرسال تذكير عاجل'
      else 'إرسال تذكير ودّي' end;

    v_rows := v_rows || jsonb_build_object(
      'student_id', r.student_id,
      'student_name', r.full_name,
      'student_code', r.code,
      'guardian', r.guardian,
      'phone', r.phone,
      'outstanding', round(r.outstanding, 3),
      'overdue_count', r.overdue_count,
      'oldest_days', r.oldest_days,
      'score', v_score,
      'level', v_level,
      'action', v_action
    );
  end loop;

  return jsonb_build_object('ok', true, 'items', v_rows);
end; $$;

grant execute on function public.risk_scores() to authenticated;
