-- تقرير المدفوعات اليومية بأسماء الطلاب — للمتابعة اليومية
-- آمن: SECURITY DEFINER + search_path مثبّت + معزول بـ my_school_id() + للطاقم المالي فقط
CREATE OR REPLACE FUNCTION public.daily_payments_report(p_date date DEFAULT CURRENT_DATE)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_school uuid;
  v_role   text;
  v_items  jsonb;
  v_total  numeric;
  v_cash   numeric;
  v_bank   numeric;
  v_count  int;
BEGIN
  v_school := public.my_school_id();
  v_role   := public.my_role();

  -- لا مدرسة → لا بيانات
  IF v_school IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_school');
  END IF;

  -- الصلاحية: المالك/المدير/المحاسب فقط (نفس صلاحية الوصول المالي)
  IF v_role NOT IN ('owner','admin','accountant','platform_admin') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  -- بنود المدفوعات لليوم المحدد (معزولة بالمدرسة)
  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.created_at), '[]'::jsonb)
    INTO v_items
  FROM (
    SELECT
      st.full_name   AS student_name,
      st.code        AS student_code,
      st.grade       AS grade,
      sf.description  AS fee_description,
      p.amount       AS amount,
      p.method       AS method,
      p.created_at   AS created_at
    FROM public.payments p
    JOIN public.student_fees sf ON sf.id = p.fee_id
    JOIN public.students st     ON st.id = sf.student_id
    WHERE p.school_id = v_school
      AND p.deleted_at IS NULL
      AND p.paid_at = p_date
  ) t;

  -- الإجماليات
  SELECT
    COALESCE(SUM(p.amount), 0),
    COALESCE(SUM(p.amount) FILTER (WHERE p.method = 'cash'), 0),
    COALESCE(SUM(p.amount) FILTER (WHERE p.method <> 'cash'), 0),
    COUNT(*)
  INTO v_total, v_cash, v_bank, v_count
  FROM public.payments p
  WHERE p.school_id = v_school
    AND p.deleted_at IS NULL
    AND p.paid_at = p_date;

  RETURN jsonb_build_object(
    'ok', true,
    'date', p_date,
    'count', v_count,
    'total', v_total,
    'cash', v_cash,
    'bank', v_bank,
    'items', v_items
  );
END;
$$;

-- صلاحية التنفيذ للمستخدمين المسجّلين (الدالة نفسها تفلتر بالدور)
REVOKE ALL ON FUNCTION public.daily_payments_report(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.daily_payments_report(date) TO authenticated;