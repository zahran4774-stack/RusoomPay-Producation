-- صرف استهلاكي داخلي من المخزون — غير مفوتر على أولياء الأمور
-- يُستخدم للأصناف التي تشتريها المدرسة لاستهلاكها الداخلي (قرطاسية، مواد نظافة، أدوات صيانة...)
-- محسوبة أصلاً ضمن تكاليف الدراسة العامة، فلا تُنشئ فاتورة ولا إيراد.

-- جدول سجل حركات الصرف — تاريخ + كمية + سبب لكل عملية (للتقارير لاحقاً)
CREATE TABLE IF NOT EXISTS public.inventory_dispenses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  item_id     uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  qty         integer NOT NULL CHECK (qty > 0),
  cost        numeric NOT NULL DEFAULT 0,
  reason      text,
  dispensed_by uuid REFERENCES auth.users(id),
  dispensed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory_dispenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY inventory_dispenses_school_select ON public.inventory_dispenses
  FOR SELECT USING (school_id = public.my_school_id());

CREATE POLICY inventory_dispenses_school_insert ON public.inventory_dispenses
  FOR INSERT WITH CHECK (
    school_id = public.my_school_id()
    AND public.my_role() IN ('owner','admin','accountant')
  );

-- دالة الصرف: تنقص الكمية + ترحّل قيد (مصاريف إدارية 5210 مدين / مخزون 1310 دائن) + تسجّل في السجل
CREATE OR REPLACE FUNCTION public.inventory_dispense(p_item uuid, p_qty integer, p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_school uuid; v_item record; v_cost numeric; v_entry uuid;
begin
  v_school := public.my_school_id();
  if public.my_role() not in ('owner','admin','accountant') then raise exception 'غير مصرّح'; end if;

  select * into v_item from public.inventory_items where id = p_item and school_id = v_school;
  if v_item is null then raise exception 'الصنف غير موجود'; end if;
  if coalesce(p_qty,0) <= 0 then raise exception 'كمية غير صحيحة'; end if;
  if p_qty > v_item.qty then raise exception 'الكمية أكبر من الرصيد المتاح (%)', v_item.qty; end if;

  perform public.ensure_inventory_accounts();
  v_cost := round(p_qty * v_item.cost, 3);

  -- خصم الكمية (بدون فاتورة وبدون إيراد)
  update public.inventory_items set qty = qty - p_qty where id = p_item;

  -- سجل الحركة — تاريخ وسبب لكل صرف
  insert into public.inventory_dispenses(school_id, item_id, qty, cost, reason, dispensed_by)
  values (v_school, p_item, p_qty, v_cost, nullif(trim(coalesce(p_reason,'')), ''), auth.uid());

  -- قيد محاسبي: مصاريف إدارية مدين / مخزون دائن (مصروف تشغيلي، ليس تكلفة مبيعات)
  insert into public.journal_entries(school_id, description, reference, created_by)
  values (
    v_school,
    'صرف استهلاكي داخلي: ' || v_item.name || ' ×' || p_qty || coalesce(' — ' || nullif(trim(p_reason),''), ''),
    'DISP-' || left(p_item::text,8),
    auth.uid()
  )
  returning id into v_entry;

  insert into public.journal_lines(school_id, entry_id, account_id, debit, credit) values
    (v_school, v_entry, public.acc_id('5210'), v_cost, 0),
    (v_school, v_entry, public.acc_id('1310'), 0, v_cost);

  return jsonb_build_object('ok', true, 'item_name', v_item.name, 'qty', p_qty, 'cost', v_cost, 'remaining_qty', v_item.qty - p_qty);
end;
$function$;

REVOKE ALL ON FUNCTION public.inventory_dispense(uuid, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.inventory_dispense(uuid, integer, text) TO authenticated;
REVOKE ALL ON public.inventory_dispenses FROM PUBLIC;
GRANT SELECT, INSERT ON public.inventory_dispenses TO authenticated;