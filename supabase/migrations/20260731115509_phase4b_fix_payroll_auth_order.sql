-- Phase 4B: تصحيح ترتيب الفحص في pay_payroll_run — التفويض (عزل المدرسة) يُفحص أولاً
-- قبل فحص حالة الدورة، بدلاً من العكس. لا تغيير في المنطق نفسه أو النتيجة النهائية —
-- فقط يمنع تسريب معلومة حالة (draft/approved) لمستخدم لا ينتمي أصلاً لهذي المدرسة.
CREATE OR REPLACE FUNCTION public.pay_payroll_run(p_run_id uuid, p_payment_date date DEFAULT NULL::date, p_bank_code text DEFAULT '1120'::text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  r          public.payroll_runs%rowtype;
  v_entry_id uuid;
  a_bank uuid; a_salary_pay uuid; a_pasi_pay uuid;
  v_pasi_total numeric(14,3);
begin
  select * into r from public.payroll_runs where id = p_run_id;
  if not found then raise exception 'الدورة غير موجودة'; end if;

  -- التفويض أولاً: هل المستخدم عضو فعلي في مدرسة هذي الدورة؟
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and school_id = r.school_id
      and role in ('owner','admin','accountant')
  ) then raise exception 'غير مصرح'; end if;

  -- بعد تأكيد التفويض فقط، نفحص حالة العمل
  if r.status <> 'approved' then
    raise exception 'يجب اعتماد الدورة قبل الصرف';
  end if;

  select coalesce(sum(pasi_employee),0) + r.total_pasi_er
    into v_pasi_total
  from public.payroll_items where run_id = p_run_id;

  select id into a_bank from public.accounts
   where school_id=r.school_id and code=p_bank_code;
  select id into a_salary_pay from public.accounts
   where school_id=r.school_id and code='2320';
  select id into a_pasi_pay from public.accounts
   where school_id=r.school_id and code='2330';

  if a_bank is null or a_salary_pay is null or a_pasi_pay is null then
    raise exception 'حسابات الصرف غير مكتملة';
  end if;

  insert into public.journal_entries (
    school_id, entry_date, description, reference, created_by
  ) values (
    r.school_id,
    coalesce(p_payment_date, current_date),
    'صرف رواتب ' || r.period_month || '/' || r.period_year,
    'PAYROLL-PAY-' || p_run_id,
    auth.uid()
  ) returning id into v_entry_id;

  insert into public.journal_lines (school_id, entry_id, account_id, debit, credit)
  values
    (r.school_id, v_entry_id, a_salary_pay, r.total_net, 0),
    (r.school_id, v_entry_id, a_pasi_pay,   v_pasi_total, 0),
    (r.school_id, v_entry_id, a_bank, 0, r.total_net + v_pasi_total);

  update public.payroll_runs
  set status = 'paid',
      payment_journal_entry_id = v_entry_id
  where id = p_run_id;

  return v_entry_id;
end $function$;