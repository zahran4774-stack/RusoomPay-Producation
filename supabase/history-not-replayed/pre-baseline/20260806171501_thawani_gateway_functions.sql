-- ============================================================
-- تكامل ثواني: 3 دوال تُستدعى فقط من السيرفر عبر service_role
-- (webhook/API routes) — ممنوعة تماماً على العميل (anon/authenticated)
-- ============================================================

-- 1) عند إنشاء جلسة دفع في ثواني: نربط session_id بالدفعة المعلّقة
create or replace function public.set_gateway_session(
  p_id uuid,
  p_session_id text
) returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_pp record;
begin
  select * into v_pp from public.pending_payments where id = p_id for update;
  if v_pp is null then raise exception 'الدفعة غير موجودة'; end if;
  if v_pp.txn_state <> 'pending' then
    raise exception 'لا يمكن ربط جلسة دفع بدفعة ليست بحالة pending (الحالية: %)', v_pp.txn_state;
  end if;

  update public.pending_payments
  set txn_state = 'processing',
      provider_ref = p_session_id,
      state_updated_at = now()
  where id = p_id;

  insert into public.payment_state_log(payment_id, school_id, from_state, to_state, reason, actor_id)
  values (p_id, v_pp.school_id, 'pending', 'processing', 'thawani_session_created', null);
end;
$$;

revoke all on function public.set_gateway_session(uuid, text) from public, anon, authenticated;
grant execute on function public.set_gateway_session(uuid, text) to service_role;


-- 2) بعد التحقق الفعلي من ثواني (Retrieve Session) أن الدفع "paid":
--    نسجّل الدفعة محاسبياً (عبر record_payment) ونعتمدها — نفس منطق approve_payment
create or replace function public.confirm_gateway_payment(
  p_id uuid,
  p_provider_ref text
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_pp record;
begin
  select * into v_pp from public.pending_payments where id = p_id for update;
  if v_pp is null then raise exception 'الدفعة غير موجودة'; end if;

  -- حماية من التكرار: لو سبق اعتمادها (مثلاً استدعاء مزدوج للـ webhook) نرجع بهدوء
  if v_pp.status = 'approved' then
    return jsonb_build_object('ok', true, 'already_confirmed', true);
  end if;
  if v_pp.status <> 'pending' then
    raise exception 'الدفعة سبق البتّ فيها بحالة غير متوقعة: %', v_pp.status;
  end if;
  if v_pp.txn_state not in ('pending','processing') then
    raise exception 'حالة غير صالحة للتأكيد: %', v_pp.txn_state;
  end if;

  perform public.record_payment(v_pp.fee_id, v_pp.amount, v_pp.method, current_date);

  update public.pending_payments
  set status = 'approved',
      txn_state = 'paid',
      provider_ref = coalesce(p_provider_ref, provider_ref),
      state_updated_at = now(),
      resolved_at = now(),
      resolved_by = null
  where id = p_id;

  insert into public.payment_state_log(payment_id, school_id, from_state, to_state, reason, actor_id)
  values (p_id, v_pp.school_id, v_pp.txn_state, 'paid', 'thawani_verified_paid', null);

  insert into public.notifications(school_id, audience, guardian_id, body)
  values (v_pp.school_id, 'guardian', v_pp.guardian_id,
    '✅ تم تأكيد دفعتك (' || to_char(v_pp.amount,'FM999990.000') || ') عبر ثواني بنجاح.');

  return jsonb_build_object('ok', true, 'fee_id', v_pp.fee_id, 'amount', v_pp.amount);
end;
$$;

revoke all on function public.confirm_gateway_payment(uuid, text) from public, anon, authenticated;
grant execute on function public.confirm_gateway_payment(uuid, text) to service_role;


-- 3) لو ثواني رجعت حالة غير مدفوعة/ملغاة
create or replace function public.mark_gateway_payment_failed(
  p_id uuid,
  p_reason text
) returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_pp record;
begin
  select * into v_pp from public.pending_payments where id = p_id for update;
  if v_pp is null then raise exception 'الدفعة غير موجودة'; end if;

  -- لو سبق تأكيدها كمدفوعة، لا نلمسها أبداً
  if v_pp.status = 'approved' or v_pp.txn_state = 'paid' then
    return;
  end if;

  update public.pending_payments
  set txn_state = 'failed',
      failure_reason = p_reason,
      state_updated_at = now()
  where id = p_id;

  insert into public.payment_state_log(payment_id, school_id, from_state, to_state, reason, actor_id)
  values (p_id, v_pp.school_id, v_pp.txn_state, 'failed', p_reason, null);
end;
$$;

revoke all on function public.mark_gateway_payment_failed(uuid, text) from public, anon, authenticated;
grant execute on function public.mark_gateway_payment_failed(uuid, text) to service_role;
