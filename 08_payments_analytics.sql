-- ============================================================================
-- EduPay — جدول الدفعات + تحليلات التحصيل
-- يسجّل كل دفعة على حدة (بتاريخها) لتمكين الرسوم البيانية الشهرية الدقيقة
-- ينفّذ بعد 01..07
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) جدول الدفعات — كل دفعة بتاريخها (يغذّي تحليلات التحصيل)
-- ----------------------------------------------------------------------------
create table if not exists public.payments (
  id          uuid primary key default uuid_generate_v4(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  fee_id      uuid not null references public.student_fees(id) on delete cascade,
  amount      numeric(12,3) not null check (amount > 0),
  method      text not null default 'bank',        -- bank, cash, card...
  paid_at     date not null default current_date,
  recorded_by uuid references public.profiles(id),
  created_at  timestamptz not null default now()
);
create index if not exists idx_payments_school_date on public.payments(school_id, paid_at);

alter table public.payments enable row level security;

-- سياسات: طاقم المدرسة يقرأ ويُسجّل دفعات مدرسته فقط
create policy payments_read on public.payments
  for select using (school_id = public.my_school_id() and public.my_role() in ('owner','admin','accountant'));
create policy payments_insert on public.payments
  for insert with check (school_id = public.my_school_id() and public.my_role() in ('owner','admin','accountant'));

-- ----------------------------------------------------------------------------
-- 2) تسجيل دفعة — تضيف للجدول وتحدّث رصيد الفاتورة ذرّياً
-- ----------------------------------------------------------------------------
create or replace function public.record_payment(
  p_fee_id uuid,
  p_amount numeric,
  p_method text default 'bank',
  p_paid_at date default current_date
)
returns void
language plpgsql security definer set search_path = public as $$
declare v_school uuid; v_fee record;
begin
  if public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح بتسجيل الدفعات';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'مبلغ الدفعة يجب أن يكون أكبر من صفر';
  end if;

  v_school := public.my_school_id();
  select * into v_fee from public.student_fees where id = p_fee_id and school_id = v_school;
  if not found then raise exception 'الفاتورة غير موجودة'; end if;
  if v_fee.paid + p_amount > v_fee.total + 0.0005 then
    raise exception 'المبلغ يتجاوز المتبقّي على الفاتورة';
  end if;

  insert into public.payments(school_id, fee_id, amount, method, paid_at, recorded_by)
  values(v_school, p_fee_id, p_amount, coalesce(p_method,'bank'), coalesce(p_paid_at,current_date), auth.uid());

  update public.student_fees set paid = paid + p_amount where id = p_fee_id;

  insert into public.audit_log(school_id, actor_id, action, details)
  values(v_school, auth.uid(), 'تسجيل دفعة رسوم', p_amount::text);
end; $$;

-- ----------------------------------------------------------------------------
-- 3) تحليلات التحصيل الشهري — آخر 12 شهراً + مقارنة بالعام الماضي
-- ----------------------------------------------------------------------------
create or replace function public.collection_analytics()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_school uuid := public.my_school_id();
  v_months jsonb;
  v_this_year numeric;
  v_last_year numeric;
begin
  if v_school is null then return jsonb_build_object('error','no_school'); end if;

  -- التحصيل الشهري لآخر 12 شهراً
  select jsonb_agg(jsonb_build_object('month', m, 'amount', amt) order by m)
    into v_months
  from (
    select to_char(date_trunc('month', paid_at),'YYYY-MM') as m, sum(amount) as amt
    from public.payments
    where school_id = v_school and paid_at >= (current_date - interval '12 months')
    group by date_trunc('month', paid_at)
  ) t;

  -- إجمالي هذا العام والعام الماضي (للمقارنة)
  select coalesce(sum(amount),0) into v_this_year
    from public.payments where school_id = v_school
      and extract(year from paid_at) = extract(year from current_date);
  select coalesce(sum(amount),0) into v_last_year
    from public.payments where school_id = v_school
      and extract(year from paid_at) = extract(year from current_date) - 1;

  return jsonb_build_object(
    'months', coalesce(v_months, '[]'::jsonb),
    'this_year', round(v_this_year,3),
    'last_year', round(v_last_year,3)
  );
end; $$;

-- ============================================================================
-- ملاحظة: الفواتير القديمة (قبل هذا الجدول) لا تظهر في التحليلات،
-- لأن دفعاتها لم تُسجّل بتاريخ. التحليلات تبدأ من أول دفعة تُسجّل عبر record_payment.
-- ============================================================================
