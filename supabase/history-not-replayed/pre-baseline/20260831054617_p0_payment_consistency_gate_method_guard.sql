
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

  -- defense-in-depth: this core is Thawani-specific; callers already filter
  -- on method upstream, but the RPC itself must not trust that.
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

revoke all on function public._confirm_thawani_payment_core(uuid, text) from public, authenticated, anon;
grant execute on function public._confirm_thawani_payment_core(uuid, text) to service_role;
