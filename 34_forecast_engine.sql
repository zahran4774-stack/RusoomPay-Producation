-- ============================================================================
-- RusoomPay — محرّك التنبّؤ بالتدفّق النقدي (Forecast Engine)
-- المحرّك الثالث في طبقة School Intelligence Core.
-- يتوقّع التحصيل المتوقّع للأشهر الستّة القادمة =
--   المستحقّات القادمة (حسب due_date) × معدّل التحصيل التاريخي الفعلي.
-- يقرأ V1 فقط (student_fees, payments). يحترم مفتاح 'forecast'.
-- ينفّذ بعد 01..33
-- ============================================================================

create or replace function public.cashflow_forecast()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_school   uuid;
  v_rate     numeric;    -- معدّل التحصيل التاريخي (0..1)
  v_billed   numeric;    -- إجمالي ما فُوتِر
  v_paid     numeric;    -- إجمالي ما حُصّل
  v_months   jsonb := '[]'::jsonb;
  m          int;
  v_start    date;
  v_end      date;
  v_due      numeric;    -- مستحقّات هذا الشهر
  v_expected numeric;    -- المتوقّع تحصيله
  v_label    text;
  v_total_expected numeric := 0;
begin
  v_school := public.my_school_id();
  if v_school is null then return jsonb_build_object('error','no_school'); end if;

  -- احترام مفتاح التفعيل
  if not public.intelligence_enabled('forecast') then
    return jsonb_build_object('ok', false, 'disabled', true);
  end if;

  -- معدّل التحصيل التاريخي الفعلي (كم % من المفوتر يُحصّل فعلاً)
  select coalesce(sum(total),0), coalesce(sum(paid),0)
    into v_billed, v_paid
    from public.student_fees where school_id = v_school;
  v_rate := case when v_billed > 0 then least(1.0, v_paid / v_billed) else 0.85 end; -- افتراضي معقول إن لا تاريخ

  -- توقّع 6 أشهر قادمة
  for m in 0..5 loop
    v_start := date_trunc('month', current_date)::date + (m || ' months')::interval;
    v_end   := (date_trunc('month', v_start) + interval '1 month')::date;

    -- المستحقّات غير المسدّدة التي يقع تاريخ استحقاقها في هذا الشهر
    select coalesce(sum(total - paid), 0) into v_due
      from public.student_fees
      where school_id = v_school and paid < total
        and due_date >= v_start and due_date < v_end;

    v_expected := round(v_due * v_rate, 3);
    v_total_expected := v_total_expected + v_expected;

    -- تسمية الشهر بالعربية
    v_label := to_char(v_start, 'YYYY-MM');

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
end; $$;

grant execute on function public.cashflow_forecast() to authenticated;
