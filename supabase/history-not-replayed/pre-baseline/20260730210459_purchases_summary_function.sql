-- ملخّص مشتريات المخزون (العام + التغذية) — للعرض في صفحة المحاسبة
-- يحسب إجمالي المدين على حساب كل مخزون منذ إنشائه (القيمة الحالية المتراكمة للمشتريات)
CREATE OR REPLACE FUNCTION public.inventory_purchases_summary()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_school uuid;
  v_general numeric;
  v_food numeric;
BEGIN
  v_school := public.my_school_id();
  IF v_school IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_school'); END IF;

  -- إجمالي ما دخل حساب مخزون الكتب والزي (1310) عبر الشراء (مدين)
  SELECT coalesce(sum(jl.debit), 0) INTO v_general
  FROM public.journal_lines jl
  JOIN public.accounts a ON a.id = jl.account_id
  WHERE a.school_id = v_school AND a.code = '1310';

  -- إجمالي ما دخل حساب مخزون التغذية (1320) عبر الشراء (مدين)
  SELECT coalesce(sum(jl.debit), 0) INTO v_food
  FROM public.journal_lines jl
  JOIN public.accounts a ON a.id = jl.account_id
  WHERE a.school_id = v_school AND a.code = '1320';

  RETURN jsonb_build_object('ok', true, 'general_purchases', v_general, 'food_purchases', v_food);
END;
$function$;

REVOKE ALL ON FUNCTION public.inventory_purchases_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.inventory_purchases_summary() TO authenticated;