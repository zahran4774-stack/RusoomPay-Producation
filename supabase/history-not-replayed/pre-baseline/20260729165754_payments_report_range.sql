-- تحديث تقرير المدفوعات ليدعم نطاق تواريخ (من/إلى)
-- التوافق الخلفي محفوظ: إن مُرّر p_from فقط = يوم واحد؛ p_to اختياري = يساوي p_from
CREATE OR REPLACE FUNCTION public.daily_payments_report(
  p_date date DEFAULT CURRENT_DATE,   -- يبقى للتوافق مع الاستدعاء القديم (يوم واحد)
  p_to   date DEFAULT NULL            -- نهاية النطاق (اختياري)
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_school uuid;
  v_role   text;
  v_from   date := p_date;
  v_end    date := COALESCE(p_to, p_date);   -- إن لم يُمرّر p_to → يوم واحد
  v_items  jsonb;
  v_total  numeric;
  v_cash   numeric;
  v_bank   numeric;
  v_count  int;
BEGIN
  v_school := public.my_school_id();
  v_role   := public.my_role();

  IF v_school IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_school');
  END IF;

  IF v_role NOT IN ('owner','admin','accountant','platform_admin') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  -- ضمان الترتيب الصحيح للنطاق (لو المستخدم عكس من/إلى)
  IF v_end < v_from THEN
    v_from := COALESCE(p_to, p_date);
    v_end  := p_date;
  END IF;

  -- بنود المدفوعات ضمن النطاق (معزولة بالمدرسة) — مع عمود التاريخ للنطاقات
  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.paid_at DESC, t.created_at DESC), '[]'::jsonb)
    INTO v_items
  FROM (
    SELECT
      st.full_name  AS student_name,
      st.code       AS student_code,
      st.grade      AS grade,
      sf.description AS fee_description,
      p.amount      AS amount,
      p.method      AS method,
      p.paid_at     AS paid_at,
      p.created_at  AS created_at
    FROM public.payments p
    JOIN public.student_fees sf ON sf.id = p.fee_id
    JOIN public.students st     ON st.id = sf.student_id
    WHERE p.school_id = v_school
      AND p.deleted_at IS NULL
      AND p.paid_at >= v_from
      AND p.paid_at <= v_end
  ) t;

  SELECT
    COALESCE(SUM(p.amount), 0),
    COALESCE(SUM(p.amount) FILTER (WHERE p.method = 'cash'), 0),
    COALESCE(SUM(p.amount) FILTER (WHERE p.method <> 'cash'), 0),
    COUNT(*)
  INTO v_total, v_cash, v_bank, v_count
  FROM public.payments p
  WHERE p.school_id = v_school
    AND p.deleted_at IS NULL
    AND p.paid_at >= v_from
    AND p.paid_at <= v_end;

  RETURN jsonb_build_object(
    'ok', true,
    'from', v_from,
    'to', v_end,
    'is_range', (v_from <> v_end),
    'count', v_count,
    'total', v_total,
    'cash', v_cash,
    'bank', v_bank,
    'items', v_items
  );
END;
$$;

REVOKE ALL ON FUNCTION public.daily_payments_report(date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.daily_payments_report(date, date) TO authenticated;