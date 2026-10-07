-- ملخّص الرواتب السنوية والشهرية — لمدرسة المستخدم الحالي
-- يرجع: إجمالي السنة الحالية (للبطاقة) + قائمة تفصيلية بكل دورة راتب (للتقرير)
CREATE OR REPLACE FUNCTION public.payroll_yearly_summary(p_year int DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_school uuid;
  v_year   int := coalesce(p_year, extract(year from current_date)::int);
  v_yearly_gross numeric;
  v_yearly_net   numeric;
  v_rows jsonb;
BEGIN
  v_school := public.my_school_id();
  IF v_school IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_school'); END IF;

  -- إجمالي السنة: من دورات الرواتب المعتمدة/المدفوعة فقط (لا الملغاة)
  SELECT coalesce(sum(total_gross), 0), coalesce(sum(total_net), 0)
    INTO v_yearly_gross, v_yearly_net
  FROM public.payroll_runs
  WHERE school_id = v_school
    AND period_year = v_year
    AND status IN ('approved', 'paid');

  -- قائمة تفصيلية بكل دورة راتب في السنة المطلوبة
  SELECT coalesce(jsonb_agg(row_to_json(t) ORDER BY t.period_month), '[]'::jsonb)
    INTO v_rows
  FROM (
    SELECT period_month, status, total_gross, total_net, total_pasi_er, approved_at, payment_journal_entry_id IS NOT NULL AS is_paid
    FROM public.payroll_runs
    WHERE school_id = v_school AND period_year = v_year AND status IN ('approved', 'paid')
  ) t;

  RETURN jsonb_build_object(
    'ok', true, 'year', v_year,
    'yearly_gross', v_yearly_gross, 'yearly_net', v_yearly_net,
    'rows', v_rows
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.payroll_yearly_summary(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.payroll_yearly_summary(int) TO authenticated;