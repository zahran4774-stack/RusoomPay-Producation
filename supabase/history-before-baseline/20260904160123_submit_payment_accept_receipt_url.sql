
CREATE OR REPLACE FUNCTION public.submit_payment(
  p_fee_id uuid, p_amount numeric, p_method text,
  p_bank_ref text DEFAULT NULL::text,
  p_receipt_url text DEFAULT NULL::text
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_school uuid; v_fee record; v_id uuid;
  v_my_school uuid;
  v_my_role text;
begin
  -- مدرسة ودور المستخدم الحالي
  select school_id, role into v_my_school, v_my_role from public.profiles where id = auth.uid();
  if v_my_school is null then
    raise exception 'لا مدرسة مرتبطة بحسابك';
  end if;

  -- الفاتورة — مقيّدة بمدرسة المستخدم (عزل المستأجر)
  select f.*, s.full_name as student_name, s.guardian_name
  into v_fee
  from public.student_fees f
  join public.students s on s.id = f.student_id
  where f.id = p_fee_id
    and f.school_id = v_my_school;

  if v_fee is null then
    raise exception 'الفاتورة غير موجودة في مدرستك';
  end if;

  -- ولي الأمر لا يدفع إلا فواتير أبنائه تحديداً
  -- (الموظفون/الإدارة يُستثنون من هذا الشرط لأن دورهم يشمل تسجيل أي دفعة بالمدرسة)
  if v_my_role = 'parent' then
    if not exists (
      select 1 from public.parent_students ps
      where ps.student_id = v_fee.student_id and ps.parent_id = auth.uid()
    ) then
      raise exception 'هذه الفاتورة لا تخص أحد أبنائك';
    end if;
  end if;

  v_school := v_fee.school_id;
  if coalesce(p_amount,0) <= 0 then raise exception 'مبلغ غير صحيح'; end if;
  if p_amount > (v_fee.total - v_fee.paid) + 0.0005 then raise exception 'المبلغ أكبر من المتبقي'; end if;
  if coalesce(p_method,'card') not in ('card','bank','applepay','googlepay','onsite') then
    raise exception 'طريقة دفع غير مدعومة';
  end if;
  -- تحويل بنكي: يلزم إمّا رقم مرجع أو إيصال مرفوع (الواجهة الحالية تعتمد رفع الإيصال فقط)
  if p_method = 'bank' and coalesce(trim(p_bank_ref),'') = '' and p_receipt_url is null then
    raise exception 'يلزم إرفاق إيصال التحويل';
  end if;

  insert into public.pending_payments(school_id, fee_id, guardian_id, amount, method, bank_ref, receipt_url)
  values (v_school, p_fee_id, auth.uid(), p_amount, p_method, p_bank_ref, p_receipt_url)
  returning id into v_id;

  return v_id;
end;
$function$;
