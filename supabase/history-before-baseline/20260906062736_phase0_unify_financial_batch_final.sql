
-- Phase 0 — الدفعة المالية الأخيرة (4/4): توحيد مصدر السياق
-- المنطق المالي والمحاسبي لم يُمسّ إطلاقاً؛ التغيير الوحيد هو مصدر v_school/v_role.

CREATE OR REPLACE FUNCTION public.submit_payment(p_fee_id uuid, p_amount numeric, p_method text, p_bank_ref text DEFAULT NULL::text, p_receipt_url text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_school uuid; v_fee record; v_id uuid;
  v_my_school uuid;
  v_my_role text;
begin
  -- مصدر السياق الموحّد
  v_my_school := public.my_school_id();
  v_my_role   := public.my_role()::text;
  if v_my_school is null then
    raise exception 'لا مدرسة مرتبطة بحسابك';
  end if;

  select f.*, s.full_name as student_name, s.guardian_name
  into v_fee
  from public.student_fees f
  join public.students s on s.id = f.student_id
  where f.id = p_fee_id
    and f.school_id = v_my_school;

  if v_fee is null then
    raise exception 'الفاتورة غير موجودة في مدرستك';
  end if;

  if v_my_role = 'parent' then
    if not exists (
      select 1 from public.parent_students ps
      where ps.student_id = v_fee.student_id and ps.parent_id = auth.uid()
    ) then
      raise exception 'هذه الفاتورة لا تخص أحد أبنائك';
    end if;
  end if;

  v_school := v_fee.school_id;
  if coalesce(p_amount,0) <= 0 then raise exception 'مبلغ غير صحيح'; end if;
  if p_amount > (v_fee.total - v_fee.paid) + 0.0005 then raise exception 'المبلغ أكبر من المتبقي'; end if;
  if coalesce(p_method,'card') not in ('card','bank','applepay','googlepay','onsite') then
    raise exception 'طريقة دفع غير مدعومة';
  end if;
  if p_method = 'bank' and coalesce(trim(p_bank_ref),'') = '' and p_receipt_url is null then
    raise exception 'يلزم إرفاق إيصال التحويل';
  end if;

  insert into public.pending_payments(school_id, fee_id, guardian_id, amount, method, bank_ref, receipt_url)
  values (v_school, p_fee_id, auth.uid(), p_amount, p_method, p_bank_ref, p_receipt_url)
  returning id into v_id;

  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.save_meal_purchase(p_id uuid, p_supplier uuid, p_date date, p_type text, p_meals integer, p_unit_cost numeric, p_period text, p_paid boolean, p_notes text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_school uuid;
  v_role   user_role;
  v_id     uuid;
  v_total  numeric;
  v_entry  uuid;
  v_supplier_name text;
begin
  v_school := public.my_school_id();
  v_role   := public.my_role();
  if v_school is null then raise exception 'لا مدرسة مرتبطة بحسابك'; end if;
  if v_role not in ('owner','admin','accountant') then raise exception 'غير مصرّح'; end if;

  v_total := coalesce(p_meals,0) * coalesce(p_unit_cost,0);

  if p_id is null then
    perform public.ensure_meal_cost_accounts();
    select name into v_supplier_name from public.suppliers where id = p_supplier;

    insert into public.meal_purchases(
      school_id, supplier_id, purchase_date, purchase_type,
      meals_count, unit_cost, total_cost, period, paid, notes, created_by
    ) values (
      v_school, p_supplier, coalesce(p_date, current_date),
      coalesce(nullif(trim(p_type),''),'daily'),
      coalesce(p_meals,0), coalesce(p_unit_cost,0), v_total,
      nullif(trim(p_period),''), coalesce(p_paid,false), nullif(trim(p_notes),''), auth.uid()
    )
    returning id into v_id;

    if v_total > 0 then
      insert into public.journal_entries (school_id, description, reference, created_by)
      values (
        v_school,
        'مشتريات وجبات: ' || coalesce(v_supplier_name,'—') || ' (' || coalesce(p_meals,0) || ' وجبة)',
        'MPUR-' || left(v_id::text,8), auth.uid()
      )
      returning id into v_entry;

      insert into public.journal_lines (school_id, entry_id, account_id, debit, credit) values
        (v_school, v_entry, public.acc_id('5230'), v_total, 0),
        (v_school, v_entry,
         case when coalesce(p_paid,false) then public.acc_id('1120') else public.acc_id('2110') end,
         0, v_total);

      update public.meal_purchases set journal_entry_id = v_entry where id = v_id;
    end if;
  else
    update public.meal_purchases set
      supplier_id = p_supplier, purchase_date = coalesce(p_date, current_date),
      purchase_type = coalesce(nullif(trim(p_type),''),'daily'),
      meals_count = coalesce(p_meals,0), unit_cost = coalesce(p_unit_cost,0),
      total_cost = v_total, period = nullif(trim(p_period),''),
      notes = nullif(trim(p_notes),''), updated_at = now()
    where id = p_id and school_id = v_school
    returning id into v_id;
    if v_id is null then raise exception 'الشراء غير موجود في مدرستك'; end if;
  end if;

  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.mark_meal_purchase_paid(p_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_school uuid;
  v_role   user_role;
  v_purchase record;
  v_entry  uuid;
begin
  v_school := public.my_school_id();
  v_role   := public.my_role();
  if v_school is null then raise exception 'لا مدرسة مرتبطة بحسابك'; end if;
  if v_role not in ('owner','admin','accountant') then raise exception 'غير مصرّح'; end if;

  select * into v_purchase from public.meal_purchases where id = p_id and school_id = v_school;
  if v_purchase is null then raise exception 'الشراء غير موجود في مدرستك'; end if;
  if v_purchase.paid then raise exception 'هذا الشراء مدفوع بالفعل'; end if;

  perform public.ensure_meal_cost_accounts();

  if v_purchase.total_cost > 0 then
    insert into public.journal_entries (school_id, description, reference, created_by)
    values (v_school, 'سداد مستحقات مشتريات وجبات', 'MPAY-' || left(p_id::text,8), auth.uid())
    returning id into v_entry;

    insert into public.journal_lines (school_id, entry_id, account_id, debit, credit) values
      (v_school, v_entry, public.acc_id('2110'), v_purchase.total_cost, 0),
      (v_school, v_entry, public.acc_id('1120'), 0, v_purchase.total_cost);
  end if;

  update public.meal_purchases set paid = true, updated_at = now() where id = p_id;

  return v_entry;
end;
$function$;

CREATE OR REPLACE FUNCTION public.delete_meal_purchase(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_school uuid; v_role user_role; v_entry uuid;
begin
  v_school := public.my_school_id();
  v_role   := public.my_role();
  if v_role not in ('owner','admin','accountant') then raise exception 'غير مصرّح'; end if;

  select journal_entry_id into v_entry from public.meal_purchases where id = p_id and school_id = v_school;
  if v_entry is not null then
    perform public.reverse_journal_entry(v_entry, 'حذف سجل مشتريات وجبات');
  end if;

  delete from public.meal_purchases where id = p_id and school_id = v_school;
end;
$function$;
