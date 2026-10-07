-- تحديث دالة الشراء الغذائي لتستخدم 1320 (مخزون التغذية) بدل 1310
CREATE OR REPLACE FUNCTION public.food_purchase(p_item uuid, p_qty numeric)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_school uuid; v_item record; v_cost numeric; v_entry uuid;
BEGIN
  v_school := public.my_school_id();
  IF public.my_role() NOT IN ('owner','admin','accountant') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  SELECT * INTO v_item FROM public.food_inventory WHERE id = p_item AND school_id = v_school;
  IF v_item IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  IF coalesce(p_qty,0) <= 0 THEN RETURN jsonb_build_object('ok', false, 'reason', 'invalid_qty'); END IF;

  PERFORM public.ensure_inventory_accounts();
  v_cost := round(p_qty * v_item.cost, 3);

  UPDATE public.food_inventory SET qty = qty + p_qty WHERE id = p_item;

  INSERT INTO public.journal_entries (school_id, description, reference, created_by)
  VALUES (v_school, 'شراء مواد غذائية: ' || v_item.name || ' ×' || p_qty || ' ' || v_item.unit, 'FPUR-' || left(p_item::text,8), auth.uid())
  RETURNING id INTO v_entry;

  INSERT INTO public.journal_lines (school_id, entry_id, account_id, debit, credit) VALUES
    (v_school, v_entry, public.acc_id('1320'), v_cost, 0),
    (v_school, v_entry, public.acc_id('1120'), 0, v_cost);

  RETURN jsonb_build_object('ok', true, 'item_name', v_item.name, 'new_qty', v_item.qty + p_qty);
END;
$function$;

-- تحديث دالة الصرف الغذائي لتستخدم 1320 بدل 1310
CREATE OR REPLACE FUNCTION public.food_dispense(p_item uuid, p_qty numeric, p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_school uuid; v_item record; v_cost numeric; v_entry uuid;
BEGIN
  v_school := public.my_school_id();
  IF public.my_role() NOT IN ('owner','admin','accountant') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  SELECT * INTO v_item FROM public.food_inventory WHERE id = p_item AND school_id = v_school;
  IF v_item IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  IF coalesce(p_qty,0) <= 0 THEN RETURN jsonb_build_object('ok', false, 'reason', 'invalid_qty'); END IF;
  IF p_qty > v_item.qty THEN RETURN jsonb_build_object('ok', false, 'reason', 'insufficient_qty', 'available', v_item.qty); END IF;

  PERFORM public.ensure_inventory_accounts();
  v_cost := round(p_qty * v_item.cost, 3);

  UPDATE public.food_inventory SET qty = qty - p_qty WHERE id = p_item;

  INSERT INTO public.food_dispenses (school_id, item_id, qty, cost, reason, dispensed_by)
  VALUES (v_school, p_item, p_qty, v_cost, nullif(trim(coalesce(p_reason,'')), ''), auth.uid());

  INSERT INTO public.journal_entries (school_id, description, reference, created_by)
  VALUES (
    v_school,
    'صرف مواد غذائية: ' || v_item.name || ' ×' || p_qty || ' ' || v_item.unit || coalesce(' — ' || nullif(trim(p_reason),''), ''),
    'FDISP-' || left(p_item::text,8), auth.uid()
  )
  RETURNING id INTO v_entry;

  INSERT INTO public.journal_lines (school_id, entry_id, account_id, debit, credit) VALUES
    (v_school, v_entry, public.acc_id('5210'), v_cost, 0),
    (v_school, v_entry, public.acc_id('1320'), 0, v_cost);

  RETURN jsonb_build_object('ok', true, 'item_name', v_item.name, 'remaining_qty', v_item.qty - p_qty);
END;
$function$;