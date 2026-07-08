-- ============================================================================
-- EduPay — تحسين الأداء: حساب الأرصدة في قاعدة البيانات
-- يعالج نقطة الاختناق: بدل جلب كل القيود للمتصفح وحسابها، تحسبها قاعدة البيانات
-- مهما تراكمت القيود، يبقى الحساب لحظياً (مفهرس على school_id)
-- ينفّذ بعد 01..04
-- ============================================================================

-- ----------------------------------------------------------------------------
-- فهرس مركّب لتسريع تجميع السطور حسب الحساب (الأهم للأداء)
-- ----------------------------------------------------------------------------
create index if not exists idx_lines_school_account
  on public.journal_lines(school_id, account_id);

-- ----------------------------------------------------------------------------
-- 1) أرصدة كل الحسابات لمدرسة المستخدم — دفعة واحدة بكفاءة
--    تُرجع: الرمز، الاسم، النوع، الرصيد (مدين - دائن)
-- ----------------------------------------------------------------------------
create or replace function public.account_balances()
returns table(
  account_id uuid,
  code text,
  name text,
  type text,
  balance numeric
)
language sql stable security definer set search_path = public as $$
  select
    a.id,
    a.code,
    a.name,
    a.type,
    coalesce(round(sum(l.debit - l.credit), 3), 0) as balance
  from public.accounts a
  left join public.journal_lines l
    on l.account_id = a.id and l.school_id = a.school_id
  where a.school_id = public.my_school_id()
  group by a.id, a.code, a.name, a.type
  order by a.code;
$$;

-- ----------------------------------------------------------------------------
-- 2) الملخّص المالي (الإيرادات/المصروفات/الربح/النقدية) — لحظي
--    يطبّق طبيعة الحساب: الإيراد/الخصوم/الملكية دائنة، الأصول/المصروفات مدينة
-- ----------------------------------------------------------------------------
create or replace function public.financial_summary()
returns table(
  revenue numeric,
  expense numeric,
  profit numeric,
  cash numeric,
  receivables numeric,
  vat numeric
)
language sql stable security definer set search_path = public as $$
  with bal as (
    select a.code, a.type,
      coalesce(sum(l.debit - l.credit), 0) as b
    from public.accounts a
    left join public.journal_lines l
      on l.account_id = a.id and l.school_id = a.school_id
    where a.school_id = public.my_school_id()
    group by a.code, a.type
  )
  select
    round(coalesce(-sum(b) filter (where type = 'revenue'), 0), 3) as revenue,
    round(coalesce( sum(b) filter (where type = 'expense'), 0), 3) as expense,
    round(coalesce(-sum(b) filter (where type = 'revenue'), 0)
        - coalesce( sum(b) filter (where type = 'expense'), 0), 3) as profit,
    round(coalesce( sum(b) filter (where code in ('1110','1120')), 0), 3) as cash,
    round(coalesce( sum(b) filter (where code = '1210'), 0), 3) as receivables,
    round(coalesce(-sum(b) filter (where code = '2210'), 0), 3) as vat
  from bal;
$$;

-- ============================================================================
-- الأثر: صفحة المحاسبة تستدعي هاتين الدالتين بدل جلب كل القيود.
-- التجميع يتم في PostgreSQL (مفهرس) — يبقى لحظياً عند ملايين السطور.
-- القيود التفصيلية تُجلب مع limit/range للعرض فقط (لا للحساب).
-- ============================================================================
