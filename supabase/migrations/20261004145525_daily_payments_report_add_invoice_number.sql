CREATE OR REPLACE FUNCTION public.daily_payments_report(p_date date DEFAULT CURRENT_DATE, p_to date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_school uuid;
  v_role   text;
  v_from   date;
  v_until  date;
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

  -- تحديد النطاق: لو p_to فاضي، النطاق = يوم واحد (p_date)
  v_from  := p_date;
  v_until := COALESCE(p_to, p_date);

  -- تصحيح تلقائي لو انعكس الترتيب
  IF v_until < v_from THEN
    v_from  := p_to;
    v_until := p_date;
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.paid_at DESC, t.created_at DESC), '[]'::jsonb)
    INTO v_items
  FROM (
    SELECT
      st.full_name      AS student_name,
      st.code           AS student_code,
      st.grade          AS grade,
      sf.description    AS fee_description,
      p.invoice_number  AS invoice_number,
      p.amount          AS amount,
      p.method          AS method,
      p.paid_at         AS paid_at,
      p.created_at      AS created_at
    FROM public.payments p
    JOIN public.student_fees sf ON sf.id = p.fee_id
    JOIN public.students st     ON st.id = sf.student_id
    WHERE p.school_id = v_school
      AND p.deleted_at IS NULL
      AND p.paid_at BETWEEN v_from AND v_until
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
    AND p.paid_at BETWEEN v_from AND v_until;

  RETURN jsonb_build_object(
    'ok', true,
    'from', v_from,
    'to', v_until,
    'is_range', v_from <> v_until,
    'count', v_count,
    'total', v_total,
    'cash', v_cash,
    'bank', v_bank,
    'items', v_items
  );
END;
$function$;