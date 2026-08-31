-- ============================================================================
-- P0 Payment Consistency Gate
--
-- record_thawani_payment (called from the Thawani webhook) and
-- confirm_gateway_payment (called from /payment-result, the redirect landing
-- page) had drifted into two separate implementations of the same business
-- operation. Only confirm_gateway_payment updated txn_state, wrote a
-- payment_state_log row, and inserted an in-app notification — so which
-- entry point won the confirmation race determined the final financial
-- state. Unacceptable for a payments system.
--
-- Fix: extract one authoritative internal function,
-- public._confirm_thawani_payment_core(p_pending_id, p_provider_ref).
-- Both public RPCs become thin wrappers over it with their signatures and
-- grants unchanged, so no application code needs to change.
--
-- Idempotency: the core takes a row lock (FOR UPDATE) on pending_payments
-- first, then checks status='approved' OR txn_state='paid' before doing any
-- work — so concurrent webhook + /payment-result calls (or repeat calls of
-- either) serialize on the lock and only the first performs the state
-- transition; every other caller gets {ok:true, already_confirmed:true,
-- duplicate:true} and does nothing further (both callers' application code
-- already branches on these flags before sending WhatsApp).
-- ============================================================================

create or replace function public._confirm_thawani_payment_core(
  p_pending_id uuid,
  p_provider_ref text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_pp             record;
  v_fee            record;
  v_student        record;
  v_entry_id       uuid;
  v_debit_acc      uuid;
  v_credit_acc     uuid;
  v_school_name    text;
  v_guardian_phone text;
  v_guardian_name  text;
  v_paid_at        date := current_date;
begin
  select * into v_pp from public.pending_payments where id = p_pending_id for update;
  if not found then
    raise exception 'سجل الدفعة المعلّقة غير موجود';
  end if;

  -- Defense-in-depth: this core is Thawani-specific. Both current callers
  -- already filter on method='thawani' upstream, but the RPC itself must
  -- not trust that.
  if v_pp.method <> 'thawani' then
    raise exception 'هذه الدالة مخصّصة لدفعات ثواني فقط';
  end if;

  if v_pp.status = 'approved' or v_pp.txn_state = 'paid' then
    return jsonb_build_object('ok', true, 'already_confirmed', true, 'duplicate', true);
  end if;

  if v_pp.status <> 'pending' then
    raise exception 'حالة الدفعة المعلّقة غير صالحة للاعتماد: %', v_pp.status;
  end if;

  select * into v_fee from public.student_fees
    where id = v_pp.fee_id and school_id = v_pp.school_id
    for update;
  if not found then
    raise exception 'الفاتورة غير موجودة';
  end if;

  if v_fee.paid + v_pp.amount > v_fee.total + 0.0005 then
    raise exception 'المبلغ يتجاوز المتبقّي على الفاتورة';
  end if;

  select full_name, code, guardian_phone, guardian_name
    into v_student
    from public.students where id = v_fee.student_id;

  insert into public.payments(school_id, fee_id, amount, method, paid_at, recorded_by)
  values (v_pp.school_id, v_pp.fee_id, v_pp.amount, 'thawani', v_paid_at, null);

  update public.student_fees set paid = paid + v_pp.amount where id = v_pp.fee_id;

  select id into v_debit_acc  from public.accounts where school_id = v_pp.school_id and code = '1120';
  select id into v_credit_acc from public.accounts where school_id = v_pp.school_id and code = '1210';

  if v_debit_acc is not null and v_credit_acc is not null then
    insert into public.journal_entries(school_id, entry_date, description, reference, fee_id, created_by)
    values (
      v_pp.school_id, v_paid_at,
      'تحصيل رسوم الطالب ' || coalesce(v_student.full_name,'') ||
        ' (' || coalesce(v_student.code,'') || ') — دفع عبر ثواني',
      'INV-' || substr(v_pp.fee_id::text, 1, 8),
      v_pp.fee_id, null
    )
    returning id into v_entry_id;

    insert into public.journal_lines(school_id, entry_id, account_id, debit, credit)
    values (v_pp.school_id, v_entry_id, v_debit_acc, v_pp.amount, 0);
    insert into public.journal_lines(school_id, entry_id, account_id, debit, credit)
    values (v_pp.school_id, v_entry_id, v_credit_acc, 0, v_pp.amount);
  end if;

  insert into public.audit_log(school_id, actor_id, action, details)
  values (v_pp.school_id, null, 'تسجيل دفعة رسوم (ثواني — اعتماد تلقائي)', v_pp.amount::text);

  update public.pending_payments
  set status = 'approved',
      txn_state = 'paid',
      provider_ref = coalesce(p_provider_ref, provider_ref),
      state_updated_at = now(),
      resolved_at = now(),
      resolved_by = null
  where id = p_pending_id;

  insert into public.payment_state_log(payment_id, school_id, from_state, to_state, reason, actor_id)
  values (p_pending_id, v_pp.school_id, v_pp.txn_state, 'paid', 'thawani_verified_paid', null);

  insert into public.notifications(school_id, audience, guardian_id, body)
  values (v_pp.school_id, 'guardian', v_pp.guardian_id,
    '✅ تم تأكيد دفعتك (' || to_char(v_pp.amount,'FM999990.000') || ') عبر ثواني بنجاح.');

  select name into v_school_name from public.schools where id = v_pp.school_id;

  select pr.phone into v_guardian_phone
    from public.profiles pr
    where pr.id = v_pp.guardian_id and pr.phone is not null;
  if v_guardian_phone is null then
    v_guardian_phone := v_student.guardian_phone;
  end if;
  v_guardian_name := coalesce(v_student.guardian_name, 'ولي الأمر');

  return jsonb_build_object(
    'ok', true,
    'fee_id', v_pp.fee_id,
    'amount', v_pp.amount,
    'student_name', v_student.full_name,
    'guardian_name', v_guardian_name,
    'guardian_phone', v_guardian_phone,
    'method', 'thawani',
    'school_name', v_school_name,
    'remaining', (v_fee.total - (v_fee.paid + v_pp.amount))
  );
end;
$$;

-- Internal only — never reachable from a client. New functions in this
-- project auto-inherit an EXECUTE grant to `authenticated` via a project-wide
-- default privilege, so this must be revoked explicitly.
revoke all on function public._confirm_thawani_payment_core(uuid, text) from public, authenticated, anon;
grant execute on function public._confirm_thawani_payment_core(uuid, text) to service_role;

-- Thin wrapper — webhook entry point. Signature unchanged, no caller changes needed.
create or replace function public.record_thawani_payment(p_pending_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  return public._confirm_thawani_payment_core(p_pending_id, null);
end;
$$;

-- Thin wrapper — /payment-result entry point. Signature unchanged, no caller changes needed.
create or replace function public.confirm_gateway_payment(p_id uuid, p_provider_ref text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  return public._confirm_thawani_payment_core(p_id, p_provider_ref);
end;
$$;

-- ----------------------------------------------------------------------------
-- Data-consistency backfill: any thawani payment already approved via the OLD
-- record_thawani_payment (webhook-only path) never got txn_state='paid' or a
-- payment_state_log row. Fix the state flag and add one audit trail entry.
-- Deliberately does NOT re-insert public.notifications or re-send WhatsApp for
-- these historical rows — guardians were already notified at the time.
-- No-op on a fresh database (nothing to match).
-- ----------------------------------------------------------------------------
with backfill as (
  update public.pending_payments
  set txn_state = 'paid',
      state_updated_at = now()
  where method = 'thawani'
    and status = 'approved'
    and txn_state <> 'paid'
  returning id, school_id, txn_state as new_state
)
insert into public.payment_state_log(payment_id, school_id, from_state, to_state, reason, actor_id)
select id, school_id, 'pending', 'paid', 'backfill_consistency_fix_p0_gate', null
from backfill;
