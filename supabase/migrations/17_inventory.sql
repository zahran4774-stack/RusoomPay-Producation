-- ============================================================================
-- EduPay — المخزون (Inventory): كتب وزي مدرسي
-- شراء (مخزون مدين / بنك دائن) · بيع لطالب (فاتورة إيراد + قيد تكلفة مبيعات)
-- ينفّذ بعد 01..16
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) أصناف المخزون
-- ----------------------------------------------------------------------------
create table if not exists public.inventory_items (
  id          uuid primary key default uuid_generate_v4(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  name        text not null,
  qty         int not null default 0,
  cost        numeric(12,3) not null default 0,   -- تكلفة الوحدة
  price       numeric(12,3) not null default 0,   -- سعر البيع للطالب
  vat_rate    numeric(4,2) not null default 5,    -- نسبة الضريبة %
  created_at  timestamptz not null default now()
);
create index if not exists idx_inventory_school on public.inventory_items(school_id);

alter table public.inventory_items enable row level security;

create policy inventory_rw on public.inventory_items
  for all using (school_id = public.my_school_id())
  with check (school_id = public.my_school_id() and public.my_role() in ('owner','admin','accountant'));

-- ----------------------------------------------------------------------------
-- 2) ضمان حسابات المخزون في شجرة المدرسة
--    1310 مخزون · 5520 تكلفة المبيعات · (1120 بنك، 1210 ذمم، 4100 إيراد، 2210 ضريبة موجودة)
-- ----------------------------------------------------------------------------
create or replace function public.ensure_inventory_accounts()
returns void
language plpgsql security definer set search_path = public as $$
declare v_school uuid;
begin
  v_school := public.my_school_id();
  if v_school is null then return; end if;
  insert into public.accounts(school_id, code, name, type)
  select v_school, '1310', 'مخزون الكتب والزي المدرسي', 'asset'
  where not exists (select 1 from public.accounts where school_id = v_school and code = '1310');
  insert into public.accounts(school_id, code, name, type)
  select v_school, '5520', 'تكلفة المبيعات (كتب وزي)', 'expense'
  where not exists (select 1 from public.accounts where school_id = v_school and code = '5520');
end;
$$;

-- مساعد داخلي: معرّف حساب بالكود
create or replace function public.acc_id(p_code text)
returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.accounts where school_id = public.my_school_id() and code = p_code limit 1;
$$;

-- ----------------------------------------------------------------------------
-- 3) إضافة صنف
-- ----------------------------------------------------------------------------
create or replace function public.save_inventory_item(
  p_name text, p_qty int, p_cost numeric, p_price numeric, p_vat numeric default 5
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_school uuid; v_id uuid;
begin
  v_school := public.my_school_id();
  if v_school is null or public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح بإدارة المخزون';
  end if;
  if coalesce(trim(p_name),'') = '' then raise exception 'اسم الصنف مطلوب'; end if;

  insert into public.inventory_items(school_id, name, qty, cost, price, vat_rate)
  values (v_school, p_name, coalesce(p_qty,0), coalesce(p_cost,0), coalesce(p_price,0), coalesce(p_vat,5))
  returning id into v_id;
  return v_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4) شراء مخزون → مخزون (1310) مدين / بنك (1120) دائن + زيادة الكمية
-- ----------------------------------------------------------------------------
create or replace function public.inventory_purchase(p_item uuid, p_qty int)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_school uuid; v_item record; v_cost numeric; v_entry uuid;
begin
  v_school := public.my_school_id();
  if public.my_role() not in ('owner','admin','accountant') then raise exception 'غير مصرّح'; end if;
  select * into v_item from public.inventory_items where id = p_item and school_id = v_school;
  if v_item is null then raise exception 'الصنف غير موجود'; end if;
  if coalesce(p_qty,0) <= 0 then raise exception 'كمية غير صحيحة'; end if;

  perform public.ensure_inventory_accounts();
  v_cost := round(p_qty * v_item.cost, 3);

  -- زيادة الكمية
  update public.inventory_items set qty = qty + p_qty where id = p_item;

  -- قيد محاسبي: مخزون مدين / بنك دائن
  insert into public.journal_entries(school_id, description, reference, created_by)
  values (v_school, 'شراء مخزون: ' || v_item.name || ' ×' || p_qty, 'PUR-' || left(p_item::text,8), auth.uid())
  returning id into v_entry;

  insert into public.journal_lines(school_id, entry_id, account_id, debit, credit) values
    (v_school, v_entry, public.acc_id('1310'), v_cost, 0),
    (v_school, v_entry, public.acc_id('1120'), 0, v_cost);
end;
$$;

-- ----------------------------------------------------------------------------
-- 5) بيع لطالب → فاتورة رسوم (إيراد) + قيد تكلفة المبيعات + خصم الكمية
-- ----------------------------------------------------------------------------
create or replace function public.inventory_sell(p_item uuid, p_qty int, p_student uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_school uuid; v_item record; v_cogs numeric; v_total numeric; v_entry uuid;
begin
  v_school := public.my_school_id();
  if public.my_role() not in ('owner','admin','accountant') then raise exception 'غير مصرّح'; end if;
  select * into v_item from public.inventory_items where id = p_item and school_id = v_school;
  if v_item is null then raise exception 'الصنف غير موجود'; end if;
  if coalesce(p_qty,0) <= 0 then raise exception 'كمية غير صحيحة'; end if;
  if p_qty > v_item.qty then raise exception 'الكمية أكبر من الرصيد المتاح (%)' , v_item.qty; end if;
  if not exists (select 1 from public.students where id = p_student and school_id = v_school) then
    raise exception 'الطالب غير موجود في مدرستك';
  end if;

  perform public.ensure_inventory_accounts();
  v_total := round(p_qty * v_item.price, 3);
  v_cogs := round(p_qty * v_item.cost, 3);

  -- خصم الكمية
  update public.inventory_items set qty = qty - p_qty where id = p_item;

  -- فاتورة رسوم للطالب (إيراد المبيعات)
  insert into public.student_fees(school_id, student_id, description, total, paid, due_date)
  values (v_school, p_student, v_item.name || ' ×' || p_qty, v_total, 0, current_date);

  -- قيد تكلفة المبيعات: 5520 مدين / 1310 دائن
  insert into public.journal_entries(school_id, description, reference, created_by)
  values (v_school, 'تكلفة مبيعات: ' || v_item.name || ' ×' || p_qty, 'COGS-' || left(p_item::text,8), auth.uid())
  returning id into v_entry;

  insert into public.journal_lines(school_id, entry_id, account_id, debit, credit) values
    (v_school, v_entry, public.acc_id('5520'), v_cogs, 0),
    (v_school, v_entry, public.acc_id('1310'), 0, v_cogs);
end;
$$;

-- ----------------------------------------------------------------------------
-- 6) عرض المخزون
-- ----------------------------------------------------------------------------
create or replace function public.inventory_list()
returns table(id uuid, name text, qty int, cost numeric, price numeric, vat_rate numeric, stock_value numeric)
language sql stable security definer set search_path = public as $$
  select id, name, qty, cost, price, vat_rate, round(qty * cost, 3) as stock_value
  from public.inventory_items
  where school_id = public.my_school_id()
  order by created_at;
$$;

grant execute on function public.ensure_inventory_accounts() to authenticated;
grant execute on function public.acc_id(text) to authenticated;
grant execute on function public.save_inventory_item(text,int,numeric,numeric,numeric) to authenticated;
grant execute on function public.inventory_purchase(uuid,int) to authenticated;
grant execute on function public.inventory_sell(uuid,int,uuid) to authenticated;
grant execute on function public.inventory_list() to authenticated;
