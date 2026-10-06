-- نفس أسلوب المخزون: تكلفة الوحدة تُحسب تلقائياً من (الإجمالي ÷ الوجبات) عند إدخال إجمالي المبلغ.
-- توسيع الدقة لـ 6 خانات كي يبقى (الوجبات × تكلفة الوحدة) مطابقاً تماماً للمبلغ الإجمالي المُدخل (10 ÷ 3 = 3.333333، لا 3.333).
-- العرض والقيود تبقى بـ 3 خانات؛ التوسيع يخص التخزين الداخلي فقط.
alter table public.meal_purchases alter column unit_cost type numeric(14,6);

-- ═══ save_meal_purchase: p_total اختياري ═══
drop function if exists public.save_meal_purchase(uuid, uuid, date, text, integer, numeric, text, boolean, text, text, text);

create function public.save_meal_purchase(
  p_id uuid, p_supplier uuid, p_date date, p_type text, p_meals integer, p_unit_cost numeric,
  p_period text, p_paid boolean, p_notes text, p_item_type text default null,
  p_payment_source text default 'bank', p_total numeric default null
) returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_sch uuid;
  v_rl   user_role;
  v_id     uuid;
  v_unit   numeric;
  v_total  numeric;
  v_entry  uuid;
  v_supname text;
  v_acc text;
begin
  v_sch := public.my_school_id();
  v_rl   := public.my_role();
  if v_sch is null then raise exception 'لا مدرسة مرتبطة بحسابك'; end if;
  if v_rl not in ('owner','admin','accountant') then raise exception 'غير مصرّح'; end if;
  if p_payment_source not in ('cash','bank') then raise exception 'مصدر الدفع يجب أن يكون صندوق أو بنك'; end if;
  if p_total is not null and p_total < 0 then raise exception 'المبلغ الإجمالي غير صحيح'; end if;

  if coalesce(p_total, 0) > 0 then
    if coalesce(p_meals, 0) <= 0 then raise exception 'أدخل عدد الوجبات لحساب تكلفة الوحدة من المبلغ الإجمالي'; end if;
    v_unit  := round(p_total / p_meals, 6);
    v_total := round(p_total, 3);
  else
    v_unit  := round(coalesce(p_unit_cost, 0), 6);
    v_total := round(coalesce(p_meals,0) * v_unit, 3);
  end if;

  v_acc := case when p_payment_source = 'cash' then '1110' else '1120' end;

  if p_id is null then
    perform public.ensure_meal_cost_accounts();
    select name into v_supname from public.suppliers where id = p_supplier;

    insert into public.meal_purchases(
      school_id, supplier_id, purchase_date, purchase_type,
      meals_count, unit_cost, total_cost, period, paid, notes, created_by, item_type
    ) values (
      v_sch, p_supplier, coalesce(p_date, current_date),
      coalesce(nullif(trim(p_type),''),'daily'),
      coalesce(p_meals,0), v_unit, v_total,
      nullif(trim(p_period),''), coalesce(p_paid,false), nullif(trim(p_notes),''), auth.uid(),
      nullif(trim(p_item_type),'')
    )
    returning id into v_id;

    if v_total > 0 then
      insert into public.journal_entries (school_id, description, reference, created_by)
      values (
        v_sch,
        'مشتريات وجبات: ' || coalesce(v_supname,'—') || ' (' || coalesce(p_meals,0) || ' وجبة)' ||
          case when coalesce(p_paid,false) and p_payment_source = 'cash' then ' (نقداً)' else '' end,
        'MPUR-' || left(v_id::text,8), auth.uid()
      )
      returning id into v_entry;

      insert into public.journal_lines (school_id, entry_id, account_id, debit, credit) values
        (v_sch, v_entry, public.acc_id('5230'), v_total, 0),
        (v_sch, v_entry,
         case when coalesce(p_paid,false) then public.acc_id(v_acc) else public.acc_id('2110') end,
         0, v_total);

      update public.meal_purchases set journal_entry_id = v_entry where id = v_id;
    end if;
  else
    update public.meal_purchases set
      supplier_id = p_supplier, purchase_date = coalesce(p_date, current_date),
      purchase_type = coalesce(nullif(trim(p_type),''),'daily'),
      meals_count = coalesce(p_meals,0), unit_cost = v_unit,
      total_cost = v_total, period = nullif(trim(p_period),''),
      notes = nullif(trim(p_notes),''), item_type = nullif(trim(p_item_type),''),
      updated_at = now()
    where id = p_id and school_id = v_sch
    returning id into v_id;
    if v_id is null then raise exception 'الشراء غير موجود في مدرستك'; end if;
  end if;

  return v_id;
end;
$function$;

revoke all on function public.save_meal_purchase(uuid, uuid, date, text, integer, numeric, text, boolean, text, text, text, numeric) from public, anon;
grant execute on function public.save_meal_purchase(uuid, uuid, date, text, integer, numeric, text, boolean, text, text, text, numeric) to authenticated;

-- ═══ edit_meal_purchase_price: p_total اختياري ═══
drop function if exists public.edit_meal_purchase_price(uuid, integer, numeric, text);

create function public.edit_meal_purchase_price(
  p_id uuid, p_meals integer, p_unit_cost numeric, p_payment_source text default 'bank',
  p_total numeric default null
) returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_sch uuid; v_role user_role; v_old record; v_unit numeric; v_new_total numeric;
  v_rev_entry uuid; v_new_entry uuid; v_acc text; v_supname text;
begin
  v_sch := public.my_school_id();
  v_role := public.my_role();
  if v_sch is null then raise exception 'لا مدرسة مرتبطة بحسابك'; end if;
  if v_role not in ('owner','admin','accountant') then raise exception 'غير مصرّح'; end if;
  if p_payment_source not in ('cash','bank') then raise exception 'مصدر الدفع يجب أن يكون صندوق أو بنك'; end if;
  if coalesce(p_meals,0) <= 0 then raise exception 'عدد الوجبات يجب أن يكون أكبر من صفر'; end if;
  if p_total is not null and p_total < 0 then raise exception 'المبلغ الإجمالي غير صحيح'; end if;

  if coalesce(p_total, 0) > 0 then
    v_unit := round(p_total / p_meals, 6);
    v_new_total := round(p_total, 3);
  else
    if coalesce(p_unit_cost,0) <= 0 then raise exception 'تكلفة الوحدة يجب أن تكون أكبر من صفر'; end if;
    v_unit := round(p_unit_cost, 6);
    v_new_total := round(p_meals * v_unit, 3);
  end if;

  select * into v_old from public.meal_purchases where id = p_id and school_id = v_sch;
  if v_old is null then raise exception 'الشراء غير موجود في مدرستك'; end if;
  if v_old.status = 'cancelled' then raise exception 'لا يمكن تعديل شراء ملغى'; end if;

  select name into v_supname from public.suppliers where id = v_old.supplier_id;
  v_acc := case when p_payment_source = 'cash' then '1110' else '1120' end;

  if v_old.journal_entry_id is not null and v_old.total_cost > 0 then
    insert into public.journal_entries (school_id, entry_date, description, reference, created_by, reverses_entry)
    values (v_sch, current_date, 'عكس قيد شراء وجبات (تعديل سعر) — ' || coalesce(v_supname,'—'),
            'MREV-' || left(p_id::text,8), auth.uid(), v_old.journal_entry_id)
    returning id into v_rev_entry;

    insert into public.journal_lines (school_id, entry_id, account_id, debit, credit)
    select school_id, v_rev_entry, account_id, credit, debit
    from public.journal_lines where entry_id = v_old.journal_entry_id;

    perform set_config('rusoom.allow_journal_flag', 'on', true);
    update public.journal_entries set reversed_by_entry = v_rev_entry where id = v_old.journal_entry_id;
  end if;

  perform public.ensure_meal_cost_accounts();
  insert into public.journal_entries (school_id, entry_date, description, reference, created_by)
  values (v_sch, current_date, 'مشتريات وجبات (بعد تعديل): ' || coalesce(v_supname,'—') || ' (' || p_meals || ' وجبة)',
          'MPUR-' || left(p_id::text,8), auth.uid())
  returning id into v_new_entry;

  insert into public.journal_lines (school_id, entry_id, account_id, debit, credit) values
    (v_sch, v_new_entry, public.acc_id('5230'), v_new_total, 0),
    (v_sch, v_new_entry, case when v_old.paid then public.acc_id(v_acc) else public.acc_id('2110') end, 0, v_new_total);

  update public.meal_purchases set
    meals_count = p_meals, unit_cost = v_unit, total_cost = v_new_total,
    journal_entry_id = v_new_entry, updated_at = now()
  where id = p_id;

  insert into public.audit_log (school_id, actor_id, action, details)
  values (v_sch, auth.uid(), 'تعديل سعر شراء وجبات',
          coalesce(v_supname,'—') || ': ' || v_old.total_cost || ' ← ' || v_new_total);

  return v_new_entry;
end;
$function$;

revoke all on function public.edit_meal_purchase_price(uuid, integer, numeric, text, numeric) from public, anon;
grant execute on function public.edit_meal_purchase_price(uuid, integer, numeric, text, numeric) to authenticated;