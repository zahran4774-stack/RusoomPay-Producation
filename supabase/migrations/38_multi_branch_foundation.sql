-- 38_multi_branch_foundation.sql
-- Phase 0 completion (unify remaining context-bypassing functions onto
-- my_school_id()/my_role()) + multi-branch schema foundation
-- (organizations, school_memberships) + branch switching/creation RPCs.

-- ═══ Phase 0: remaining payroll + WPS + payment-state functions unified ═══

CREATE OR REPLACE FUNCTION public.generate_payroll_run(p_school_id uuid, p_year integer, p_month integer, p_value_date date DEFAULT NULL::date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_run_id uuid;
  v_emp_rate numeric(5,4);
  v_er_rate  numeric(5,4);
  v_cap      numeric(12,3);
  v_expat_exempt boolean;
begin
  if public.my_school_id() <> p_school_id or public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرح';
  end if;

  select coalesce(ins_emp_rate, 0.08),
         coalesce(ins_er_rate, 0.125),
         coalesce(ins_cap, 3000),
         coalesce(ins_expat_exempt, true)
    into v_emp_rate, v_er_rate, v_cap, v_expat_exempt
  from public.schools where id = p_school_id;

  insert into public.payroll_runs (
    school_id, period_year, period_month, value_date, created_by
  ) values (
    p_school_id, p_year, p_month,
    coalesce(p_value_date, make_date(p_year,p_month,1) + interval '1 month' - interval '1 day'),
    auth.uid()
  ) returning id into v_run_id;

  insert into public.payroll_items (
    run_id, employee_id, employee_name, id_type, id_number,
    bank_name, bank_account_no, working_days,
    basic_salary, extra_income, deductions,
    pasi_employee, pasi_employer
  )
  select
    v_run_id, e.id, e.full_name, e.id_type, e.id_number,
    e.bank_name, coalesce(e.bank_account_no, e.iban), 30,
    coalesce(e.basic_salary,0),
    coalesce(e.housing_allowance,0)+coalesce(e.transport_allowance,0)+coalesce(e.other_allowance,0),
    0,
    case when e.subject_to_pasi and not (upper(e.nationality) <> 'OM' and v_expat_exempt)
         then round(least(
                coalesce(e.basic_salary,0)
                + coalesce(e.housing_allowance,0)+coalesce(e.transport_allowance,0)+coalesce(e.other_allowance,0),
                v_cap) * v_emp_rate, 3)
         else 0 end,
    case when e.subject_to_pasi and not (upper(e.nationality) <> 'OM' and v_expat_exempt)
         then round(least(
                coalesce(e.basic_salary,0)
                + coalesce(e.housing_allowance,0)+coalesce(e.transport_allowance,0)+coalesce(e.other_allowance,0),
                v_cap) * v_er_rate, 3)
         else 0 end
  from public.employees e
  where e.school_id = p_school_id and e.deleted_at is null;

  update public.payroll_runs r
  set total_gross = t.gross, total_deduct = t.deduct,
      total_net = t.net, total_pasi_er = t.pasi_er
  from (
    select sum(basic_salary+extra_income) gross,
           sum(deductions+pasi_employee) deduct,
           sum(net_salary) net,
           sum(pasi_employer) pasi_er
    from public.payroll_items where run_id = v_run_id
  ) t where r.id = v_run_id;

  return v_run_id;
end $function$;

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

  if public.my_school_id() <> r.school_id or public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرح';
  end if;

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

  if public.my_school_id() <> r.school_id or public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرح';
  end if;

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

CREATE OR REPLACE FUNCTION public.cancel_payroll_run(p_run_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r public.payroll_runs%rowtype;
  v_entry uuid; v_new_entry uuid; v_count int := 0;
begin
  select * into r from public.payroll_runs where id = p_run_id;
  if not found then raise exception 'الدورة غير موجودة'; end if;
  if r.status = 'cancelled' then raise exception 'الدورة ملغاة أصلاً'; end if;

  if public.my_school_id() <> r.school_id or public.my_role() not in ('owner','accountant') then
    raise exception 'غير مصرّح: إلغاء الدورات للمدير أو المحاسب فقط';
  end if;

  for v_entry in
    select id from public.journal_entries
    where school_id = r.school_id
      and reference in ('PAYROLL-' || p_run_id, 'PAYROLL-PAY-' || p_run_id)
      and reversed_by_entry is null
    order by entry_date
  loop
    insert into public.journal_entries (
      school_id, entry_date, description, reference, created_by, reverses_entry
    )
    select r.school_id, current_date,
           'عكس: ' || je.description || coalesce(' — ' || nullif(trim(p_reason),''), ''),
           'REV-' || je.reference, auth.uid(), je.id
    from public.journal_entries je where je.id = v_entry
    returning id into v_new_entry;

    insert into public.journal_lines (school_id, entry_id, account_id, debit, credit)
    select r.school_id, v_new_entry, l.account_id, l.credit, l.debit
    from public.journal_lines l where l.entry_id = v_entry;

    perform set_config('rusoom.allow_journal_flag', 'on', true);
    update public.journal_entries
      set reversed_by_entry = v_new_entry where id = v_entry;
    perform set_config('rusoom.allow_journal_flag', 'off', true);

    v_count := v_count + 1;
  end loop;

  update public.payroll_runs set status = 'cancelled' where id = p_run_id;

  insert into public.audit_log (school_id, actor_id, action, details)
  values (r.school_id, auth.uid(), 'إلغاء دورة رواتب',
          r.period_month || '/' || r.period_year || ' — عُكس ' || v_count || ' قيد' ||
          coalesce(' — ' || nullif(trim(p_reason),''), ''));

  return p_run_id;
end $function$;

CREATE OR REPLACE FUNCTION public.export_wps_header(p_run_id uuid)
 RETURNS TABLE(employer_name text, employer_cr_no text, payer_cr_no text, email text, phone text, payment_type text, value_date date, payment_year integer, payment_month integer, salary_frequency text, debit_account_no text, no_of_records integer, total_amount numeric)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    s.name,
    ps.employer_cr_no,
    coalesce(ps.payer_cr_no, ps.employer_cr_no),
    ps.wps_email,
    ps.wps_phone,
    'Salary',
    r.value_date,
    r.period_year,
    r.period_month,
    'Monthly',
    ps.debit_account_no,
    (select count(*)::int from public.payroll_items where run_id = r.id),
    r.total_net
  from public.payroll_runs r
  join public.schools s on s.id = r.school_id
  left join public.payroll_settings ps on ps.school_id = r.school_id
  where r.id = p_run_id
    and r.school_id = public.my_school_id()
    and public.my_role() in ('owner','admin','accountant');
$function$;

CREATE OR REPLACE FUNCTION public.export_wps_rows(p_run_id uuid)
 RETURNS TABLE(seq_no integer, account_number text, employee_name text, bank_name text, id_type text, id_number text, working_days integer, basic_salary numeric, extra_income numeric, deductions numeric, social_security numeric, net_salary numeric)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    row_number() over (order by i.employee_name)::int,
    i.bank_account_no,
    i.employee_name,
    coalesce(i.bank_name, 'Bank Muscat'),
    case i.id_type when 'CIVIL' then 'Civil Number'
                   when 'PASSPORT' then 'Passport'
                   else 'Civil Number' end,
    i.id_number,
    i.working_days,
    i.basic_salary,
    i.extra_income,
    i.deductions,
    i.pasi_employee,
    i.net_salary
  from public.payroll_items i
  join public.payroll_runs r on r.id = i.run_id
  where i.run_id = p_run_id
    and r.school_id = public.my_school_id()
    and public.my_role() in ('owner','admin','accountant')
  order by i.employee_name;
$function$;

CREATE OR REPLACE FUNCTION public.transition_payment_state(p_payment_id uuid, p_to_state text, p_reason text DEFAULT NULL::text, p_provider_ref text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_school uuid; v_from text; v_allowed boolean;
begin
  select school_id, txn_state into v_school, v_from
    from public.pending_payments where id = p_payment_id;
  if v_school is null then raise exception 'الدفعة غير موجودة'; end if;

  if public.my_school_id() <> v_school or public.my_role() not in ('owner','admin','accountant') then
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

-- ═══ Multi-branch foundation: organizations + school_memberships ═══

CREATE TABLE public.organizations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY organizations_owner_read ON public.organizations
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.is_platform_admin());

ALTER TABLE public.schools ADD COLUMN organization_id uuid REFERENCES public.organizations(id);

CREATE INDEX idx_schools_organization ON public.schools USING btree (organization_id);

CREATE TABLE public.school_memberships (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  role public.user_role NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','invited','revoked')),
  invited_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE(user_id, school_id)
);

CREATE INDEX idx_school_memberships_user ON public.school_memberships USING btree (user_id) WHERE status = 'active';
CREATE INDEX idx_school_memberships_school ON public.school_memberships USING btree (school_id);

ALTER TABLE public.school_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY school_memberships_self_read ON public.school_memberships
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (school_id = public.my_school_id() AND public.my_role() IN ('owner','admin'))
    OR public.is_platform_admin()
  );

-- Backfill: every existing profile becomes an active membership on its current
-- school. Purely additive — my_school_id()/my_role() still read profiles
-- directly, so this cannot change any behavior by itself.
INSERT INTO public.school_memberships (user_id, school_id, role, status, created_at)
SELECT id, school_id, role, 'active', created_at
FROM public.profiles
WHERE school_id IS NOT NULL
ON CONFLICT (user_id, school_id) DO NOTHING;

-- ═══ Branch switching + creation RPCs ═══

CREATE OR REPLACE FUNCTION public.my_schools()
 RETURNS TABLE(school_id uuid, school_name text, branch text, role public.user_role, is_active_context boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT s.id, s.name, s.branch, m.role, (s.id = p.school_id)
  FROM public.school_memberships m
  JOIN public.schools s ON s.id = m.school_id
  JOIN public.profiles p ON p.id = auth.uid()
  WHERE m.user_id = auth.uid() AND m.status = 'active'
  ORDER BY s.name, s.branch;
$function$;

REVOKE ALL ON FUNCTION public.my_schools() FROM public;
GRANT EXECUTE ON FUNCTION public.my_schools() TO authenticated;

CREATE OR REPLACE FUNCTION public.switch_active_school(p_school_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_role public.user_role;
  v_school_name text;
begin
  select role into v_role
  from public.school_memberships
  where user_id = auth.uid() and school_id = p_school_id and status = 'active';

  if v_role is null then
    raise exception 'لا تملك عضوية فعّالة في هذه المدرسة';
  end if;

  update public.profiles
  set school_id = p_school_id, role = v_role
  where id = auth.uid();

  select name into v_school_name from public.schools where id = p_school_id;

  insert into public.audit_log(school_id, actor_id, action, details)
  values (p_school_id, auth.uid(), 'تبديل الفرع النشط', coalesce(v_school_name, ''));

  return jsonb_build_object('ok', true, 'school_id', p_school_id, 'school_name', v_school_name, 'role', v_role);
end;
$function$;

REVOKE ALL ON FUNCTION public.switch_active_school(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.switch_active_school(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.add_branch(p_name text, p_branch text, p_country text DEFAULT NULL::text, p_currency text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_current_school uuid;
  v_org_id uuid;
  v_new_school_id uuid;
  v_country text;
  v_currency text;
begin
  v_current_school := public.my_school_id();
  if public.my_role() <> 'owner' then
    raise exception 'غير مصرّح: إضافة فرع للمالك فقط';
  end if;

  select organization_id, country, currency
    into v_org_id, v_country, v_currency
    from public.schools where id = v_current_school;

  if v_org_id is null then
    insert into public.organizations(name, owner_id)
    values ((select name from public.schools where id = v_current_school), auth.uid())
    returning id into v_org_id;

    update public.schools set organization_id = v_org_id where id = v_current_school;
  end if;

  insert into public.schools(name, branch, country, currency, organization_id)
  values (p_name, p_branch, coalesce(p_country, v_country), coalesce(p_currency, v_currency), v_org_id)
  returning id into v_new_school_id;

  insert into public.school_memberships(user_id, school_id, role, status)
  values (auth.uid(), v_new_school_id, 'owner', 'active');

  insert into public.accounts(school_id, code, name, type)
  select v_new_school_id, code, name, type from public.accounts where school_id = v_current_school
  on conflict do nothing;

  insert into public.audit_log(school_id, actor_id, action, details)
  values (v_new_school_id, auth.uid(), 'إنشاء فرع جديد', p_name || coalesce(' - ' || p_branch, ''));

  return v_new_school_id;
end;
$function$;

REVOKE ALL ON FUNCTION public.add_branch(text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.add_branch(text, text, text, text) TO authenticated;
