CREATE OR REPLACE FUNCTION public.student_month_payments(p_student_id uuid, p_month_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_school uuid;
  v_start  date;
  v_end    date;
  v_items  jsonb;
  v_student jsonb;
BEGIN
  v_school := public.my_school_id();
  IF v_school IS NULL OR public.my_role() NOT IN ('owner','admin','accountant','platform_admin') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  IF p_month_key IS NULL OR p_month_key !~ '^\d{4}-(0[1-9]|1[0-2])$' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'bad_month');
  END IF;

  SELECT jsonb_build_object('name', s.full_name, 'code', s.code, 'grade', s.grade, 'section', s.section)
    INTO v_student
  FROM public.students s
  WHERE s.id = p_student_id AND s.school_id = v_school;

  IF v_student IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  v_start := (p_month_key || '-01')::date;
  v_end   := (v_start + interval '1 month')::date;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.paid_at DESC, t.created_at DESC), '[]'::jsonb)
    INTO v_items
  FROM (
    SELECT
      p.id              AS payment_id,
      p.invoice_number  AS invoice_number,
      p.amount          AS amount,
      p.method          AS method,
      p.paid_at         AS paid_at,
      p.created_at      AS created_at,
      sf.description    AS fee_description,
      sf.total          AS fee_total,
      sf.paid           AS fee_paid,
      (sf.total - sf.paid) AS fee_remaining,
      sf.due_date       AS due_date,
      pr.full_name      AS recorded_by_name
    FROM public.payments p
    JOIN public.student_fees sf ON sf.id = p.fee_id
    LEFT JOIN public.profiles pr ON pr.id = p.recorded_by
    WHERE sf.student_id = p_student_id
      AND sf.school_id = v_school
      AND p.school_id = v_school
      AND p.deleted_at IS NULL
      AND p.paid_at >= v_start
      AND p.paid_at <  v_end
  ) t;

  RETURN jsonb_build_object('ok', true, 'student', v_student, 'items', v_items);
END;
$function$;

REVOKE ALL ON FUNCTION public.student_month_payments(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.student_month_payments(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.student_month_payments(uuid, text) TO authenticated;