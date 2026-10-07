
-- 1) تتبّع القيد المحاسبي لكل عملية شراء وجبات
alter table public.meal_purchases add column if not exists journal_entry_id uuid references public.journal_entries(id);

-- 2) إنشاء حسابات تكلفة/ذمم الوجبات لو غير موجودة للمدرسة
create or replace function public.ensure_meal_cost_accounts()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_school uuid;
begin
  v_school := public.my_school_id();
  if v_school is null then return; end if;
  insert into public.accounts(school_id, code, name, type)
  select v_school, '5230', 'تكلفة الوجبات (تغذية)', 'expense'
  where not exists (select 1 from public.accounts where school_id = v_school and code = '5230');
  insert into public.accounts(school_id, code, name, type)
  select v_school, '2110', 'ذمم موردي التغذية', 'liability'
  where not exists (select 1 from public.accounts where school_id = v_school and code = '2110');
end;
$$;

revoke all on function public.ensure_meal_cost_accounts() from public;
grant execute on function public.ensure_meal_cost_accounts() to authenticated;

-- 3) عند تسجيل شراء جديد: قيد استحقاق فوري (مدين مصروف / دائن ذمم أو بنك حسب حالة الدفع)
--    عند التعديل: لا نعيد نشر القيد ولا نغيّر حالة الدفع (تتم فقط عبر mark_meal_purchase_paid)
create or replace function public.save_meal_purchase(
  p_id uuid, p_supplier uuid, p_date date, p_type text,
  p_meals int, p_unit_cost numeric, p_period text, p_paid boolean, p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school uuid;
  v_role   user_role;
  v_id     uuid;
  v_total  numeric;
  v_entry  uuid;
  v_supplier_name text;
begin
  select school_id, role into v_school, v_role from public.profiles where id = auth.uid();
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
$$;

-- 4) تسوية السداد: يقفل الذمم من البنك، ويعلّم الشراء كمدفوع (المسار الوحيد لتغيير حالة الدفع)
create or replace function public.mark_meal_purchase_paid(p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school uuid;
  v_role   user_role;
  v_purchase record;
  v_entry  uuid;
begin
  select school_id, role into v_school, v_role from public.profiles where id = auth.uid();
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
$$;

revoke all on function public.mark_meal_purchase_paid(uuid) from public;
grant execute on function public.mark_meal_purchase_paid(uuid) to authenticated;

-- 5) الحذف: يعكس القيد المحاسبي أولًا (لا يُترك القيد معلّقًا في الدفاتر) ثم يحذف السجل
create or replace function public.delete_meal_purchase(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_school uuid; v_role user_role; v_entry uuid;
begin
  select school_id, role into v_school, v_role from public.profiles where id = auth.uid();
  if v_role not in ('owner','admin','accountant') then raise exception 'غير مصرّح'; end if;

  select journal_entry_id into v_entry from public.meal_purchases where id = p_id and school_id = v_school;
  if v_entry is not null then
    perform public.reverse_journal_entry(v_entry, 'حذف سجل مشتريات وجبات');
  end if;

  delete from public.meal_purchases where id = p_id and school_id = v_school;
end;
$$;

revoke all on function public.delete_meal_purchase(uuid) from public;
grant execute on function public.delete_meal_purchase(uuid) to authenticated;
