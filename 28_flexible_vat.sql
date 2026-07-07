-- ============================================================================
-- RusoomPay — احتساب الضريبة المرن حسب قانون الدولة
-- ثلاث حالات: mandatory (إلزامي) · optional (اختياري) · none (لا يوجد)
-- الدولة تحدّد النسبة والحالة؛ المدرسة تفعّل/تعطّل إن كانت اختيارية.
-- ينفّذ بعد 01..27
-- ============================================================================

-- 1) إعدادات الضريبة لكل دولة (على جدول الدول الموجود)
alter table public.platform_countries
  add column if not exists vat_rate numeric(5,2) not null default 0,      -- النسبة % (مثلاً 5.00)
  add column if not exists vat_mode text not null default 'none'          -- mandatory / optional / none
    check (vat_mode in ('mandatory', 'optional', 'none'));

-- ضبط الحالة الواقعية لدول الخليج (يناير 2026):
-- عُمان/السعودية/الإمارات/البحرين: 5% إلزامي · الكويت/قطر: لا ضريبة على التعليم بعد
update public.platform_countries set vat_rate = 5.00, vat_mode = 'mandatory' where code in ('OM','SA','AE','BH');
update public.platform_countries set vat_rate = 0.00, vat_mode = 'none'      where code in ('KW','QA');

-- 2) إعداد الضريبة لكل مدرسة (يُستخدم فقط حين تكون حالة الدولة optional)
alter table public.schools
  add column if not exists vat_enabled boolean not null default false;

-- 3) دالة تُرجع إعداد الضريبة الفعلي للمدرسة الحالية
--    (تدمج قانون الدولة مع اختيار المدرسة)
create or replace function public.my_vat_setting()
returns table(
  country_code text,
  vat_mode     text,
  vat_rate     numeric,
  applies      boolean   -- هل تُحتسب الضريبة فعلياً لهذه المدرسة؟
)
language sql stable security definer set search_path = public as $$
  select
    c.code, c.vat_mode, c.vat_rate,
    case
      when c.vat_mode = 'mandatory' then true
      when c.vat_mode = 'optional'  then s.vat_enabled
      else false
    end as applies
  from public.schools s
  join public.platform_countries c on c.code = coalesce(s.country, 'OM')
  where s.id = public.my_school_id();
$$;

-- 4) دالة لتفعيل/تعطيل الضريبة للمدرسة — للمدير فقط، وفقط إن كانت الدولة optional
create or replace function public.set_school_vat(p_enabled boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare v_mode text; v_school uuid;
begin
  if public.my_role() <> 'owner' then
    raise exception 'غير مصرّح: إعداد الضريبة لمدير المدرسة فقط';
  end if;
  v_school := public.my_school_id();

  select c.vat_mode into v_mode
  from public.schools s
  join public.platform_countries c on c.code = coalesce(s.country, 'OM')
  where s.id = v_school;

  if v_mode = 'mandatory' then
    raise exception 'الضريبة إلزامية في دولتك ولا يمكن تعطيلها';
  elsif v_mode = 'none' then
    raise exception 'لا توجد ضريبة مطبّقة في دولتك';
  end if;

  -- الحالة optional فقط تصل هنا
  update public.schools set vat_enabled = p_enabled where id = v_school;

  insert into public.audit_log(school_id, actor_id, action, details)
  values (v_school, auth.uid(), 'set_vat', 'تحديث إعداد احتساب الضريبة: ' || p_enabled::text);
end;
$$;

-- 5) التقرير الضريبي الفترّي — يحسب الضريبة على الإيرادات ضمن مدة
--    (يعمل فقط إن كانت الضريبة تنطبق على المدرسة)
create or replace function public.vat_report_period(
  p_from date,
  p_to   date
)
returns table(
  applies       boolean,
  vat_rate      numeric,
  revenue_total numeric,   -- إجمالي الإيرادات (قبل الضريبة)
  vat_amount    numeric    -- قيمة الضريبة المحتسبة
)
language sql stable security definer set search_path = public as $$
  with setting as (select * from public.my_vat_setting()),
  rev as (
    select coalesce(round(sum(l.credit - l.debit), 3), 0) as total
    from public.accounts a
    join public.journal_lines l on l.account_id = a.id
    join public.journal_entries e on e.id = l.entry_id
    where a.school_id = public.my_school_id()
      and a.type = 'revenue'
      and e.entry_date >= p_from and e.entry_date <= p_to
  )
  select
    s.applies, s.vat_rate,
    rev.total,
    case when s.applies then round(rev.total * s.vat_rate / 100, 3) else 0 end
  from setting s, rev;
$$;

grant execute on function public.my_vat_setting()              to authenticated;
grant execute on function public.set_school_vat(boolean)       to authenticated;
grant execute on function public.vat_report_period(date, date) to authenticated;
