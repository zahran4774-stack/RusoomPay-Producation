-- تعديل جوهري متسق مع أساس الاستحقاق: الاسترداد يُعيد إحياء الذمة (1210) بدل تقليل الإيراد (4100) مباشرة.
-- السبب: الإيراد اعتُرف به فعلياً وقت إصدار الفاتورة (عبر تريغر الاستحقاق) — الفاتورة كانت مستحقة فعلاً حينها.
-- الاسترداد يعني ببساطة أن الفاتورة صارت (جزئياً/كلياً) غير مسدَّدة من جديد، لا أن الإيراد التاريخي كان خطأً.
-- باقي المنطق (الصلاحيات، السبب الإلزامي، سجل التدقيق) محفوظ دون أي تغيير.
CREATE OR REPLACE FUNCTION public.refund_payment(p_fee_id uuid, p_amount numeric, p_reason text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_school     uuid;
  v_fee        record;
  v_refundable numeric;
  v_entry_id   uuid;
  v_receivable_acc uuid;
  v_bank_acc   uuid;
begin
  if public.my_role() not in ('owner','accountant') then
    raise exception 'غير مصرّح: الاسترداد لمدير المدرسة أو المحاسب فقط';
  end if;
  if coalesce(trim(p_reason),'') = '' then
    raise exception 'يجب ذكر سبب الاسترداد (للتدقيق)';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'مبلغ الاسترداد يجب أن يكون أكبر من صفر';
  end if;

  v_school := public.my_school_id();

  select * into v_fee from public.student_fees
    where id = p_fee_id and school_id = v_school
    for update;
  if not found then raise exception 'الفاتورة غير موجودة'; end if;

  v_refundable := coalesce(v_fee.paid, 0);
  if v_refundable <= 0 then
    raise exception 'لا يوجد مبلغ مدفوع قابل للاسترداد على هذه الفاتورة';
  end if;
  if p_amount > v_refundable + 0.0005 then
    raise exception 'مبلغ الاسترداد (%) يتجاوز المدفوع القابل للاسترداد (%)',
      p_amount, v_refundable;
  end if;

  -- الذمم (1210) بدل الإيراد (4100) — يعيد إحياء استحقاق الفاتورة بدل تزوير الإيراد التاريخي
  select id into v_receivable_acc from public.accounts where school_id = v_school and code = '1210';
  select id into v_bank_acc       from public.accounts where school_id = v_school and code = '1120';
  if v_receivable_acc is null or v_bank_acc is null then
    raise exception 'حسابات الذمم/البنك غير مهيّأة';
  end if;

  insert into public.journal_entries(school_id, entry_date, description, reference, fee_id, created_by)
  values(
    v_school, current_date,
    'استرداد رسوم — السبب: ' || p_reason,
    'REFUND-' || substr(p_fee_id::text, 1, 8),
    p_fee_id, auth.uid()
  )
  returning id into v_entry_id;

  insert into public.journal_lines(school_id, entry_id, account_id, debit, credit)
  values (v_school, v_entry_id, v_receivable_acc, p_amount, 0),
         (v_school, v_entry_id, v_bank_acc,       0, p_amount);

  update public.student_fees
  set paid = greatest(0, paid - p_amount)
  where id = p_fee_id and school_id = v_school;

  insert into public.audit_log(school_id, actor_id, action, details)
  values(v_school, auth.uid(), 'استرداد رسوم',
    'الفاتورة ' || p_fee_id::text || ' — المبلغ: ' || p_amount::text ||
    ' — السبب: ' || p_reason);

  return v_entry_id;
end $function$;