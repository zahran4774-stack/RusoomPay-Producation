-- ============================================================================
-- RusoomPay — ربط دفع الرسوم بالمحاسبة تلقائياً (قيد مزدوج)
-- عند تسجيل دفعة (كاش/بنك) يُنشأ قيد محاسبي تلقائي:
--   مدين: الصندوق (كاش) أو البنك — حسب طريقة الدفع
--   دائن: إيرادات الرسوم الدراسية
-- والقيد يحمل مرجع الفاتورة والطالب (ربط واضح للتدقيق).
-- ينفّذ بعد 01..28
-- ============================================================================

-- نضيف عمود fee_id للقيد لربطه بالفاتورة (اختياري، للتتبّع)
alter table public.journal_entries
  add column if not exists fee_id uuid references public.student_fees(id) on delete set null;

create or replace function public.record_payment(
  p_fee_id uuid,
  p_amount numeric,
  p_method text default 'bank',
  p_paid_at date default current_date
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_school   uuid;
  v_fee      record;
  v_student  record;
  v_entry_id uuid;
  v_debit_code text;
  v_debit_acc  uuid;
  v_credit_acc uuid;
begin
  if public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح بتسجيل الدفعات';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'مبلغ الدفعة يجب أن يكون أكبر من صفر';
  end if;

  v_school := public.my_school_id();
  select * into v_fee from public.student_fees where id = p_fee_id and school_id = v_school;
  if not found then raise exception 'الفاتورة غير موجودة'; end if;
  if v_fee.paid + p_amount > v_fee.total + 0.0005 then
    raise exception 'المبلغ يتجاوز المتبقّي على الفاتورة';
  end if;

  -- بيانات الطالب (لوصف القيد)
  select full_name, code into v_student from public.students where id = v_fee.student_id;

  -- 1) سجّل الدفعة (مربوطة بالفاتورة عبر fee_id)
  insert into public.payments(school_id, fee_id, amount, method, paid_at, recorded_by)
  values(v_school, p_fee_id, p_amount, coalesce(p_method,'bank'), coalesce(p_paid_at,current_date), auth.uid());

  -- 2) حدّث المبلغ المدفوع على الفاتورة
  update public.student_fees set paid = paid + p_amount where id = p_fee_id;

  -- 3) أنشئ القيد المحاسبي التلقائي (قيد مزدوج)
  --    الطرف المدين حسب طريقة الدفع:
  --      نقداً عند المدرسة (onsite/cash) → الصندوق (1110)
  --      غير ذلك (تحويل/بطاقة/محفظة)     → البنك (1120)
  v_debit_code := case when p_method in ('cash','onsite') then '1110' else '1120' end;
  select id into v_debit_acc  from public.accounts where school_id = v_school and code = v_debit_code;
  select id into v_credit_acc from public.accounts where school_id = v_school and code = '4100';

  -- إن وُجد الحسابان، أنشئ القيد (وإلّا نتجاوز القيد بأمان دون كسر الدفع)
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

    -- سطر مدين: الصندوق/البنك
    insert into public.journal_lines(school_id, entry_id, account_id, debit, credit)
    values(v_school, v_entry_id, v_debit_acc, p_amount, 0);
    -- سطر دائن: إيرادات الرسوم
    insert into public.journal_lines(school_id, entry_id, account_id, debit, credit)
    values(v_school, v_entry_id, v_credit_acc, 0, p_amount);
  end if;

  insert into public.audit_log(school_id, actor_id, action, details)
  values(v_school, auth.uid(), 'تسجيل دفعة رسوم', p_amount::text || ' (' || coalesce(p_method,'bank') || ')');
end; $$;

grant execute on function public.record_payment(uuid, numeric, text, date) to authenticated;
