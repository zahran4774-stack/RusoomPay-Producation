-- تحديث save_inventory_item لدعم الفئة والنوع الفرعي — بمعاملين اختياريين جديدين فقط
-- (لا تغيير على المعاملات القديمة ولا ترتيبها، فالتوافق مع أي استدعاء سابق محفوظ)
CREATE OR REPLACE FUNCTION public.save_inventory_item(
  p_name text, p_qty integer, p_cost numeric, p_price numeric, p_vat numeric DEFAULT 5,
  p_category text DEFAULT 'أخرى', p_subtype text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  v_school uuid; v_id uuid; v_opening_value numeric; v_entry uuid;
begin
  v_school := public.my_school_id();
  if v_school is null or public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح بإدارة المخزون';
  end if;
  if coalesce(trim(p_name),'') = '' then raise exception 'اسم الصنف مطلوب'; end if;

  insert into public.inventory_items(school_id, name, qty, cost, price, vat_rate, category, subtype)
  values (v_school, p_name, coalesce(p_qty,0), coalesce(p_cost,0), coalesce(p_price,0), coalesce(p_vat,5),
          coalesce(nullif(trim(p_category),''), 'أخرى'), nullif(trim(coalesce(p_subtype,'')), ''))
  returning id into v_id;

  v_opening_value := round(coalesce(p_qty,0) * coalesce(p_cost,0), 3);
  if v_opening_value > 0 then
    perform public.ensure_inventory_accounts();

    insert into public.journal_entries(school_id, description, reference, created_by)
    values (v_school, 'رصيد افتتاحي لمخزون: ' || p_name || ' ×' || p_qty, 'OPEN-' || left(v_id::text,8), auth.uid())
    returning id into v_entry;

    insert into public.journal_lines(school_id, entry_id, account_id, debit, credit) values
      (v_school, v_entry, public.acc_id('1310'), v_opening_value, 0),
      (v_school, v_entry, public.acc_id('3100'), 0, v_opening_value);
  end if;

  return v_id;
end;
$function$;