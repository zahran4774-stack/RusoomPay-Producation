-- ============================================================================
-- RusoomPay — التقارير المالية الفترية (سنوية/ضريبية/كشوف المدقّقين)
-- دوال تقبل مدى تاريخياً يختاره المحاسب: ميزان مراجعة، قائمة دخل، ميزانية.
-- ينفّذ بعد 01..26
-- ============================================================================

-- 1) ميزان المراجعة الفترّي — أرصدة كل حساب ضمن مدى تاريخي
--    (أساس كشوف المدقّقين: مدين/دائن لكل حساب)
create or replace function public.trial_balance_period(
  p_from date,
  p_to   date
)
returns table(
  account_id uuid,
  code       text,
  name       text,
  type       text,
  debit      numeric,
  credit     numeric,
  balance    numeric
)
language sql stable security definer set search_path = public as $$
  select
    a.id, a.code, a.name, a.type,
    coalesce(round(sum(l.debit), 3), 0)  as debit,
    coalesce(round(sum(l.credit), 3), 0) as credit,
    coalesce(round(sum(l.debit - l.credit), 3), 0) as balance
  from public.accounts a
  left join public.journal_lines l on l.account_id = a.id
  left join public.journal_entries e on e.id = l.entry_id
    and e.entry_date >= p_from and e.entry_date <= p_to
  where a.school_id = public.my_school_id()
  group by a.id, a.code, a.name, a.type
  order by a.code;
$$;

-- 2) قائمة الدخل الفترّية — الإيرادات والمصروفات وصافي الربح
create or replace function public.income_statement_period(
  p_from date,
  p_to   date
)
returns table(
  section  text,   -- 'revenue' أو 'expense'
  code     text,
  name     text,
  amount   numeric
)
language sql stable security definer set search_path = public as $$
  select
    case when a.type = 'revenue' then 'revenue' else 'expense' end as section,
    a.code, a.name,
    case when a.type = 'revenue'
      then coalesce(round(sum(l.credit - l.debit), 3), 0)
      else coalesce(round(sum(l.debit - l.credit), 3), 0)
    end as amount
  from public.accounts a
  left join public.journal_lines l on l.account_id = a.id
  left join public.journal_entries e on e.id = l.entry_id
    and e.entry_date >= p_from and e.entry_date <= p_to
  where a.school_id = public.my_school_id()
    and a.type in ('revenue', 'expense')
  group by a.id, a.code, a.name, a.type
  having coalesce(round(sum(l.debit - l.credit), 3), 0) <> 0
  order by section, a.code;
$$;

-- 3) الميزانية العمومية حتى تاريخ — الأصول والخصوم وحقوق الملكية
create or replace function public.balance_sheet_asof(
  p_asof date
)
returns table(
  section  text,   -- 'asset' / 'liability' / 'equity'
  code     text,
  name     text,
  balance  numeric
)
language sql stable security definer set search_path = public as $$
  select
    a.type as section, a.code, a.name,
    case when a.type in ('asset')
      then coalesce(round(sum(l.debit - l.credit), 3), 0)
      else coalesce(round(sum(l.credit - l.debit), 3), 0)
    end as balance
  from public.accounts a
  left join public.journal_lines l on l.account_id = a.id
  left join public.journal_entries e on e.id = l.entry_id
    and e.entry_date <= p_asof
  where a.school_id = public.my_school_id()
    and a.type in ('asset', 'liability', 'equity')
  group by a.id, a.code, a.name, a.type
  having coalesce(round(sum(l.debit - l.credit), 3), 0) <> 0
  order by a.type, a.code;
$$;

-- 4) دفتر اليومية الفترّي — كل القيود ضمن مدى (لكشوف المدقّقين)
create or replace function public.journal_period(
  p_from date,
  p_to   date
)
returns table(
  entry_date  date,
  reference   text,
  description text,
  account_code text,
  account_name text,
  debit       numeric,
  credit      numeric
)
language sql stable security definer set search_path = public as $$
  select
    e.entry_date, e.reference, e.description,
    a.code, a.name,
    round(l.debit, 3), round(l.credit, 3)
  from public.journal_entries e
  join public.journal_lines l on l.entry_id = e.id
  join public.accounts a on a.id = l.account_id
  where e.school_id = public.my_school_id()
    and e.entry_date >= p_from and e.entry_date <= p_to
  order by e.entry_date, e.id, a.code;
$$;

grant execute on function public.trial_balance_period(date, date)   to authenticated;
grant execute on function public.income_statement_period(date, date) to authenticated;
grant execute on function public.balance_sheet_asof(date)            to authenticated;
grant execute on function public.journal_period(date, date)          to authenticated;
