-- ═══ 1) دقة تكلفة الوحدة: 3 → 6 خانات عشرية ═══
-- كي يبقى (الكمية × تكلفة الوحدة) مطابقاً للمبلغ الإجمالي المدفوع (مثال: 10 ÷ 3 = 3.333333، لا 3.333)
-- العرض والقيود تبقى بـ 3 خانات (round(...,3)) — التغيير يخصّ التخزين الداخلي فقط.
alter table public.inventory_items alter column cost type numeric(14,6);

-- ═══ 2) save_inventory_item: p_total اختياري — إن وُجد تُحسب تكلفة الوحدة = الإجمالي ÷ الكمية ═══
drop function if exists public.save_inventory_item(text, integer, numeric, numeric, numeric, text, text);

create function public.save_inventory_item(
  p_name text,
  p_qty integer,
  p_cost numeric,
  p_price numeric,
  p_vat numeric default 5,
  p_category text default 'أخرى',
  p_subtype text default null,
  p_total numeric default null
) returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_school uuid; v_id uuid; v_unit numeric; v_opening_value numeric; v_entry uuid;
begin
  v_school := public.my_school_id();
  if v_school is null or public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح بإدارة المخزون';
  end if;
  if coalesce(trim(p_name),'') = '' then raise exception 'اسم الصنف مطلوب'; end if;

  if p_total is not null and p_total < 0 then
    raise exception 'المبلغ الإجمالي غير صحيح';
  end if;

  if coalesce(p_total, 0) > 0 then
    if coalesce(p_qty, 0) <= 0 then
      raise exception 'أدخل الكمية لحساب تكلفة الوحدة من المبلغ الإجمالي';
    end if;
    v_unit := round(p_total / p_qty, 6);
    v_opening_value := round(p_total, 3);
  else
    v_unit := round(coalesce(p_cost, 0), 6);
    v_opening_value := round(coalesce(p_qty, 0) * v_unit, 3);
  end if;

  insert into public.inventory_items(school_id, name, qty, cost, price, vat_rate, category, subtype)
  values (v_school, p_name, coalesce(p_qty,0), v_unit, coalesce(p_price,0), coalesce(p_vat,5),
          coalesce(nullif(trim(p_category),''), 'أخرى'), nullif(trim(coalesce(p_subtype,'')), ''))
  returning id into v_id;

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

revoke all on function public.save_inventory_item(text, integer, numeric, numeric, numeric, text, text, numeric) from public, anon;
grant execute on function public.save_inventory_item(text, integer, numeric, numeric, numeric, text, text, numeric) to authenticated;

-- ═══ 3) inventory_purchase: p_total اختياري (المبلغ الفعلي المدفوع) ═══
-- بدون p_total: السلوك القديم (الكمية × تكلفة الصنف الحالية، والتكلفة لا تتغيّر).
-- مع p_total: القيد بالمبلغ الفعلي، وتكلفة الصنف تصبح المتوسط المرجّح = (قيمة الرصيد الحالي + المبلغ) ÷ (الكمية الحالية + المشتراة).
-- يُحذف التوقيعان القديمان (2 و3 وسائط): بقاؤهما مع توقيع جديد ذي قيم افتراضية يسبب غموضاً في الاستدعاء.
drop function if exists public.inventory_purchase(uuid, integer);
drop function if exists public.inventory_purchase(uuid, integer, text);

create function public.inventory_purchase(
  p_item uuid,
  p_qty integer,
  p_payment_source text default 'bank',
  p_total numeric default null
) returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_sch uuid; v_item record; v_amount numeric; v_new_cost numeric; v_entry uuid; v_acc text; v_old_qty integer;
begin
  v_sch := public.my_school_id();
  if public.my_role() not in ('owner','admin','accountant') then raise exception 'غير مصرّح'; end if;
  select * into v_item from public.inventory_items where id = p_item and school_id = v_sch for update;
  if v_item is null then raise exception 'الصنف غير موجود'; end if;
  if coalesce(p_qty,0) <= 0 then raise exception 'كمية غير صحيحة'; end if;
  if p_payment_source not in ('cash','bank') then raise exception 'مصدر الدفع يجب أن يكون صندوق أو بنك'; end if;

  perform public.ensure_inventory_accounts();
  v_acc := case when p_payment_source = 'cash' then '1110' else '1120' end;
  v_old_qty := greatest(v_item.qty, 0);

  if p_total is null then
    v_amount   := round(p_qty * v_item.cost, 3);
    v_new_cost := v_item.cost;
  else
    v_amount := round(p_total, 3);
    if v_amount <= 0 then raise exception 'المبلغ الإجمالي غير صحيح'; end if;
    v_new_cost := round((v_old_qty * v_item.cost + v_amount) / (v_old_qty + p_qty), 6);
  end if;

  update public.inventory_items set qty = qty + p_qty, cost = v_new_cost where id = p_item;

  insert into public.journal_entries(school_id, description, reference, created_by)
  values (v_sch, 'شراء مخزون: ' || v_item.name || ' ×' || p_qty ||
          case when p_total is not null then ' (تكلفة الوحدة ' || round(v_amount / p_qty, 3) || ')' else '' end ||
          case when p_payment_source = 'cash' then ' (نقداً)' else '' end,
          'PUR-' || left(p_item::text,8), auth.uid())
  returning id into v_entry;

  insert into public.journal_lines(school_id, entry_id, account_id, debit, credit) values
    (v_sch, v_entry, public.acc_id('1310'), v_amount, 0),
    (v_sch, v_entry, public.acc_id(v_acc), 0, v_amount);
end;
$function$;

revoke all on function public.inventory_purchase(uuid, integer, text, numeric) from public, anon;
grant execute on function public.inventory_purchase(uuid, integer, text, numeric) to authenticated;