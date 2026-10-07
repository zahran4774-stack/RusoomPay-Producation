DROP FUNCTION IF EXISTS public.transition_payment_state(uuid, text, text, text);

CREATE FUNCTION public.transition_payment_state(
  p_payment_id uuid, p_to_state text, p_reason text DEFAULT NULL::text, p_provider_ref text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare v_school uuid; v_from text; v_allowed boolean;
begin
  select school_id, txn_state into v_school, v_from
    from public.pending_payments where id = p_payment_id;
  if v_school is null then raise exception 'الدفعة غير موجودة'; end if;

  -- التحقق من التفويض: عضو فعلي بنفس مدرسة الدفعة، وبدور إداري/محاسبي
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and school_id = v_school
      and role in ('owner','admin','accountant')
  ) then
    raise exception 'غير مصرّح: تغيير حالة الدفعة للطاقم الإداري فقط';
  end if;

  v_allowed := case
    when v_from = 'pending'    and p_to_state in ('processing','failed')            then true
    when v_from = 'processing' and p_to_state in ('paid','failed')                  then true
    when v_from = 'paid'       and p_to_state in ('refunded')                       then true
    when v_from = 'failed'     and p_to_state in ('pending','processing')           then true
    else false
  end;
  if not v_allowed then
    raise exception 'انتقال غير مسموح: % → %', v_from, p_to_state;
  end if;

  update public.pending_payments
    set txn_state = p_to_state,
        provider_ref = coalesce(p_provider_ref, provider_ref),
        failure_reason = case when p_to_state = 'failed' then p_reason else failure_reason end,
        state_updated_at = now()
    where id = p_payment_id;

  insert into public.payment_state_log(payment_id, school_id, from_state, to_state, reason, actor_id)
  values (p_payment_id, v_school, v_from, p_to_state, p_reason, auth.uid());
end;
$function$;