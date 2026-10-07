-- إصلاح N+1: كانت الدالة تنفّذ استعلاماً منفصلاً لكل شهر من الأشهر الستة (6 استعلامات).
-- الحل: استعلام واحد يجمّع كل الفواتير غير المسدَّدة ضمن نطاق الأشهر الستة معاً بـ GROUP BY،
-- ثم توزَّع النتائج على الحلقة بالذاكرة (بدون أي استعلام إضافي داخلها).
-- لا تغيير في المنطق أو النتيجة النهائية — فقط في عدد استدعاءات قاعدة البيانات (6 → 1).
CREATE OR REPLACE FUNCTION public.cashflow_forecast()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  v_school   uuid;
  v_rate     numeric;
  v_billed   numeric;
  v_paid     numeric;
  v_months   jsonb := '[]'::jsonb;
  m          int;
  v_start    date;
  v_end      date;
  v_due      numeric;
  v_expected numeric;
  v_label    text;
  v_total_expected numeric := 0;
  v_range_start date;
  v_range_end   date;
  v_due_by_month jsonb;
begin
  v_school := public.my_school_id();
  if v_school is null then return jsonb_build_object('error','no_school'); end if;

  if not public.intelligence_enabled('forecast') then
    return jsonb_build_object('ok', false, 'disabled', true);
  end if;

  select coalesce(sum(total),0), coalesce(sum(paid),0)
    into v_billed, v_paid
    from public.student_fees where school_id = v_school;
  v_rate := case when v_billed > 0 then least(1.0, v_paid / v_billed) else 0.85 end;

  -- استعلام واحد يجلب مستحقات كل الأشهر الستة معاً، مجمَّعة حسب شهر الاستحقاق
  v_range_start := date_trunc('month', current_date)::date;
  v_range_end   := (date_trunc('month', v_range_start) + interval '6 months')::date;

  select coalesce(jsonb_object_agg(month_key, due_amt), '{}'::jsonb)
    into v_due_by_month
  from (
    select to_char(date_trunc('month', due_date), 'YYYY-MM') as month_key,
           sum(total - paid) as due_amt
    from public.student_fees
    where school_id = v_school and paid < total
      and due_date >= v_range_start and due_date < v_range_end
    group by date_trunc('month', due_date)
  ) t;

  -- توزيع النتائج على الأشهر الستة بالذاكرة فقط — بدون أي استعلام إضافي
  for m in 0..5 loop
    v_start := v_range_start + (m || ' months')::interval;
    v_end   := (date_trunc('month', v_start) + interval '1 month')::date;
    v_label := to_char(v_start, 'YYYY-MM');

    v_due := coalesce((v_due_by_month ->> v_label)::numeric, 0);
    v_expected := round(v_due * v_rate, 3);
    v_total_expected := v_total_expected + v_expected;

    v_months := v_months || jsonb_build_object(
      'month', v_label,
      'due', round(v_due, 3),
      'expected', v_expected
    );
  end loop;

  return jsonb_build_object(
    'ok', true,
    'collection_rate', round(v_rate * 100, 1),
    'total_expected_6m', round(v_total_expected, 3),
    'months', v_months
  );
end;
$function$;