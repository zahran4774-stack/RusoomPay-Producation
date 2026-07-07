-- ============================================================================
-- EduPay — اعتماد الدفع + الإشعارات + طرق الدفع المتعددة
-- ولي الأمر يدفع → دفعة "بانتظار المراجعة" → إشعار المحاسب → اعتماد → إشعار ولي الأمر
-- ينفّذ بعد 01..14
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) الدفعات المعلّقة (بانتظار اعتماد المحاسب)
--    method: card | bank | applepay | googlepay | onsite
-- ----------------------------------------------------------------------------
create table if not exists public.pending_payments (
  id           uuid primary key default uuid_generate_v4(),
  school_id    uuid not null references public.schools(id) on delete cascade,
  fee_id       uuid not null references public.student_fees(id) on delete cascade,
  guardian_id  uuid references public.profiles(id),     -- ولي الأمر المُرسِل
  amount       numeric(12,3) not null check (amount > 0),
  method       text not null default 'card',
  bank_ref     text,                                    -- مرجع التحويل البنكي (إن وُجد)
  status       text not null default 'pending',         -- pending | approved | rejected
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz,
  resolved_by  uuid references public.profiles(id)
);
create index if not exists idx_pending_school on public.pending_payments(school_id, status);

-- ----------------------------------------------------------------------------
-- 2) الإشعارات (للمحاسب وولي الأمر)
--    audience: staff (طاقم المدرسة) | guardian (ولي أمر محدّد)
-- ----------------------------------------------------------------------------
create table if not exists public.notifications (
  id           uuid primary key default uuid_generate_v4(),
  school_id    uuid not null references public.schools(id) on delete cascade,
  audience     text not null,                           -- staff | guardian
  guardian_id  uuid references public.profiles(id),     -- إن كان موجّهاً لولي أمر
  body         text not null,
  is_read      boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists idx_notif_school on public.notifications(school_id, audience);
create index if not exists idx_notif_guardian on public.notifications(guardian_id);

alter table public.pending_payments enable row level security;
alter table public.notifications enable row level security;

-- ----------------------------------------------------------------------------
-- 3) سياسات RLS
-- ----------------------------------------------------------------------------
-- الدفعات المعلّقة: طاقم المدرسة يرى الكل؛ ولي الأمر يرى دفعاته
create policy pending_read on public.pending_payments
  for select using (
    (school_id = public.my_school_id() and public.my_role() in ('owner','admin','accountant'))
    or guardian_id = auth.uid()
  );
-- ولي الأمر يُنشئ دفعة لنفسه
create policy pending_insert on public.pending_payments
  for insert with check (guardian_id = auth.uid() and school_id = public.my_school_id());
-- المحاسب يُحدّث (اعتماد/رفض)
create policy pending_update on public.pending_payments
  for update using (school_id = public.my_school_id() and public.my_role() in ('owner','admin','accountant'));

-- الإشعارات: المستخدم يرى ما يخصّه
create policy notif_read on public.notifications
  for select using (
    (audience = 'staff' and school_id = public.my_school_id() and public.my_role() in ('owner','admin','accountant'))
    or (audience = 'guardian' and guardian_id = auth.uid())
  );
create policy notif_update on public.notifications
  for update using (
    (audience = 'staff' and school_id = public.my_school_id())
    or (audience = 'guardian' and guardian_id = auth.uid())
  );

-- ----------------------------------------------------------------------------
-- 4) ولي الأمر يرسل دفعة (تدخل "بانتظار المراجعة" — لا ترحيل محاسبي بعد)
-- ----------------------------------------------------------------------------
create or replace function public.submit_payment(
  p_fee_id uuid,
  p_amount numeric,
  p_method text,
  p_bank_ref text default null
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_school uuid; v_fee record; v_id uuid; v_guardian_name text; v_method_label text;
begin
  -- الفاتورة وبياناتها
  select f.*, s.full_name as student_name, s.guardian_name
  into v_fee
  from public.student_fees f
  join public.students s on s.id = f.student_id
  where f.id = p_fee_id;
  if v_fee is null then raise exception 'الفاتورة غير موجودة'; end if;

  v_school := v_fee.school_id;
  if coalesce(p_amount,0) <= 0 then raise exception 'مبلغ غير صحيح'; end if;
  if p_amount > (v_fee.total - v_fee.paid) + 0.0005 then raise exception 'المبلغ أكبر من المتبقي'; end if;
  if coalesce(p_method,'card') not in ('card','bank','applepay','googlepay','onsite') then
    raise exception 'طريقة دفع غير مدعومة';
  end if;
  if p_method = 'bank' and coalesce(trim(p_bank_ref),'') = '' then
    raise exception 'رقم مرجع التحويل مطلوب';
  end if;

  insert into public.pending_payments(school_id, fee_id, guardian_id, amount, method, bank_ref)
  values (v_school, p_fee_id, auth.uid(), p_amount, p_method, p_bank_ref)
  returning id into v_id;

  v_method_label := case p_method
    when 'card' then 'بطاقة بنكية' when 'bank' then 'تحويل بنكي'
    when 'applepay' then 'Apple Pay' when 'googlepay' then 'Google Pay'
    when 'onsite' then 'نقداً عند المدرسة' else p_method end;

  -- إشعار المحاسب
  insert into public.notifications(school_id, audience, body)
  values (v_school, 'staff',
    '💳 دفعة جديدة بانتظار مراجعتك: ' || to_char(p_amount,'FM999990.000') ||
    ' من ' || coalesce(v_fee.guardian_name,'ولي أمر') || ' (' || v_method_label || ')');

  -- إشعار ولي الأمر
  insert into public.notifications(school_id, audience, guardian_id, body)
  values (v_school, 'guardian', auth.uid(),
    '⏳ استلمنا دفعتك (' || to_char(p_amount,'FM999990.000') || ' — ' || v_method_label ||
    ') وهي قيد المراجعة من المحاسب.');

  return v_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5) المحاسب يعتمد الدفعة → ترحيل محاسبي + خصم من الفاتورة + إشعار ولي الأمر
-- ----------------------------------------------------------------------------
create or replace function public.approve_payment(p_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_school uuid; v_pp record;
begin
  v_school := public.my_school_id();
  if public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح بالاعتماد';
  end if;
  select * into v_pp from public.pending_payments where id = p_id and school_id = v_school;
  if v_pp is null then raise exception 'الدفعة غير موجودة'; end if;
  if v_pp.status <> 'pending' then raise exception 'الدفعة سبق البتّ فيها'; end if;

  -- تسجيل الدفعة الفعلية (يخصم من الفاتورة عبر record_payment الموجودة)
  perform public.record_payment(v_pp.fee_id, v_pp.amount, v_pp.method, current_date);

  update public.pending_payments
  set status = 'approved', resolved_at = now(), resolved_by = auth.uid()
  where id = p_id;

  -- إشعار ولي الأمر بالاعتماد
  insert into public.notifications(school_id, audience, guardian_id, body)
  values (v_school, 'guardian', v_pp.guardian_id,
    '✅ تم اعتماد دفعتك (' || to_char(v_pp.amount,'FM999990.000') || ') بعد مراجعة المحاسب. شكراً لك.');
end;
$$;

-- رفض الدفعة + إشعار ولي الأمر
create or replace function public.reject_payment(p_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_school uuid; v_pp record;
begin
  v_school := public.my_school_id();
  if public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح';
  end if;
  select * into v_pp from public.pending_payments where id = p_id and school_id = v_school;
  if v_pp is null or v_pp.status <> 'pending' then raise exception 'غير قابل للرفض'; end if;

  update public.pending_payments
  set status = 'rejected', resolved_at = now(), resolved_by = auth.uid()
  where id = p_id;

  insert into public.notifications(school_id, audience, guardian_id, body)
  values (v_school, 'guardian', v_pp.guardian_id,
    '❌ تعذّر اعتماد دفعتك (' || to_char(v_pp.amount,'FM999990.000') || '). يرجى مراجعة المدرسة أو إعادة المحاولة.');
end;
$$;

-- ----------------------------------------------------------------------------
-- 6) قوائم العرض
-- ----------------------------------------------------------------------------
-- الدفعات المعلّقة للمحاسب
create or replace function public.pending_payments_list()
returns table(id uuid, guardian text, student text, amount numeric, method text, bank_ref text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select pp.id,
    coalesce(g.full_name,'ولي أمر'), s.full_name,
    pp.amount, pp.method, pp.bank_ref, pp.created_at
  from public.pending_payments pp
  join public.student_fees f on f.id = pp.fee_id
  join public.students s on s.id = f.student_id
  left join public.profiles g on g.id = pp.guardian_id
  where pp.school_id = public.my_school_id() and pp.status = 'pending'
  order by pp.created_at;
$$;

-- إشعاراتي (طاقم المدرسة أو ولي الأمر — حسب الدور)
create or replace function public.my_notifications(p_limit int default 30)
returns setof public.notifications
language sql stable security definer set search_path = public as $$
  select * from public.notifications n
  where (n.audience = 'staff' and n.school_id = public.my_school_id() and public.my_role() in ('owner','admin','accountant'))
     or (n.audience = 'guardian' and n.guardian_id = auth.uid())
  order by n.created_at desc
  limit p_limit;
$$;

-- وسم كل إشعاراتي كمقروءة
create or replace function public.mark_notifications_read()
returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.notifications
  set is_read = true
  where (audience = 'staff' and school_id = public.my_school_id())
     or (audience = 'guardian' and guardian_id = auth.uid());
end;
$$;

grant execute on function public.submit_payment(uuid,numeric,text,text) to authenticated;
grant execute on function public.approve_payment(uuid) to authenticated;
grant execute on function public.reject_payment(uuid) to authenticated;
grant execute on function public.pending_payments_list() to authenticated;
grant execute on function public.my_notifications(int) to authenticated;
grant execute on function public.mark_notifications_read() to authenticated;
