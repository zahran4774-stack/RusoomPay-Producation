-- تعديل جوهري: بما أن الإيراد يُسجَّل الآن عند إصدار الفاتورة (عبر تريغر الاستحقاق)،
-- السداد لم يعد يُسجَّل كإيراد جديد — بل يُبرئ ذمّة ولي الأمر (1210) بدل ذلك.
-- القيد الجديد عند السداد: نقدية/بنك (1110/1120) مدين / ذمم أولياء الأمور (1210) دائن.
-- باقي منطق الدالة (الإرجاع، إشعار واتساب، سجل التدقيق) محفوظ دون أي تغيير.
CREATE OR REPLACE FUNCTION public.record_payment(p_fee_id uuid, p_amount numeric, p_method text DEFAULT 'bank'::text, p_paid_at date DEFAULT CURRENT_DATE)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_school   uuid;
  v_fee      record;
  v_student  record;
  v_entry_id uuid;
  v_debit_code text;
  v_debit_acc  uuid;
  v_credit_acc uuid;
  v_school_name text;
  v_guardian_phone text;
  v_guardian_name  text;
begin
  if public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح بتسجيل الدفعات';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'مبلغ الدفعة يجب أن يكون أكبر من صفر';
  end if;

  v_school := public.my_school_id();

  select * into v_fee from public.student_fees
    where id = p_fee_id and school_id = v_school
    for update;

  if not found then raise exception 'الفاتورة غير موجودة'; end if;
  if v_fee.paid + p_amount > v_fee.total + 0.0005 then
    raise exception 'المبلغ يتجاوز المتبقّي على الفاتورة';
  end if;

  select full_name, code, guardian_phone, guardian_name
    into v_student
    from public.students where id = v_fee.student_id;

  insert into public.payments(school_id, fee_id, amount, method, paid_at, recorded_by)
  values(v_school, p_fee_id, p_amount, coalesce(p_method,'bank'), coalesce(p_paid_at,current_date), auth.uid());

  update public.student_fees set paid = paid + p_amount where id = p_fee_id;

  v_debit_code := case when p_method in ('cash','onsite') then '1110' else '1120' end;
  select id into v_debit_acc  from public.accounts where school_id = v_school and code = v_debit_code;
  -- السداد الآن يُبرئ الذمم (1210)، لا يُسجَّل كإيراد مباشر (الإيراد سُجِّل أصلاً عند إصدار الفاتورة)
  select id into v_credit_acc from public.accounts where school_id = v_school and code = '1210';

  if v_debit_acc is not null and v_credit_acc is not null then
    insert into public.journal_entries(school_id, entry_date, description, reference, fee_id, created_by)
    values(
      v_school,
      coalesce(p_paid_at, current_date),
      'تحصيل رسوم الطالب ' || coalesce(v_student.full_name,'') ||
        ' (' || coalesce(v_student.code,'') || ') — ' ||
        case when p_method in ('cash','onsite') then 'نقداً' else 'تحويل بنكي' end,
      'INV-' || substr(p_fee_id::text, 1, 8),
      p_fee_id,
      auth.uid()
    )
    returning id into v_entry_id;

    insert into public.journal_lines(school_id, entry_id, account_id, debit, credit)
    values(v_school, v_entry_id, v_debit_acc, p_amount, 0);
    insert into public.journal_lines(school_id, entry_id, account_id, debit, credit)
    values(v_school, v_entry_id, v_credit_acc, 0, p_amount);
  end if;

  insert into public.audit_log(school_id, actor_id, action, details)
  values(v_school, auth.uid(), 'تسجيل دفعة رسوم', p_amount::text || ' (' || coalesce(p_method,'bank') || ')');

  select name into v_school_name from public.schools where id = v_school;

  select pr.phone into v_guardian_phone
    from public.profiles pr
    join public.parent_students ps on ps.parent_id = pr.id
    where ps.student_id = v_fee.student_id and pr.role = 'parent' and pr.phone is not null
    limit 1;

  if v_guardian_phone is null then
    v_guardian_phone := v_student.guardian_phone;
  end if;
  v_guardian_name := coalesce(v_student.guardian_name, 'ولي الأمر');

  return jsonb_build_object(
    'ok', true,
    'student_name', v_student.full_name,
    'guardian_name', v_guardian_name,
    'guardian_phone', v_guardian_phone,
    'amount', p_amount,
    'method', coalesce(p_method,'bank'),
    'school_name', v_school_name,
    'remaining', (v_fee.total - (v_fee.paid + p_amount))
  );
end $function$;