DROP FUNCTION IF EXISTS public.submit_payment(uuid, numeric, text, text);

CREATE FUNCTION public.submit_payment(p_fee_id uuid, p_amount numeric, p_method text, p_bank_ref text DEFAULT NULL::text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  v_school uuid; v_fee record; v_id uuid; v_guardian_name text; v_method_label text;
begin
  select f.*, s.full_name as student_name, s.guardian_name
  into v_fee
  from public.student_fees f
  join public.students s on s.id = f.student_id
  where f.id = p_fee_id;
  if v_fee is null then raise exception 'الفاتورة غير موجودة'; end if;

  -- التحقق من الملكية: المستخدم يجب أن يكون ولي أمر هذا الطالب فعلياً
  if not exists (
    select 1 from public.parent_students ps
    where ps.parent_id = auth.uid() and ps.student_id = v_fee.student_id
  ) then
    raise exception 'غير مصرّح: هذه الفاتورة لا تخص طالباً مرتبطاً بحسابك';
  end if;

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

  insert into public.notifications(school_id, audience, body)
  values (v_school, 'staff',
    '💳 دفعة جديدة بانتظار مراجعتك: ' || to_char(p_amount,'FM999990.000') ||
    ' من ' || coalesce(v_fee.guardian_name,'ولي أمر') || ' (' || v_method_label || ')');

  insert into public.notifications(school_id, audience, guardian_id, body)
  values (v_school, 'guardian', auth.uid(),
    '⏳ استلمنا دفعتك (' || to_char(p_amount,'FM999990.000') || ' — ' || v_method_label ||
    ') وهي قيد المراجعة من المحاسب.');

  return v_id;
end;
$function$;