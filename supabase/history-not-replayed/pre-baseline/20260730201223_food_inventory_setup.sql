-- مخزون المواد الغذائية للتغذية المدرسية — جدول مستقل عن المخزون العام (inventory_items)
-- يسجّل كميات الشراء والصرف اليومي؛ غير مفوتر على أولياء الأمور (محسوب أصلاً ضمن الرسوم الدراسية)
CREATE TABLE IF NOT EXISTS public.food_inventory (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id  uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name       text NOT NULL,
  unit       text NOT NULL DEFAULT 'كجم', -- وحدة القياس: كجم، لتر، قطعة...
  qty        numeric NOT NULL DEFAULT 0 CHECK (qty >= 0),
  cost       numeric NOT NULL DEFAULT 0, -- تكلفة الوحدة الواحدة
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.food_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY food_inventory_school_all ON public.food_inventory
  FOR ALL USING (school_id = public.my_school_id())
  WITH CHECK (school_id = public.my_school_id());

-- سجل حركات الصرف الغذائي — تاريخ + كمية + سبب/وجبة لكل عملية (لتقارير المتابعة)
CREATE TABLE IF NOT EXISTS public.food_dispenses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  item_id       uuid NOT NULL REFERENCES public.food_inventory(id) ON DELETE CASCADE,
  qty           numeric NOT NULL CHECK (qty > 0),
  cost          numeric NOT NULL DEFAULT 0,
  reason        text,
  dispensed_by  uuid REFERENCES auth.users(id),
  dispensed_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.food_dispenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY food_dispenses_school_select ON public.food_dispenses
  FOR SELECT USING (school_id = public.my_school_id());

CREATE POLICY food_dispenses_school_insert ON public.food_dispenses
  FOR INSERT WITH CHECK (
    school_id = public.my_school_id()
    AND public.my_role() IN ('owner','admin','accountant')
  );

-- قائمة أصناف المخزون الغذائي لمدرسة المستخدم
CREATE OR REPLACE FUNCTION public.food_inventory_list()
RETURNS SETOF public.food_inventory
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT * FROM public.food_inventory
  WHERE school_id = public.my_school_id()
  ORDER BY name;
$function$;

-- إضافة/تحديث صنف غذائي
CREATE OR REPLACE FUNCTION public.save_food_item(p_name text, p_unit text, p_qty numeric, p_cost numeric)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_school uuid;
BEGIN
  v_school := public.my_school_id();
  IF public.my_role() NOT IN ('owner','admin','accountant') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  IF v_school IS NULL OR coalesce(trim(p_name),'') = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_input');
  END IF;

  INSERT INTO public.food_inventory (school_id, name, unit, qty, cost)
  VALUES (v_school, trim(p_name), coalesce(nullif(trim(p_unit),''),'كجم'), coalesce(p_qty,0), coalesce(p_cost,0));

  RETURN jsonb_build_object('ok', true);
END;
$function$;

-- شراء مواد غذائية: يزيد الكمية + قيد محاسبي (مخزون تغذية مدين / بنك دائن)
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
    (v_school, v_entry, public.acc_id('1310'), v_cost, 0),
    (v_school, v_entry, public.acc_id('1120'), 0, v_cost);

  RETURN jsonb_build_object('ok', true, 'item_name', v_item.name, 'new_qty', v_item.qty + p_qty);
END;
$function$;

-- صرف مواد غذائية (استهلاك يومي فعلي): ينقص الكمية + قيد مصروف إداري — بدون فاتورة على أي طالب
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
    (v_school, v_entry, public.acc_id('1310'), 0, v_cost);

  RETURN jsonb_build_object('ok', true, 'item_name', v_item.name, 'remaining_qty', v_item.qty - p_qty);
END;
$function$;

REVOKE ALL ON FUNCTION public.food_inventory_list() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.food_inventory_list() TO authenticated;
REVOKE ALL ON FUNCTION public.save_food_item(text, text, numeric, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_food_item(text, text, numeric, numeric) TO authenticated;
REVOKE ALL ON FUNCTION public.food_purchase(uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.food_purchase(uuid, numeric) TO authenticated;
REVOKE ALL ON FUNCTION public.food_dispense(uuid, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.food_dispense(uuid, numeric, text) TO authenticated;