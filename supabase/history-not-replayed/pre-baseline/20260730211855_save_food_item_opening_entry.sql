-- نفس منطق القيد الافتتاحي لمخزون التغذية — اتساق كامل مع المخزون العام
CREATE OR REPLACE FUNCTION public.save_food_item(p_name text, p_unit text, p_qty numeric, p_cost numeric)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_school uuid; v_id uuid; v_opening_value numeric; v_entry uuid;
BEGIN
  v_school := public.my_school_id();
  IF public.my_role() NOT IN ('owner','admin','accountant') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  IF v_school IS NULL OR coalesce(trim(p_name),'') = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_input');
  END IF;

  INSERT INTO public.food_inventory (school_id, name, unit, qty, cost)
  VALUES (v_school, trim(p_name), coalesce(nullif(trim(p_unit),''),'كجم'), coalesce(p_qty,0), coalesce(p_cost,0))
  RETURNING id INTO v_id;

  v_opening_value := round(coalesce(p_qty,0) * coalesce(p_cost,0), 3);
  IF v_opening_value > 0 THEN
    PERFORM public.ensure_inventory_accounts();

    INSERT INTO public.journal_entries (school_id, description, reference, created_by)
    VALUES (v_school, 'رصيد افتتاحي لمخزون تغذية: ' || p_name || ' ×' || p_qty, 'FOPEN-' || left(v_id::text,8), auth.uid())
    RETURNING id INTO v_entry;

    INSERT INTO public.journal_lines (school_id, entry_id, account_id, debit, credit) VALUES
      (v_school, v_entry, public.acc_id('1320'), v_opening_value, 0),
      (v_school, v_entry, public.acc_id('3100'), 0, v_opening_value);
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$function$;