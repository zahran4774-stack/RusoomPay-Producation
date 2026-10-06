-- نفس التصحيح: approve_payroll_run — التفويض يُفحص قبل حالة الدورة، للاتساق مع pay_payroll_run
CREATE OR REPLACE FUNCTION public.approve_payroll_run(p_run_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  r            public.payroll_runs%rowtype;
  v_entry_id   uuid;
  a_salary_exp uuid; a_ins_exp uuid;
  a_salary_pay uuid; a_pasi_pay uuid;
  v_pasi_emp   numeric(14,3);
begin
  select * into r from public.payroll_runs where id = p_run_id;
  if not found then raise exception 'الدورة غير موجودة'; end if;

  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and school_id = r.school_id
      and role in ('owner','admin','accountant')
  ) then raise exception 'غير مصرح'; end if;

  if r.status <> 'draft' then raise exception 'الدورة ليست مسودة'; end if;

  select coalesce(sum(pasi_employee),0) into v_pasi_emp
  from public.payroll_items where run_id = p_run_id;

  select id into a_salary_exp from public.accounts
   where school_id=r.school_id and code='5110';
  select id into a_ins_exp    from public.accounts
   where school_id=r.school_id and code='5120';
  select id into a_salary_pay from public.accounts
   where school_id=r.school_id and code='2320';
  select id into a_pasi_pay   from public.accounts
   where school_id=r.school_id and code='2330';

  if a_salary_exp is null or a_ins_exp is null
     or a_salary_pay is null or a_pasi_pay is null then
    raise exception 'حسابات الرواتب غير مكتملة في شجرة الحسابات';
  end if;

  insert into public.journal_entries (
    school_id, entry_date, description, reference, created_by
  ) values (
    r.school_id,
    coalesce(r.value_date, current_date),
    'قيد رواتب ' || r.period_month || '/' || r.period_year,
    'PAYROLL-' || p_run_id,
    auth.uid()
  ) returning id into v_entry_id;

  insert into public.journal_lines (school_id, entry_id, account_id, debit, credit)
  values
    (r.school_id, v_entry_id, a_salary_exp, r.total_gross, 0),
    (r.school_id, v_entry_id, a_ins_exp,    r.total_pasi_er, 0),
    (r.school_id, v_entry_id, a_salary_pay, 0, r.total_net),
    (r.school_id, v_entry_id, a_pasi_pay,   0, v_pasi_emp + r.total_pasi_er);

  update public.payroll_runs
  set status='approved', approved_at=now(), journal_entry_id=v_entry_id
  where id = p_run_id;

  return v_entry_id;
end $function$;