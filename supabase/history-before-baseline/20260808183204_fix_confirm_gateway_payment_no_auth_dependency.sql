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
  v_fee record;
  v_student record;
  v_entry_id uuid;
  v_debit_acc uuid;
  v_credit_acc uuid;
begin
  select * into v_pp from public.pending_payments where id = p_id for update;
  if v_pp is null then raise exception 'الدفعة غير موجودة'; end if;

  if v_pp.status = 'approved' then
    return jsonb_build_object('ok', true, 'already_confirmed', true);
  end if;
  if v_pp.status <> 'pending' then
    raise exception 'الدفعة سبق البتّ فيها بحالة غير متوقعة: %', v_pp.status;
  end if;
  if v_pp.txn_state not in ('pending','processing') then
    raise exception 'حالة غير صالحة للتأكيد: %', v_pp.txn_state;
  end if;

  -- نقفل الفاتورة ونتحقق منها مباشرة عبر بيانات الدفعة نفسها — بدون أي اعتماد على auth.uid()
  select * into v_fee from public.student_fees
    where id = v_pp.fee_id and school_id = v_pp.school_id
    for update;
  if v_fee is null then raise exception 'الفاتورة غير موجودة'; end if;

  if v_fee.paid + v_pp.amount > v_fee.total + 0.0005 then
    raise exception 'المبلغ يتجاوز المتبقّي على الفاتورة';
  end if;

  select full_name, code into v_student from public.students where id = v_fee.student_id;

  -- تسجيل الدفعة الفعلية (نفس منطق record_payment، بدون فحوصات هوية مستخدم)
  insert into public.payments(school_id, fee_id, amount, method, paid_at, recorded_by)
  values (v_pp.school_id, v_pp.fee_id, v_pp.amount, 'thawani', current_date, null);

  update public.student_fees set paid = paid + v_pp.amount where id = v_pp.fee_id;

  select id into v_debit_acc  from public.accounts where school_id = v_pp.school_id and code = '1120'; -- البنك
  select id into v_credit_acc from public.accounts where school_id = v_pp.school_id and code = '1210'; -- ذمم أولياء الأمور

  if v_debit_acc is not null and v_credit_acc is not null then
    insert into public.journal_entries(school_id, entry_date, description, reference, fee_id, created_by)
    values (
      v_pp.school_id, current_date,
      'تحصيل رسوم الطالب ' || coalesce(v_student.full_name,'') ||
        ' (' || coalesce(v_student.code,'') || ') — ثواني',
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
  values (v_pp.school_id, null, 'تسجيل دفعة رسوم (ثواني تلقائي)', v_pp.amount::text || ' (thawani)');

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
