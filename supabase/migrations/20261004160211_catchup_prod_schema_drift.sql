-- ============================================================================
-- Catch-up migration: bring a database rebuilt from this folder in line with
-- PRODUCTION (project hmskpglpltaeiznvxvcb).
--
-- Why this exists: production contains objects that were created outside the
-- recorded migration history (tables, columns, ~50 function bodies, policies,
-- triggers, storage buckets, function EXECUTE grants). The baselines
-- 00000000000001..06 plus the recorded incrementals therefore rebuild a schema
-- that differs from production. This file was generated from the production
-- catalog (read-only) and is IDEMPOTENT: every statement is IF NOT EXISTS /
-- CREATE OR REPLACE / DROP ... IF EXISTS + CREATE, so applying it to production
-- changes nothing. It carries a version AFTER the last recorded migration so the
-- recorded incrementals run first; on production, mark it applied with
--   supabase migration repair --status applied 20261004160211
-- instead of re-running it.
--
-- Verified by comparing a per-object-kind fingerprint (supabase/tests/
-- schema_objects.sql) between a clean CI rebuild and production.
-- ============================================================================

SET check_function_bodies = off;

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;

-- ---------------------------------------------------------------------------
-- Tables that exist in production but not in the recorded history
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organizations (
  id         uuid        NOT NULL DEFAULT gen_random_uuid(),
  name       text        NOT NULL,
  owner_id   uuid        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organizations_pkey PRIMARY KEY (id),
  CONSTRAINT organizations_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE
);
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS organization_id uuid;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS bundle_transport_meals boolean NOT NULL DEFAULT false;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS custom_section_names text[] NOT NULL DEFAULT '{}'::text[];
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'schools_organization_id_fkey' AND conrelid = 'public.schools'::regclass) THEN
    ALTER TABLE public.schools
      ADD CONSTRAINT schools_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_schools_organization ON public.schools USING btree (organization_id);

CREATE TABLE IF NOT EXISTS public.financial_years (
  id         uuid        NOT NULL DEFAULT gen_random_uuid(),
  school_id  uuid        NOT NULL,
  name       text        NOT NULL,
  start_date date        NOT NULL,
  end_date   date        NOT NULL,
  status     text        NOT NULL DEFAULT 'OPEN'::text,
  closed_at  timestamptz,
  closed_by  uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT financial_years_pkey PRIMARY KEY (id),
  CONSTRAINT financial_years_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE,
  CONSTRAINT financial_years_closed_by_fkey FOREIGN KEY (closed_by) REFERENCES auth.users(id),
  CONSTRAINT financial_years_check CHECK (end_date >= start_date),
  CONSTRAINT financial_years_status_check CHECK (status = ANY (ARRAY['OPEN'::text, 'CLOSED'::text])),
  CONSTRAINT no_overlapping_financial_years EXCLUDE USING gist (school_id WITH =, daterange(start_date, end_date, '[]'::text) WITH &&)
);
CREATE INDEX IF NOT EXISTS idx_financial_years_school ON public.financial_years USING btree (school_id);
ALTER TABLE public.financial_years ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.school_invoice_counters (
  school_id   uuid    NOT NULL,
  last_number integer NOT NULL DEFAULT 0,
  CONSTRAINT school_invoice_counters_pkey PRIMARY KEY (school_id),
  CONSTRAINT school_invoice_counters_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id)
);
ALTER TABLE public.school_invoice_counters ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.school_memberships (
  id         uuid        NOT NULL DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL,
  school_id  uuid        NOT NULL,
  role       public.user_role NOT NULL,
  status     text        NOT NULL DEFAULT 'active'::text,
  invited_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  CONSTRAINT school_memberships_pkey PRIMARY KEY (id),
  CONSTRAINT school_memberships_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT school_memberships_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE,
  CONSTRAINT school_memberships_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES auth.users(id),
  CONSTRAINT school_memberships_status_check CHECK (status = ANY (ARRAY['active'::text, 'invited'::text, 'revoked'::text])),
  CONSTRAINT school_memberships_user_id_school_id_key UNIQUE (user_id, school_id)
);
CREATE INDEX IF NOT EXISTS idx_school_memberships_school ON public.school_memberships USING btree (school_id);
CREATE INDEX IF NOT EXISTS idx_school_memberships_user ON public.school_memberships USING btree (user_id) WHERE (status = 'active'::text);
ALTER TABLE public.school_memberships ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.user_permissions (
  id         uuid        NOT NULL DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL,
  school_id  uuid        NOT NULL,
  permission text        NOT NULL,
  granted_by uuid,
  granted_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_permissions_pkey PRIMARY KEY (id),
  CONSTRAINT user_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT user_permissions_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id),
  CONSTRAINT user_permissions_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES public.profiles(id),
  CONSTRAINT user_permissions_user_id_permission_key UNIQUE (user_id, permission)
);
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Columns that exist in production but not in the recorded history
-- ---------------------------------------------------------------------------
ALTER TABLE public.meal_purchases ADD COLUMN IF NOT EXISTS item_type text;
ALTER TABLE public.meal_purchases ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'::text;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS invoice_number text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS is_exempt boolean NOT NULL DEFAULT false;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS registration_fee_recurrence text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS special_case_reason text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS transport_type text DEFAULT 'none'::text;

-- ---------------------------------------------------------------------------
-- Function bodies (production definitions) — CREATE OR REPLACE
-- ---------------------------------------------------------------------------
-- CREATE OR REPLACE cannot change a function's return type. Drop the (few) functions whose
-- recorded return type differs from production so the definitions below can be created.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN (VALUES
    ('add_branch', $r$uuid$r$),
    ('approve_payment', $r$jsonb$r$),
    ('approve_payroll_run', $r$uuid$r$),
    ('balance_sheet_asof', $r$TABLE(section text, code text, name text, balance numeric)$r$),
    ('cafeteria_subscribers', $r$TABLE(student_id uuid, student_name text, guardian text, plan_id uuid, plan_name text, fee numeric)$r$),
    ('cancel_meal_purchase', $r$void$r$),
    ('cancel_payroll_run', $r$uuid$r$),
    ('cancel_pending_payment', $r$jsonb$r$),
    ('check_financial_year_open', $r$trigger$r$),
    ('check_journal_balanced', $r$trigger$r$),
    ('close_financial_year', $r$jsonb$r$),
    ('control_center_subscriptions', $r$TABLE(school_id uuid, school_name text, country text, plan text, status text, period_start timestamp with time zone, period_end timestamp with time zone, amount numeric)$r$),
    ('control_center_summary', $r$jsonb$r$),
    ('create_financial_year', $r$uuid$r$),
    ('create_manual_journal_entry', $r$uuid$r$),
    ('delete_payment_within_window', $r$jsonb$r$),
    ('edit_payment_within_window', $r$jsonb$r$),
    ('export_wps_header', $r$TABLE(employer_name text, employer_cr_no text, payer_cr_no text, email text, phone text, payment_type text, value_date date, payment_year integer, payment_month integer, salary_frequency text, debit_account_no text, no_of_records integer, total_amount numeric)$r$),
    ('export_wps_rows', $r$TABLE(seq_no integer, account_number text, employee_name text, bank_name text, id_type text, id_number text, working_days integer, basic_salary numeric, extra_income numeric, deductions numeric, social_security numeric, net_salary numeric)$r$),
    ('find_payment_by_invoice_number', $r$jsonb$r$),
    ('food_purchase', $r$jsonb$r$),
    ('generate_payroll_run', $r$uuid$r$),
    ('grant_employee_access', $r$jsonb$r$),
    ('has_permission', $r$boolean$r$),
    ('import_students', $r$jsonb$r$),
    ('income_statement_period', $r$TABLE(section text, code text, name text, amount numeric)$r$),
    ('latest_editable_payment', $r$jsonb$r$),
    ('mark_meal_purchase_paid', $r$uuid$r$),
    ('meal_purchases_list', $r$TABLE(id uuid, supplier_id uuid, supplier_name text, purchase_date date, purchase_type text, meals_count integer, unit_cost numeric, total_cost numeric, period text, paid boolean, notes text, item_type text, status text)$r$),
    ('my_financial_years', $r$SETOF financial_years$r$),
    ('my_permissions', $r$text[]$r$),
    ('my_schools', $r$TABLE(school_id uuid, school_name text, branch text, role user_role, is_active_context boolean)$r$),
    ('my_subscription_status', $r$jsonb$r$),
    ('next_expense_code', $r$text$r$),
    ('next_invoice_number', $r$text$r$),
    ('org_overview', $r$TABLE(school_id uuid, school_name text, branch text, students integer, employees integer, fees_total numeric, fees_paid numeric, collection_rate numeric, revenue numeric, expense numeric, profit numeric)$r$),
    ('pay_payroll_run', $r$uuid$r$),
    ('record_payment', $r$jsonb$r$),
    ('refund_payment', $r$uuid$r$),
    ('reject_payment', $r$void$r$),
    ('reopen_financial_year', $r$jsonb$r$),
    ('reverse_journal_entry', $r$uuid$r$),
    ('risk_scores', $r$jsonb$r$),
    ('school_copilot', $r$jsonb$r$),
    ('school_pricing_complete', $r$boolean$r$),
    ('set_bundle_setting', $r$void$r$),
    ('set_custom_section_names', $r$void$r$),
    ('set_section_styles', $r$void$r$),
    ('set_user_permission', $r$void$r$),
    ('staff_permissions_list', $r$jsonb$r$),
    ('student_payment_tracker', $r$TABLE(month_label text, month_key text, paid_amount numeric, has_payment boolean)$r$),
    ('switch_active_school', $r$jsonb$r$),
    ('test_dummy_function', $r$text$r$),
    ('transition_payment_state', $r$void$r$),
    ('update_meal_plan', $r$void$r$)
    ) AS want(proname, result) ON want.proname = p.proname
    WHERE n.nspname = 'public' AND pg_get_function_result(p.oid) IS DISTINCT FROM want.result
  LOOP
    EXECUTE format('DROP FUNCTION %s', r.sig);
  END LOOP;
END $$;

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
$function$
;

CREATE OR REPLACE FUNCTION public.approve_payment(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_sch uuid;
  v_pp record;
  v_result jsonb;
begin
  v_sch := public.my_school_id();
  if public.my_role() <> 'accountant' and not public.has_permission('approvals') then
    raise exception 'غير مصرّح بالاعتماد — يحتاج صلاحية «الاعتمادات» من مالك المدرسة';
  end if;
  select * into v_pp from public.pending_payments where id = p_id and school_id = v_sch;
  if v_pp is null then raise exception 'الدفعة غير موجودة'; end if;
  if v_pp.status <> 'pending' then raise exception 'الدفعة سبق البتّ فيها'; end if;

  v_result := public.record_payment(v_pp.fee_id, v_pp.amount, v_pp.method, current_date, true);

  update public.pending_payments
  set status = 'approved', resolved_at = now(), resolved_by = auth.uid()
  where id = p_id;

  insert into public.notifications(school_id, audience, guardian_id, body)
  values (v_sch, 'guardian', v_pp.guardian_id,
    '✅ تم اعتماد دفعتك (' || to_char(v_pp.amount,'FM999990.000') || ') بعد مراجعة المحاسب. شكراً لك.');

  return v_result;
end;
$function$
;

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
end $function$
;

CREATE OR REPLACE FUNCTION public.balance_sheet_asof(p_asof date)
 RETURNS TABLE(section text, code text, name text, balance numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with period_lines as (
    select l.account_id, l.debit, l.credit
    from public.journal_lines l
    join public.journal_entries e on e.id = l.entry_id
    where e.school_id = public.my_school_id()
      and e.entry_date <= p_asof
  ),
  bs as (
    select a.id, a.type, a.code, a.name,
      case when a.type = 'asset'
        then coalesce(round(sum(pl.debit - pl.credit), 3), 0)
        else coalesce(round(sum(pl.credit - pl.debit), 3), 0)
      end as balance
    from public.accounts a
    left join period_lines pl on pl.account_id = a.id
    where a.school_id = public.my_school_id()
      and a.type in ('asset', 'liability', 'equity')
    group by a.id, a.code, a.name, a.type
  ),
  net_income as (
    select coalesce(round(sum(
      case when a.type = 'revenue' then pl.credit - pl.debit
           when a.type = 'expense' then -(pl.debit - pl.credit)
           else 0 end
    ), 3), 0) as amount
    from public.accounts a
    join period_lines pl on pl.account_id = a.id
    where a.school_id = public.my_school_id()
      and a.type in ('revenue', 'expense')
  )
  select type as section, code, name, balance from bs where balance <> 0
  union all
  select 'equity', 'NET-INC', 'أرباح العام الحالي (غير مُقفلة بعد)', amount
  from net_income where amount <> 0
  order by section, code;
$function$
;

CREATE OR REPLACE FUNCTION public.cafeteria_subscribers()
 RETURNS TABLE(student_id uuid, student_name text, guardian text, plan_id uuid, plan_name text, fee numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح';
  end if;
  return query
  select s.id, s.full_name, s.guardian_name, mp.id, mp.name, mp.fee
  from public.meal_subscriptions ms
  join public.students s on s.id = ms.student_id
  join public.meal_plans mp on mp.id = ms.plan_id
  where ms.school_id = public.my_school_id()
  order by s.full_name;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.cancel_meal_purchase(p_id uuid, p_payment_source text DEFAULT 'bank'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_sch uuid; v_role user_role; v_old record; v_rev_entry uuid; v_supname text;
begin
  v_sch := public.my_school_id();
  v_role := public.my_role();
  if v_sch is null then raise exception 'لا مدرسة مرتبطة بحسابك'; end if;
  if v_role not in ('owner','admin','accountant') then raise exception 'غير مصرّح'; end if;

  select * into v_old from public.meal_purchases where id = p_id and school_id = v_sch;
  if v_old is null then raise exception 'الشراء غير موجود في مدرستك'; end if;
  if v_old.status = 'cancelled' then raise exception 'هذا الشراء ملغى بالفعل'; end if;

  select name into v_supname from public.suppliers where id = v_old.supplier_id;

  if v_old.journal_entry_id is not null and v_old.total_cost > 0 then
    insert into public.journal_entries (school_id, entry_date, description, reference, created_by, reverses_entry)
    values (v_sch, current_date, 'إلغاء شراء وجبات — ' || coalesce(v_supname,'—'),
            'MCXL-' || left(p_id::text,8), auth.uid(), v_old.journal_entry_id)
    returning id into v_rev_entry;

    insert into public.journal_lines (school_id, entry_id, account_id, debit, credit)
    select school_id, v_rev_entry, account_id, credit, debit
    from public.journal_lines where entry_id = v_old.journal_entry_id;

    -- ⚠️ الإصلاح: يجب ضبط هذا العلم صراحة قبل أي UPDATE على journal_entries،
    -- وإلا يرفضه trigger الحماية block_journal_mutation تلقائياً — نفس الآلية
    -- المستخدمة في reverse_journal_entry الموجودة مسبقاً.
    perform set_config('rusoom.allow_journal_flag', 'on', true);
    update public.journal_entries set reversed_by_entry = v_rev_entry where id = v_old.journal_entry_id;
  end if;

  update public.meal_purchases set
    status = 'cancelled', meals_count = 0, total_cost = 0, updated_at = now()
  where id = p_id;

  insert into public.audit_log (school_id, actor_id, action, details)
  values (v_sch, auth.uid(), 'إلغاء شراء وجبات', coalesce(v_supname,'—') || ' — ' || v_old.total_cost::text);
end;
$function$
;

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

  if public.my_school_id() <> r.school_id or public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح: إلغاء الدورات للمدير أو الإداري أو المحاسب فقط';
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
end $function$
;

CREATE OR REPLACE FUNCTION public.cancel_pending_payment(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_row public.pending_payments%rowtype;
begin
  update public.pending_payments
  set status = 'rejected', state_updated_at = now()
  where id = p_id and guardian_id = auth.uid() and status = 'pending'
  returning * into v_row;

  if not found then
    raise exception 'الدفعة غير موجودة، أو ليست بانتظار المراجعة، أو ليست لك';
  end if;

  insert into public.payment_state_log(payment_id, school_id, from_state, to_state, reason, actor_id)
  values (p_id, v_row.school_id, 'pending', 'rejected', 'ألغاها ولي الأمر', auth.uid());

  return jsonb_build_object('ok', true, 'id', p_id, 'status', 'rejected');
end;
$function$
;

CREATE OR REPLACE FUNCTION public.check_financial_year_open()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_status text;
begin
  select status into v_status
  from public.financial_years
  where school_id = new.school_id
    and new.entry_date between start_date and end_date
  limit 1;

  if v_status = 'CLOSED' then
    raise exception 'لا يمكن ترحيل قيد بتاريخ % — السنة المالية لهذه الفترة مُقفلة', new.entry_date;
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.check_journal_balanced()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare d numeric; c numeric;
begin
  if current_setting('rusoom.allow_journal_flag', true) = 'on' then
    return new;
  end if;
  select coalesce(sum(debit),0), coalesce(sum(credit),0)
    into d, c from public.journal_lines where entry_id = new.entry_id;
  if abs(d - c) > 0.0005 then
    raise exception 'قيد غير متوازن: مدين % دائن %', d, c;
  end if;
  return new;
end; $function$
;

CREATE OR REPLACE FUNCTION public.close_financial_year(p_fy_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_school uuid;
  v_fy public.financial_years%rowtype;
  v_entry_id uuid;
  v_re_account uuid;
  v_revenue_total numeric(14,3) := 0;
  v_expense_total numeric(14,3) := 0;
  v_net numeric(14,3);
  v_line record;
  v_check_debit numeric;
  v_check_credit numeric;
begin
  v_school := public.my_school_id();
  if public.my_role() <> 'owner' then
    raise exception 'غير مصرّح: إقفال السنة المالية للمالك فقط';
  end if;

  -- قفل الصفّ (FOR UPDATE) يمنع إقفالاً مزدوجاً متزامناً؛ الحالة تُفحص هنا،
  -- والتحديث الفعلي لـ status يبقى آخر خطوة (بعد إدراج قيد الإقفال) حتى لا
  -- يحجب trigger القفل قيدَ الإقفال نفسه (السنة لا تزال OPEN وقت إدراجه).
  select * into v_fy from public.financial_years
    where id = p_fy_id and school_id = v_school
    for update;

  if not found then
    raise exception 'السنة المالية غير موجودة في مدرستك';
  end if;
  if v_fy.status <> 'OPEN' then
    raise exception 'السنة المالية مُقفلة بالفعل — لا يمكن إقفالها مرّتين';
  end if;

  select coalesce(sum(l.debit),0), coalesce(sum(l.credit),0)
    into v_check_debit, v_check_credit
    from public.journal_lines l
    join public.journal_entries e on e.id = l.entry_id
    where e.school_id = v_school and e.entry_date >= v_fy.start_date and e.entry_date <= v_fy.end_date;

  if abs(v_check_debit - v_check_credit) > 0.0005 then
    raise exception 'تعذّر الإقفال: دفتر اليومية غير متوازن لهذه الفترة (مدين % ≠ دائن %)', v_check_debit, v_check_credit;
  end if;

  select id into v_re_account from public.accounts where school_id = v_school and code = '3200';
  if v_re_account is null then
    insert into public.accounts(school_id, code, name, type)
    values (v_school, '3200', 'الأرباح المحتجزة', 'equity')
    returning id into v_re_account;
  end if;

  insert into public.journal_entries(school_id, entry_date, description, reference, created_by)
  values (v_school, v_fy.end_date, 'قيد إقفال السنة المالية: ' || v_fy.name, 'YEAR-CLOSE-' || p_fy_id, auth.uid())
  returning id into v_entry_id;

  for v_line in
    select a.id as account_id, coalesce(round(sum(l.credit - l.debit), 3), 0) as amt
    from public.accounts a
    join public.journal_lines l on l.account_id = a.id
    join public.journal_entries e on e.id = l.entry_id
    where a.school_id = v_school and a.type = 'revenue'
      and e.entry_date >= v_fy.start_date and e.entry_date <= v_fy.end_date
    group by a.id
    having coalesce(round(sum(l.credit - l.debit), 3), 0) <> 0
  loop
    insert into public.journal_lines(school_id, entry_id, account_id, debit, credit)
    values (v_school, v_entry_id, v_line.account_id, v_line.amt, 0);
    v_revenue_total := v_revenue_total + v_line.amt;
  end loop;

  for v_line in
    select a.id as account_id, coalesce(round(sum(l.debit - l.credit), 3), 0) as amt
    from public.accounts a
    join public.journal_lines l on l.account_id = a.id
    join public.journal_entries e on e.id = l.entry_id
    where a.school_id = v_school and a.type = 'expense'
      and e.entry_date >= v_fy.start_date and e.entry_date <= v_fy.end_date
    group by a.id
    having coalesce(round(sum(l.debit - l.credit), 3), 0) <> 0
  loop
    insert into public.journal_lines(school_id, entry_id, account_id, debit, credit)
    values (v_school, v_entry_id, v_line.account_id, 0, v_line.amt);
    v_expense_total := v_expense_total + v_line.amt;
  end loop;

  v_net := v_revenue_total - v_expense_total;

  if v_net <> 0 then
    if v_net > 0 then
      insert into public.journal_lines(school_id, entry_id, account_id, debit, credit)
      values (v_school, v_entry_id, v_re_account, 0, v_net);
    else
      insert into public.journal_lines(school_id, entry_id, account_id, debit, credit)
      values (v_school, v_entry_id, v_re_account, -v_net, 0);
    end if;
  end if;

  update public.financial_years
  set status = 'CLOSED', closed_at = now(), closed_by = auth.uid()
  where id = p_fy_id;

  insert into public.audit_log(school_id, actor_id, action, details)
  values (v_school, auth.uid(), 'إقفال سنة مالية',
    v_fy.name || ' — الإيرادات: ' || v_revenue_total || ' — المصروفات: ' || v_expense_total || ' — الصافي: ' || v_net);

  return jsonb_build_object(
    'ok', true, 'financial_year_id', p_fy_id, 'closing_entry_id', v_entry_id,
    'revenue', v_revenue_total, 'expense', v_expense_total, 'net_profit', v_net,
    'retained_earnings_account_id', v_re_account
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.control_center_subscriptions()
 RETURNS TABLE(school_id uuid, school_name text, country text, plan text, status text, period_start timestamp with time zone, period_end timestamp with time zone, amount numeric)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select distinct on (s.id)
    s.id,
    s.name,
    s.country,
    sub.plan::text,
    sub.status::text,
    sub.created_at,
    sub.renews_at,
    coalesce(p.price_omr, 0) as amount
  from public.schools s
  left join public.subscriptions sub on sub.school_id = s.id
  left join public.plans p on p.code = sub.plan::text
  where public.is_platform_admin()
  order by s.id, sub.created_at desc nulls last;
$function$
;

CREATE OR REPLACE FUNCTION public.control_center_summary()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_result jsonb;
  v_schools int; v_active int; v_trial int; v_suspended int; v_expired int;
  v_students int; v_parents int; v_employees int; v_users int;
  v_mrr numeric; v_annual numeric; v_pending int; v_renewals int;
  v_test_schools int;
begin
  if not public.is_platform_admin() then
    raise exception 'غير مصرّح: مركز التحكّم لمدير المنصة فقط';
  end if;

  select count(*) into v_schools from public.schools where not is_test;
  select count(*) into v_test_schools from public.schools where is_test;

  select count(*) into v_active from public.subscriptions sub
    join public.schools s on s.id = sub.school_id and not s.is_test
    where sub.status = 'active';
  select count(*) into v_trial from public.subscriptions sub
    join public.schools s on s.id = sub.school_id and not s.is_test
    where sub.status = 'trial';
  select count(*) into v_suspended from public.schools where coalesce(active, true) = false and not is_test;
  select count(*) into v_expired from public.subscriptions sub
    join public.schools s on s.id = sub.school_id and not s.is_test
    where sub.status = 'active' and sub.renews_at is not null and sub.renews_at < now();

  select count(*) into v_students from public.students st
    join public.schools s on s.id = st.school_id and not s.is_test
    where st.status = 'active' and st.deleted_at is null;
  select count(*) into v_parents from public.profiles p
    join public.schools s on s.id = p.school_id and not s.is_test
    where p.role = 'parent';
  select count(*) into v_employees from public.employees e
    join public.schools s on s.id = e.school_id and not s.is_test
    where e.deleted_at is null;
  select count(*) into v_users from public.profiles p
    left join public.schools s on s.id = p.school_id
    where s.id is null or not s.is_test;

  -- ⚠️ الإصلاح الجذري: الإيراد السنوي والشهري (MRR) يُحسبان الآن من
  -- plans.price_omr مباشرة (مصدر الحقيقة الوحيد)، بدل case مُخمَّنة يدوياً
  -- لا تعرف الباقات الحالية (starter/small/basic/advanced/enterprise).
  select coalesce(sum(p.price_omr), 0) into v_annual
    from public.subscriptions sub
    join public.schools s on s.id = sub.school_id and not s.is_test
    left join public.plans p on p.code = sub.plan::text
    where sub.status = 'active';

  v_mrr := round(v_annual / 12.0, 3);

  select count(*) into v_pending from public.subscriptions sub
    join public.schools s on s.id = sub.school_id and not s.is_test
    where sub.status = 'pending';
  select count(*) into v_renewals from public.subscriptions sub
    join public.schools s on s.id = sub.school_id and not s.is_test
    where sub.status = 'active' and sub.renews_at is not null
      and sub.renews_at between now() and now() + interval '30 days';

  v_result := jsonb_build_object(
    'overview', jsonb_build_object(
      'schools', v_schools, 'test_schools', v_test_schools, 'active', v_active, 'trial', v_trial,
      'suspended', v_suspended, 'expired', v_expired,
      'students', v_students, 'parents', v_parents,
      'employees', v_employees, 'users', v_users
    ),
    'revenue', jsonb_build_object(
      'mrr', round(v_mrr, 3), 'annual', round(v_annual, 3),
      'pending', v_pending, 'renewals_due', v_renewals
    )
  );
  return v_result;
end; $function$
;

CREATE OR REPLACE FUNCTION public.create_financial_year(p_name text, p_start_date date, p_end_date date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_school uuid; v_id uuid;
begin
  v_school := public.my_school_id();
  if public.my_role() <> 'owner' then
    raise exception 'غير مصرّح: إنشاء سنة مالية للمالك فقط';
  end if;
  if p_end_date < p_start_date then
    raise exception 'تاريخ النهاية يجب أن يكون بعد تاريخ البداية';
  end if;
  if coalesce(trim(p_name),'') = '' then
    raise exception 'اسم السنة المالية مطلوب';
  end if;

  insert into public.financial_years(school_id, name, start_date, end_date)
  values (v_school, trim(p_name), p_start_date, p_end_date)
  returning id into v_id;

  insert into public.audit_log(school_id, actor_id, action, details)
  values (v_school, auth.uid(), 'إنشاء سنة مالية', trim(p_name));

  return v_id;
exception
  when exclusion_violation then
    raise exception 'تتداخل هذه الفترة مع سنة مالية موجودة بالفعل لمدرستك';
end;
$function$
;

CREATE OR REPLACE FUNCTION public.create_manual_journal_entry(p_description text, p_date date, p_lines jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_school uuid;
  v_entry uuid;
  v_line jsonb;
  v_account_id uuid;
  v_code text;
  v_total_debit numeric := 0;
  v_total_credit numeric := 0;
begin
  v_school := public.my_school_id();
  if public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح بإنشاء قيود محاسبية';
  end if;
  if coalesce(trim(p_description), '') = '' then
    raise exception 'وصف القيد مطلوب';
  end if;
  if jsonb_array_length(p_lines) < 2 then
    raise exception 'القيد يحتاج سطرين على الأقل (مدين ودائن)';
  end if;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_total_debit := v_total_debit + coalesce((v_line->>'debit')::numeric, 0);
    v_total_credit := v_total_credit + coalesce((v_line->>'credit')::numeric, 0);
  end loop;

  if abs(v_total_debit - v_total_credit) > 0.001 then
    raise exception 'القيد غير متوازن: مدين % لا يساوي دائن %', v_total_debit, v_total_credit;
  end if;
  if v_total_debit <= 0 then
    raise exception 'قيمة القيد يجب أن تكون أكبر من صفر';
  end if;

  insert into public.journal_entries (school_id, description, reference, created_by)
  values (v_school, trim(p_description), 'MANUAL-' || to_char(now(),'YYYYMMDDHH24MISS'), auth.uid())
  returning id into v_entry;

  -- ⚠️ الإصلاح الحاسم: تعطيل فحص التوازن الفوري طوال إدراج كل أسطر القيد
  -- عبر الحلقة — trg_check_journal_balanced يتحقق BEFORE INSERT لكل سطر
  -- منفرد، فبلا هذا التعطيل يفشل أي قيد بأكثر من سطرين فور إدراج أول سطر.
  perform set_config('rusoom.allow_journal_flag', 'on', true);

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_code := v_line->>'account_code';

    if v_code = 'NEW' then
      if coalesce(trim(v_line->>'account_name'), '') = '' then
        raise exception 'اسم الحساب الجديد مطلوب';
      end if;
      v_code := public.next_expense_code(v_school);
      insert into public.accounts (school_id, code, name, type)
      values (v_school, v_code, trim(v_line->>'account_name'), 'expense');
    end if;

    select id into v_account_id from public.accounts
    where school_id = v_school and code = v_code;

    if v_account_id is null then
      raise exception 'الحساب % غير موجود في مدرستك', v_code;
    end if;

    insert into public.journal_lines (school_id, entry_id, account_id, debit, credit)
    values (
      v_school, v_entry, v_account_id,
      coalesce((v_line->>'debit')::numeric, 0),
      coalesce((v_line->>'credit')::numeric, 0)
    );
  end loop;

  return v_entry;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.delete_payment_within_window(p_payment_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_sch uuid;
  v_pay record;
  v_old_entry record;
  v_rev_entry uuid;
  v_student record;
begin
  v_sch := public.my_school_id();
  if public.my_role() not in ('owner','admin','accountant') and not public.has_permission('approvals') then
    raise exception 'غير مصرّح بحذف الدفعات';
  end if;

  select * into v_pay from public.payments
    where id = p_payment_id and school_id = v_sch
    for update;
  if not found then raise exception 'الدفعة غير موجودة'; end if;

  if v_pay.created_at < now() - interval '24 hours' then
    raise exception 'انتهت مهلة الحذف (24 ساعة) — استخدم القيد العكسي اليدوي من المحاسبة';
  end if;

  select full_name into v_student from public.students s
    join public.student_fees f on f.student_id = s.id
    where f.id = v_pay.fee_id;

  select * into v_old_entry from public.journal_entries
    where school_id = v_sch and reference = 'INV-' || substr(v_pay.fee_id::text, 1, 8)
      and fee_id = v_pay.fee_id
    order by created_at desc limit 1;

  if found then
    insert into public.journal_entries(school_id, entry_date, description, reference, fee_id, created_by, reverses_entry)
    values (v_sch, current_date, 'عكس قيد (حذف دفعة) — ' || coalesce(v_student.full_name,''),
            'DEL-' || left(p_payment_id::text,8), v_pay.fee_id, auth.uid(), v_old_entry.id)
    returning id into v_rev_entry;

    insert into public.journal_lines(school_id, entry_id, account_id, debit, credit)
    select school_id, v_rev_entry, account_id, credit, debit
    from public.journal_lines where entry_id = v_old_entry.id;

    perform set_config('rusoom.allow_journal_flag', 'on', true);
    update public.journal_entries set reversed_by_entry = v_rev_entry where id = v_old_entry.id;
  end if;

  update public.student_fees
  set paid = greatest(0, paid - v_pay.amount)
  where id = v_pay.fee_id;

  update public.payments
  set deleted_at = now()
  where id = p_payment_id;

  insert into public.audit_log(school_id, actor_id, action, details)
  values (v_sch, auth.uid(), 'حذف دفعة', 'الدفعة ' || p_payment_id::text || ' — المبلغ: ' || v_pay.amount);

  return jsonb_build_object('ok', true, 'deleted_amount', v_pay.amount);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.edit_payment_within_window(p_payment_id uuid, p_new_amount numeric, p_new_paid_at date, p_new_method text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_sch uuid;
  v_pay record;
  v_fee record;
  v_student record;
  v_old_entry record;
  v_rev_entry uuid;
  v_new_entry uuid;
  v_debit_code text;
  v_debit_acc uuid;
  v_credit_acc uuid;
begin
  v_sch := public.my_school_id();
  if public.my_role() not in ('owner','admin','accountant') and not public.has_permission('approvals') then
    raise exception 'غير مصرّح بتصحيح الدفعات';
  end if;
  if p_new_amount is null or p_new_amount <= 0 then
    raise exception 'المبلغ يجب أن يكون أكبر من صفر';
  end if;

  select * into v_pay from public.payments
    where id = p_payment_id and school_id = v_sch
    for update;
  if not found then raise exception 'الدفعة غير موجودة'; end if;

  if v_pay.created_at < now() - interval '24 hours' then
    raise exception 'انتهت مهلة التصحيح (24 ساعة) — استخدم القيد العكسي اليدوي من المحاسبة';
  end if;

  select * into v_fee from public.student_fees where id = v_pay.fee_id and school_id = v_sch for update;
  select full_name, code into v_student from public.students where id = v_fee.student_id;

  select * into v_old_entry from public.journal_entries
    where school_id = v_sch and reference = 'INV-' || substr(v_pay.fee_id::text, 1, 8)
      and fee_id = v_pay.fee_id
    order by created_at desc limit 1;

  if found then
    insert into public.journal_entries(school_id, entry_date, description, reference, fee_id, created_by, reverses_entry)
    values (v_sch, current_date, 'عكس قيد (تصحيح دفعة) — ' || coalesce(v_student.full_name,''),
            'CORR-' || left(p_payment_id::text,8), v_pay.fee_id, auth.uid(), v_old_entry.id)
    returning id into v_rev_entry;

    insert into public.journal_lines(school_id, entry_id, account_id, debit, credit)
    select school_id, v_rev_entry, account_id, credit, debit
    from public.journal_lines where entry_id = v_old_entry.id;

    perform set_config('rusoom.allow_journal_flag', 'on', true);
    update public.journal_entries set reversed_by_entry = v_rev_entry where id = v_old_entry.id;
  end if;

  update public.student_fees
  set paid = paid - v_pay.amount + p_new_amount
  where id = v_pay.fee_id;

  update public.payments
  set amount = p_new_amount, paid_at = p_new_paid_at, method = coalesce(p_new_method, method)
  where id = p_payment_id;

  v_debit_code := case when coalesce(p_new_method, v_pay.method) in ('cash','onsite') then '1110' else '1120' end;
  select id into v_debit_acc from public.accounts where school_id = v_sch and code = v_debit_code;
  select id into v_credit_acc from public.accounts where school_id = v_sch and code = '1210';

  if v_debit_acc is not null and v_credit_acc is not null then
    insert into public.journal_entries(school_id, entry_date, description, reference, fee_id, created_by)
    values (v_sch, p_new_paid_at,
            'تحصيل رسوم الطالب ' || coalesce(v_student.full_name,'') || ' (مصحَّحة)',
            'INV-' || substr(v_pay.fee_id::text, 1, 8), v_pay.fee_id, auth.uid())
    returning id into v_new_entry;

    perform set_config('rusoom.allow_journal_flag', 'on', true);
    insert into public.journal_lines(school_id, entry_id, account_id, debit, credit)
    values
      (v_sch, v_new_entry, v_debit_acc, p_new_amount, 0),
      (v_sch, v_new_entry, v_credit_acc, 0, p_new_amount);
  end if;

  insert into public.audit_log(school_id, actor_id, action, details)
  values (v_sch, auth.uid(), 'تصحيح دفعة',
    'الدفعة ' || p_payment_id::text || ' — من ' || v_pay.amount || ' إلى ' || p_new_amount);

  return jsonb_build_object('ok', true, 'old_amount', v_pay.amount, 'new_amount', p_new_amount);
end;
$function$
;

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
$function$
;

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
$function$
;

CREATE OR REPLACE FUNCTION public.find_payment_by_invoice_number(p_invoice_number text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_sch uuid;
  v_row record;
begin
  v_sch := public.my_school_id();
  if v_sch is null or public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح';
  end if;

  select
    p.id as payment_id, p.invoice_number, p.amount, p.method, p.paid_at,
    f.id as fee_id, f.description, f.total, f.paid, f.due_date,
    s.id as student_id, s.full_name as student_name, s.code as student_code,
    s.grade, s.section
  into v_row
  from public.payments p
  join public.student_fees f on f.id = p.fee_id
  join public.students s on s.id = f.student_id
  where p.school_id = v_sch
    and p.invoice_number = trim(p_invoice_number)
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  return jsonb_build_object(
    'ok', true,
    'payment_id', v_row.payment_id,
    'invoice_number', v_row.invoice_number,
    'payment_amount', v_row.amount,
    'payment_method', v_row.method,
    'paid_at', v_row.paid_at,
    'fee_id', v_row.fee_id,
    'description', v_row.description,
    'total', v_row.total,
    'paid', v_row.paid,
    'due_date', v_row.due_date,
    'student_id', v_row.student_id,
    'student_name', v_row.student_name,
    'student_code', v_row.student_code,
    'grade', v_row.grade,
    'section', v_row.section
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.food_purchase(p_item uuid, p_qty numeric, p_payment_source text DEFAULT 'bank'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_sch uuid; v_item record; v_cost numeric; v_entry uuid; v_acc text;
begin
  v_sch := public.my_school_id();
  if public.my_role() not in ('owner','admin','accountant') then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;

  select * into v_item from public.food_inventory where id = p_item and school_id = v_sch;
  if v_item is null then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if coalesce(p_qty,0) <= 0 then return jsonb_build_object('ok', false, 'reason', 'invalid_qty'); end if;
  if p_payment_source not in ('cash','bank') then
    return jsonb_build_object('ok', false, 'reason', 'invalid_payment_source');
  end if;

  perform public.ensure_inventory_accounts();
  v_cost := round(p_qty * v_item.cost, 3);
  v_acc := case when p_payment_source = 'cash' then '1110' else '1120' end;

  update public.food_inventory set qty = qty + p_qty where id = p_item;

  insert into public.journal_entries (school_id, description, reference, created_by)
  values (v_sch, 'شراء مواد غذائية: ' || v_item.name || ' ×' || p_qty || ' ' || v_item.unit ||
          case when p_payment_source = 'cash' then ' (نقداً)' else '' end,
          'FPUR-' || left(p_item::text,8), auth.uid())
  returning id into v_entry;

  insert into public.journal_lines (school_id, entry_id, account_id, debit, credit) values
    (v_sch, v_entry, public.acc_id('1320'), v_cost, 0),
    (v_sch, v_entry, public.acc_id(v_acc), 0, v_cost);

  return jsonb_build_object('ok', true, 'item_name', v_item.name, 'new_qty', v_item.qty + p_qty);
end;
$function$
;

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
end $function$
;

CREATE OR REPLACE FUNCTION public.grant_employee_access(p_employee_id uuid, p_role text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_school_id uuid;
  v_my_role   user_role;
  v_email     text;
  v_name      text;
begin
  v_school_id := public.my_school_id();
  v_my_role   := public.my_role();

  if v_school_id is null then
    raise exception 'لا مدرسة مرتبطة بحسابك';
  end if;
  if v_my_role not in ('owner','admin') then
    raise exception 'غير مصرّح: منح الصلاحيات للمدير أو الإداري فقط';
  end if;
  if p_role not in ('admin', 'accountant') then
    raise exception 'الدور يجب أن يكون إدارياً أو محاسباً';
  end if;

  select email, full_name into v_email, v_name
  from public.employees
  where id = p_employee_id and school_id = v_school_id;

  if v_name is null then
    raise exception 'الموظف غير موجود في مدرستك';
  end if;
  if coalesce(trim(v_email), '') = '' then
    raise exception 'لا بريد إلكتروني لهذا الموظف — أضفه أولاً';
  end if;

  insert into public.staff_invites (school_id, email, role, full_name, invited_by)
  values (v_school_id, lower(trim(v_email)), p_role::user_role, v_name, auth.uid())
  on conflict (school_id, email)
  do update set role = p_role::user_role, full_name = v_name, status = 'pending';

  insert into public.audit_log (school_id, actor_id, action, details)
  values (v_school_id, auth.uid(), 'منح صلاحية دخول',
          v_name || ' (' || lower(trim(v_email)) || ') — ' ||
          (case p_role when 'admin' then 'إداري' else 'محاسب' end));

  return jsonb_build_object('ok', true, 'email', lower(trim(v_email)), 'role', p_role);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.has_permission(p_permission text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_role user_role;
  v_sch uuid;
begin
  v_role := public.my_role();
  if v_role = 'owner' then return true; end if;

  v_sch := public.my_school_id();
  return exists (
    select 1 from public.user_permissions
    where user_id = auth.uid() and school_id = v_sch and permission = p_permission
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.import_students(p_rows jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_school_id uuid;
  v_role      user_role;
  r           jsonb;
  v_code      text;
  v_seq       int;
  v_sid       uuid;
  v_fee       numeric;
  v_discount  numeric;
  v_is_exempt boolean;
  v_special_reason text;
  v_ok        int := 0;
  v_fail      int := 0;
  v_errors    jsonb := '[]'::jsonb;
  v_rownum    int := 0;
begin
  v_school_id := public.my_school_id();
  v_role      := public.my_role();

  if v_school_id is null then
    raise exception 'لا مدرسة مرتبطة بحسابك';
  end if;
  if v_role not in ('owner', 'admin') then
    raise exception 'غير مصرّح: الاستيراد للمدير أو الإداري فقط';
  end if;

  -- ⚠️ شرط جديد: يمنع الاستيراد الجماعي حتى تُكمل المدرسة تسعير كل المراحل
  -- الدراسية أولاً — نفس الشرط المطبَّق على add_student، فحص واحد لكل
  -- عملية استيراد (لا داخل الحلقة لكل صف، لأنه ثابت على مستوى المدرسة).
  if not public.school_pricing_complete() then
    raise exception 'أكمل تسعير كل المراحل الدراسية من الإعدادات أولاً قبل استيراد الطلاب';
  end if;

  select count(*) into v_seq from public.students where school_id = v_school_id;

  for r in select * from jsonb_array_elements(p_rows) loop
    v_rownum := v_rownum + 1;
    begin
      if coalesce(trim(r->>'full_name'), '') = '' then
        raise exception 'اسم الطالب فارغ';
      end if;
      if coalesce(trim(r->>'grade'), '') = '' then
        raise exception 'الصف فارغ';
      end if;

      v_seq := v_seq + 1;
      v_code := 'STU-' || lpad(v_seq::text, 3, '0');
      while exists (select 1 from public.students where school_id = v_school_id and code = v_code) loop
        v_seq := v_seq + 1;
        v_code := 'STU-' || lpad(v_seq::text, 3, '0');
      end loop;

      v_is_exempt := lower(trim(coalesce(r->>'is_exempt', ''))) in ('نعم', 'yes', 'true', '1');
      v_special_reason := nullif(trim(r->>'special_case_reason'), '');
      v_discount := coalesce(nullif(trim(r->>'discount_pct'), '')::numeric, 0);

      v_fee := coalesce(nullif(trim(r->>'annual_fee'), '')::numeric, 0);
      if not v_is_exempt and v_fee <= 0 then
        raise exception 'الرسوم السنوية مطلوبة (أو ضع نعم في عمود الإعفاء)';
      end if;

      insert into public.students (
        school_id, code, full_name, grade, section,
        guardian_name, guardian_phone, guardian_email,
        birth_date, gender, annual_fee, discount_pct, is_exempt, special_case_reason
      ) values (
        v_school_id, v_code,
        trim(r->>'full_name'), trim(r->>'grade'), nullif(trim(r->>'section'), ''),
        nullif(trim(r->>'guardian_name'), ''), nullif(trim(r->>'guardian_phone'), ''),
        nullif(trim(r->>'guardian_email'), ''),
        nullif(trim(r->>'birth_date'), '')::date,
        nullif(trim(r->>'gender'), ''),
        v_fee, v_discount, v_is_exempt, v_special_reason
      )
      returning id into v_sid;

      if not v_is_exempt and v_fee > 0 then
        insert into public.student_fees (school_id, student_id, description, total, paid, due_date)
        values (v_school_id, v_sid, 'الرسوم الدراسية السنوية',
                round(v_fee * (1 - v_discount / 100.0), 3), 0, current_date + interval '30 days');
      end if;

      v_ok := v_ok + 1;
    exception when others then
      v_fail := v_fail + 1;
      v_errors := v_errors || jsonb_build_object(
        'row', v_rownum,
        'name', coalesce(r->>'full_name', '—'),
        'error', SQLERRM
      );
    end;
  end loop;

  insert into public.audit_log (school_id, actor_id, action, details)
  values (v_school_id, auth.uid(), 'استيراد طلاب',
          'نجح: ' || v_ok || ' · فشل: ' || v_fail);

  return jsonb_build_object('ok', v_ok, 'failed', v_fail, 'errors', v_errors);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.income_statement_period(p_from date, p_to date)
 RETURNS TABLE(section text, code text, name text, amount numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with period_lines as (
    select l.account_id, l.debit, l.credit
    from public.journal_lines l
    join public.journal_entries e on e.id = l.entry_id
    where e.school_id = public.my_school_id()
      and e.entry_date >= p_from and e.entry_date <= p_to
  )
  select
    case when a.type = 'revenue' then 'revenue' else 'expense' end as section,
    a.code, a.name,
    case when a.type = 'revenue'
      then coalesce(round(sum(pl.credit - pl.debit), 3), 0)
      else coalesce(round(sum(pl.debit - pl.credit), 3), 0)
    end as amount
  from public.accounts a
  left join period_lines pl on pl.account_id = a.id
  where a.school_id = public.my_school_id()
    and a.type in ('revenue', 'expense')
  group by a.id, a.code, a.name, a.type
  having coalesce(round(sum(pl.debit - pl.credit), 3), 0) <> 0
  order by section, a.code;
$function$
;

CREATE OR REPLACE FUNCTION public.latest_editable_payment(p_fee_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_sch uuid;
  v_pay record;
begin
  v_sch := public.my_school_id();
  if v_sch is null then
    raise exception 'لا مدرسة مرتبطة بحسابك';
  end if;

  select id, amount, method, paid_at, created_at, invoice_number
  into v_pay
  from public.payments
  where fee_id = p_fee_id and school_id = v_sch and deleted_at is null
  order by created_at desc
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_payment');
  end if;

  return jsonb_build_object(
    'ok', true,
    'payment_id', v_pay.id,
    'invoice_number', v_pay.invoice_number,
    'amount', v_pay.amount,
    'method', v_pay.method,
    'paid_at', v_pay.paid_at,
    'editable', (v_pay.created_at > now() - interval '24 hours'),
    'hours_left', greatest(0, round(extract(epoch from (v_pay.created_at + interval '24 hours' - now())) / 3600, 1))
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.mark_meal_purchase_paid(p_id uuid, p_payment_source text DEFAULT 'bank'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_sch uuid;
  v_rl   user_role;
  v_purchase record;
  v_entry  uuid;
  v_acc text;
begin
  v_sch := public.my_school_id();
  v_rl   := public.my_role();
  if v_sch is null then raise exception 'لا مدرسة مرتبطة بحسابك'; end if;
  if v_rl not in ('owner','admin','accountant') then raise exception 'غير مصرّح'; end if;
  if p_payment_source not in ('cash','bank') then raise exception 'مصدر الدفع يجب أن يكون صندوق أو بنك'; end if;

  select * into v_purchase from public.meal_purchases where id = p_id and school_id = v_sch;
  if v_purchase is null then raise exception 'الشراء غير موجود في مدرستك'; end if;
  if v_purchase.paid then raise exception 'هذا الشراء مدفوع بالفعل'; end if;

  perform public.ensure_meal_cost_accounts();
  v_acc := case when p_payment_source = 'cash' then '1110' else '1120' end;

  if v_purchase.total_cost > 0 then
    insert into public.journal_entries (school_id, description, reference, created_by)
    values (v_sch, 'سداد مستحقات مشتريات وجبات' ||
            case when p_payment_source = 'cash' then ' (نقداً)' else '' end,
            'MPAY-' || left(p_id::text,8), auth.uid())
    returning id into v_entry;

    insert into public.journal_lines (school_id, entry_id, account_id, debit, credit) values
      (v_sch, v_entry, public.acc_id('2110'), v_purchase.total_cost, 0),
      (v_sch, v_entry, public.acc_id(v_acc), 0, v_purchase.total_cost);
  end if;

  update public.meal_purchases set paid = true, updated_at = now() where id = p_id;

  return v_entry;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.meal_purchases_list(p_period text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, supplier_id uuid, supplier_name text, purchase_date date, purchase_type text, meals_count integer, unit_cost numeric, total_cost numeric, period text, paid boolean, notes text, item_type text, status text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select mp.id, mp.supplier_id, s.name, mp.purchase_date, mp.purchase_type,
         mp.meals_count, mp.unit_cost, mp.total_cost, mp.period, mp.paid, mp.notes, mp.item_type,
         mp.status
  from public.meal_purchases mp
  left join public.suppliers s on s.id = mp.supplier_id
  where mp.school_id = public.my_school_id()
    and (p_period is null or mp.period = p_period)
  order by mp.purchase_date desc, mp.created_at desc;
$function$
;

CREATE OR REPLACE FUNCTION public.my_financial_years()
 RETURNS SETOF financial_years
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select * from public.financial_years
  where school_id = public.my_school_id()
  order by start_date desc;
$function$
;

CREATE OR REPLACE FUNCTION public.my_permissions()
 RETURNS text[]
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_role user_role;
begin
  v_role := public.my_role();
  if v_role = 'owner' then
    return array['journal_entries', 'reports', 'approvals'];
  end if;
  return coalesce((
    select array_agg(permission) from public.user_permissions
    where user_id = auth.uid() and school_id = public.my_school_id()
  ), array[]::text[]);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.my_schools()
 RETURNS TABLE(school_id uuid, school_name text, branch text, role user_role, is_active_context boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- تبديل الفرع حكرًا على المالك — عضويات owner فقط تُعرض هنا
  SELECT s.id, s.name, s.branch, m.role, (s.id = p.school_id)
  FROM public.school_memberships m
  JOIN public.schools s ON s.id = m.school_id
  JOIN public.profiles p ON p.id = auth.uid()
  WHERE m.user_id = auth.uid() AND m.status = 'active' AND m.role = 'owner'
  ORDER BY s.name, s.branch;
$function$
;

CREATE OR REPLACE FUNCTION public.my_subscription_status()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_sch uuid;
  v_sub record;
  v_effective_date timestamptz;
  v_days_left int;
  v_color text;
  v_plan_label text;
begin
  v_sch := public.my_school_id();
  if v_sch is null then return jsonb_build_object('ok', false); end if;

  select * into v_sub from public.subscriptions
  where school_id = v_sch
  order by created_at desc
  limit 1;

  if v_sub is null then return jsonb_build_object('ok', false); end if;

  v_effective_date := coalesce(v_sub.renews_at, v_sub.trial_ends_at);
  v_days_left := case when v_effective_date is not null
    then extract(day from v_effective_date - now())::int
    else null end;

  v_color := case
    when v_sub.status = 'expired' then 'red'
    when v_effective_date is not null and v_effective_date < now() then 'red'
    when v_sub.status = 'pending' then 'orange'
    when v_days_left is not null and v_days_left <= 30 then 'orange'
    when v_sub.status in ('active', 'trial') then 'green'
    else 'orange'
  end;

  v_plan_label := case v_sub.plan
    when 'trial' then 'تجريبية'
    when 'monthly' then 'شهرية'
    when 'yearly' then 'سنوية'
    when 'lifetime' then 'مدى الحياة'
    when 'starter' then 'مبتدئة'
    when 'small' then 'صغيرة'
    when 'basic' then 'أساسية'
    when 'advanced' then 'متقدّمة'
    when 'enterprise' then 'مؤسسية'
    else v_sub.plan::text
  end;

  return jsonb_build_object(
    'ok', true,
    'plan', v_sub.plan,
    'plan_label', v_plan_label,
    'status', v_sub.status,
    'color', v_color,
    'days_left', v_days_left,
    'effective_date', v_effective_date
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.next_expense_code(p_school_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_code int := 5290;
begin
  while exists (select 1 from public.accounts where school_id = p_school_id and code = v_code::text) loop
    v_code := v_code + 1;
  end loop;
  return v_code::text;
end $function$
;

CREATE OR REPLACE FUNCTION public.next_invoice_number(p_school_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_num integer;
  v_year text := to_char(current_date, 'YYYY');
begin
  insert into public.school_invoice_counters (school_id, last_number)
  values (p_school_id, 1)
  on conflict (school_id) do update
    set last_number = school_invoice_counters.last_number + 1
  returning last_number into v_num;

  return 'INV-' || v_year || '-' || lpad(v_num::text, 4, '0');
end;
$function$
;

CREATE OR REPLACE FUNCTION public.org_overview()
 RETURNS TABLE(school_id uuid, school_name text, branch text, students integer, employees integer, fees_total numeric, fees_paid numeric, collection_rate numeric, revenue numeric, expense numeric, profit numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_year_start date := date_trunc('year', current_date)::date;
  v_year_end date := (date_trunc('year', current_date) + interval '1 year' - interval '1 day')::date;
begin
  return query
  select
    s.id, s.name, s.branch,
    (select count(*)::int from public.students st where st.school_id = s.id and st.status = 'active' and st.deleted_at is null),
    (select count(*)::int from public.employees e where e.school_id = s.id and e.deleted_at is null),
    coalesce((select sum(f.total) from public.student_fees f where f.school_id = s.id and f.deleted_at is null and f.created_at >= v_year_start and f.created_at <= v_year_end + interval '1 day'), 0),
    coalesce((select sum(f.paid) from public.student_fees f where f.school_id = s.id and f.deleted_at is null and f.created_at >= v_year_start and f.created_at <= v_year_end + interval '1 day'), 0),
    case when coalesce((select sum(f.total) from public.student_fees f where f.school_id = s.id and f.deleted_at is null and f.created_at >= v_year_start and f.created_at <= v_year_end + interval '1 day'), 0) > 0
      then round(
        coalesce((select sum(f.paid) from public.student_fees f where f.school_id = s.id and f.deleted_at is null and f.created_at >= v_year_start and f.created_at <= v_year_end + interval '1 day'), 0)
        / (select sum(f.total) from public.student_fees f where f.school_id = s.id and f.deleted_at is null and f.created_at >= v_year_start and f.created_at <= v_year_end + interval '1 day') * 100
      )
      else 100 end,
    coalesce((select -sum(case when a.type='revenue' then l.debit - l.credit else 0 end)
      from public.journal_lines l join public.journal_entries e on e.id = l.entry_id
      join public.accounts a on a.id = l.account_id and a.school_id = s.id
      where l.school_id = s.id and e.entry_date >= v_year_start and e.entry_date <= v_year_end), 0),
    coalesce((select sum(case when a.type='expense' then l.debit - l.credit else 0 end)
      from public.journal_lines l join public.journal_entries e on e.id = l.entry_id
      join public.accounts a on a.id = l.account_id and a.school_id = s.id
      where l.school_id = s.id and e.entry_date >= v_year_start and e.entry_date <= v_year_end), 0),
    coalesce((select -sum(case when a.type='revenue' then l.debit - l.credit else 0 end)
      from public.journal_lines l join public.journal_entries e on e.id = l.entry_id
      join public.accounts a on a.id = l.account_id and a.school_id = s.id
      where l.school_id = s.id and e.entry_date >= v_year_start and e.entry_date <= v_year_end), 0)
    -
    coalesce((select sum(case when a.type='expense' then l.debit - l.credit else 0 end)
      from public.journal_lines l join public.journal_entries e on e.id = l.entry_id
      join public.accounts a on a.id = l.account_id and a.school_id = s.id
      where l.school_id = s.id and e.entry_date >= v_year_start and e.entry_date <= v_year_end), 0)
  from public.schools s
  join public.school_memberships m on m.school_id = s.id
  where m.user_id = auth.uid() and m.status = 'active' and m.role = 'owner'
  order by s.name, s.branch;
end;
$function$
;

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
end $function$
;

CREATE OR REPLACE FUNCTION public.record_payment(p_fee_id uuid, p_amount numeric, p_method text DEFAULT 'bank'::text, p_paid_at date DEFAULT CURRENT_DATE, p_skip_check_hold boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_sch   uuid;
  v_fee      record;
  v_student  record;
  v_entry_id uuid;
  v_debit_code text;
  v_debit_acc  uuid;
  v_credit_acc uuid;
  v_school_name text;
  v_guardian_phone text;
  v_guardian_name  text;
  v_dup_count int;
  v_pending_id uuid;
  v_invoice_no text;
begin
  if public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح بتسجيل الدفعات';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'مبلغ الدفعة يجب أن يكون أكبر من صفر';
  end if;

  v_sch := public.my_school_id();

  select * into v_fee from public.student_fees
    where id = p_fee_id and school_id = v_sch
    for update;

  if not found then raise exception 'الفاتورة غير موجودة'; end if;

  select count(*) into v_dup_count
  from public.payments
  where fee_id = p_fee_id
    and amount = p_amount
    and method = coalesce(p_method, 'bank')
    and created_at > now() - interval '10 seconds';

  if v_dup_count > 0 and not p_skip_check_hold then
    raise exception 'تم رصد محاولة تسجيل دفعة مكررة (نفس المبلغ والطريقة خلال ثوانٍ قليلة) — تم رفضها للحماية من الازدواج';
  end if;

  if v_fee.paid + p_amount > v_fee.total + 0.0005 then
    raise exception 'المبلغ يتجاوز المتبقّي على الفاتورة';
  end if;

  select full_name, code, guardian_phone, guardian_name
    into v_student
    from public.students where id = v_fee.student_id;

  if coalesce(p_method,'bank') = 'check' and not p_skip_check_hold then
    insert into public.pending_payments(school_id, fee_id, guardian_id, amount, method, status)
    values (v_sch, p_fee_id, null, p_amount, 'check', 'pending')
    returning id into v_pending_id;

    select name into v_school_name from public.schools where id = v_sch;

    return jsonb_build_object(
      'ok', true, 'pending', true, 'pending_id', v_pending_id,
      'student_name', v_student.full_name, 'amount', p_amount, 'method', 'check',
      'school_name', v_school_name,
      'message', 'الشيك مسجَّل بانتظار التحصيل — لن يُحتسب مسدَّداً حتى الاعتماد'
    );
  end if;

  -- الرقم التسلسلي الكامل (INV-2026-0001) يُنشأ هنا فقط، عند تسجيل دفعة
  -- فعلية حقيقية (لا معلّقة ولا شيك بانتظار التحصيل).
  v_invoice_no := public.next_invoice_number(v_sch);

  insert into public.payments(school_id, fee_id, amount, method, paid_at, recorded_by, invoice_number)
  values(v_sch, p_fee_id, p_amount, coalesce(p_method,'bank'), coalesce(p_paid_at,current_date), auth.uid(), v_invoice_no);

  update public.student_fees set paid = paid + p_amount where id = p_fee_id;

  v_debit_code := case when p_method in ('cash','onsite') then '1110' else '1120' end;
  select id into v_debit_acc  from public.accounts where school_id = v_sch and code = v_debit_code;
  select id into v_credit_acc from public.accounts where school_id = v_sch and code = '1210';

  if v_debit_acc is not null and v_credit_acc is not null then
    insert into public.journal_entries(school_id, entry_date, description, reference, fee_id, created_by)
    values(
      v_sch, coalesce(p_paid_at, current_date),
      'تحصيل رسوم الطالب ' || coalesce(v_student.full_name,'') ||
        ' (' || coalesce(v_student.code,'') || ') — ' ||
        case when p_method = 'check' then 'شيك (بعد التحصيل)'
             when p_method in ('cash','onsite') then 'نقداً'
             else 'تحويل بنكي' end,
      'INV-' || substr(p_fee_id::text, 1, 8), p_fee_id, auth.uid()
    )
    returning id into v_entry_id;

    perform set_config('rusoom.allow_journal_flag', 'on', true);
    insert into public.journal_lines(school_id, entry_id, account_id, debit, credit)
    values
      (v_sch, v_entry_id, v_debit_acc, p_amount, 0),
      (v_sch, v_entry_id, v_credit_acc, 0, p_amount);
  end if;

  insert into public.audit_log(school_id, actor_id, action, details)
  values(v_sch, auth.uid(), 'تسجيل دفعة رسوم', p_amount::text || ' (' || coalesce(p_method,'bank') || ')');

  select name into v_school_name from public.schools where id = v_sch;

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
    'ok', true, 'pending', false,
    'student_name', v_student.full_name, 'guardian_name', v_guardian_name,
    'guardian_phone', v_guardian_phone, 'amount', p_amount,
    'method', coalesce(p_method,'bank'), 'school_name', v_school_name,
    'remaining', (v_fee.total - (v_fee.paid + p_amount)),
    'invoice_number', v_invoice_no
  );
end $function$
;

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

  -- ⚠️ نفس الإصلاح المطبَّق على record_payment: تعطيل فحص التوازن الفوري
  -- مؤقتاً أثناء إدراج السطرين، لأن trg_check_journal_balanced يتحقق
  -- BEFORE INSERT لكل صف حتى مع إدراج مُجمَّع واحد.
  perform set_config('rusoom.allow_journal_flag', 'on', true);
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
end $function$
;

CREATE OR REPLACE FUNCTION public.reject_payment(p_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_school uuid; v_pp record;
begin
  v_school := public.my_school_id();
  if public.my_role() <> 'accountant' and not public.has_permission('approvals') then
    raise exception 'غير مصرّح';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'يجب ذكر سبب الرفض لإبلاغ ولي الأمر';
  end if;

  select * into v_pp from public.pending_payments where id = p_id and school_id = v_school;
  if v_pp is null or v_pp.status <> 'pending' then raise exception 'غير قابل للرفض'; end if;

  update public.pending_payments
  set status = 'rejected', resolved_at = now(), resolved_by = auth.uid()
  where id = p_id;

  insert into public.notifications(school_id, audience, guardian_id, body)
  values (v_school, 'guardian', v_pp.guardian_id,
    '❌ تعذّر اعتماد دفعتك (' || to_char(v_pp.amount,'FM999990.000') || ') — السبب: ' || trim(p_reason) ||
    '. يمكنك إعادة المحاولة أو التواصل مع المدرسة.');
end;
$function$
;

CREATE OR REPLACE FUNCTION public.reopen_financial_year(p_fy_id uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_school uuid; v_fy public.financial_years%rowtype;
begin
  v_school := public.my_school_id();
  if public.my_role() <> 'owner' then
    raise exception 'غير مصرّح: إعادة فتح سنة مالية للمالك فقط';
  end if;
  if coalesce(trim(p_reason),'') = '' then
    raise exception 'يجب ذكر سبب إعادة الفتح (للتدقيق)';
  end if;

  update public.financial_years
  set status = 'OPEN', closed_at = null, closed_by = null
  where id = p_fy_id and school_id = v_school and status = 'CLOSED'
  returning * into v_fy;

  if not found then
    raise exception 'السنة المالية غير موجودة أو ليست مُقفلة أصلاً';
  end if;

  insert into public.audit_log(school_id, actor_id, action, details)
  values (v_school, auth.uid(), 'إعادة فتح سنة مالية', v_fy.name || ' — السبب: ' || p_reason);

  return jsonb_build_object('ok', true, 'financial_year_id', p_fy_id, 'status', 'OPEN');
end;
$function$
;

CREATE OR REPLACE FUNCTION public.reverse_journal_entry(p_entry_id uuid, p_reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_school   uuid;
  v_orig     record;
  v_new_id   uuid;
  v_line     record;
  v_paid_amount numeric;
begin
  if public.my_role() not in ('owner','accountant') and not public.has_permission('journal_entries') then
    raise exception 'غير مصرّح: عكس القيود يحتاج صلاحية «القيود» من مالك المدرسة';
  end if;
  if coalesce(trim(p_reason),'') = '' then
    raise exception 'يجب ذكر سبب التصحيح (للتدقيق)';
  end if;

  v_school := public.my_school_id();
  select * into v_orig from public.journal_entries
    where id = p_entry_id and school_id = v_school;
  if not found then raise exception 'القيد غير موجود'; end if;
  if v_orig.reversed_by_entry is not null then
    raise exception 'هذا القيد سبق عكسه — لا يمكن عكسه مرّتين';
  end if;
  if v_orig.reverses_entry is not null then
    raise exception 'لا يمكن عكس قيدٍ هو نفسه قيدٌ عكسي';
  end if;

  insert into public.journal_entries(school_id, entry_date, description, reference, reverses_entry, created_by)
  values(
    v_school, current_date,
    'قيد عكسي (تصحيح) — ' || coalesce(v_orig.description,'') || ' | السبب: ' || p_reason,
    'REV-' || coalesce(v_orig.reference, substr(p_entry_id::text,1,8)),
    p_entry_id, auth.uid()
  )
  returning id into v_new_id;

  for v_line in select account_id, debit, credit from public.journal_lines where entry_id = p_entry_id loop
    insert into public.journal_lines(school_id, entry_id, account_id, debit, credit)
    values(v_school, v_new_id, v_line.account_id, v_line.credit, v_line.debit);
  end loop;

  perform set_config('rusoom.allow_journal_flag', 'on', true);
  update public.journal_entries set reversed_by_entry = v_new_id where id = p_entry_id;
  perform set_config('rusoom.allow_journal_flag', 'off', true);

  if v_orig.fee_id is not null then
    select coalesce(sum(jl.debit),0) into v_paid_amount
    from public.journal_lines jl
    join public.accounts a on a.id = jl.account_id
    where jl.entry_id = p_entry_id and a.code in ('1110','1120');

    if v_paid_amount > 0 then
      update public.student_fees
      set paid = greatest(0, paid - v_paid_amount)
      where id = v_orig.fee_id and school_id = v_school;
    end if;
  end if;

  insert into public.audit_log(school_id, actor_id, action, details)
  values(v_school, auth.uid(), 'عكس قيد محاسبي',
    'القيد ' || p_entry_id::text || ' — السبب: ' || p_reason ||
    case when v_orig.fee_id is not null and coalesce(v_paid_amount,0) > 0
         then ' — خُفّض من رصيد الفاتورة: ' || v_paid_amount::text
         else '' end);

  return v_new_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.risk_scores()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_sch uuid;
  v_rows   jsonb := '[]'::jsonb;
  r        record;
  v_score      numeric;
  v_age_pts    numeric;
  v_ratio_pts  numeric;
  v_count_pts  numeric;
  v_level      text;
  v_action     text;
  v_year_start date;
  v_year_end   date;
begin
  v_sch := public.my_school_id();
  if v_sch is null then return jsonb_build_object('error','no_school'); end if;

  if not public.intelligence_enabled('risk') then
    return jsonb_build_object('ok', false, 'disabled', true);
  end if;

  select start_date, end_date into v_year_start, v_year_end
  from public.academic_years
  where school_id = v_sch and is_current = true
  limit 1;

  for r in
    select
      s.id as student_id, s.full_name, s.code,
      coalesce(s.guardian_name, '—') as guardian, s.guardian_phone as phone,
      coalesce(sum(f.total), 0)          as total_billed,
      coalesce(sum(f.paid), 0)           as total_paid,
      -- ⚠️ الإصلاح: نقطة بداية الاستحقاق لكل طالب هي الأبعد زمنياً بين بداية
      -- العام الدراسي وتاريخ أول فاتورة له — لا بداية العام وحدها. طالب
      -- سُجِّل اليوم لا يُحاسَب على أشهر مضت قبل تسجيله فعلياً.
      greatest(coalesce(v_year_start, min(f.created_at)::date), min(f.created_at)::date) as effective_start,
      count(*) filter (where f.paid < f.total and f.due_date is not null and f.due_date < current_date) as overdue_count,
      coalesce(max(current_date - f.due_date) filter (where f.paid < f.total and f.due_date is not null and f.due_date < current_date), 0) as oldest_days
    from public.students s
    join public.student_fees f on f.student_id = s.id and f.school_id = v_sch
    where s.school_id = v_sch and s.status = 'active' and s.deleted_at is null
    group by s.id, s.full_name, s.code, s.guardian_name, s.guardian_phone
  loop
    declare
      v_elapsed_pct numeric;
      v_due_now numeric;
      v_outstanding numeric;
    begin
      if v_year_end is not null and v_year_end > r.effective_start then
        v_elapsed_pct := least(1.0, greatest(0.0,
          (current_date - r.effective_start)::numeric / (v_year_end - r.effective_start)::numeric
        ));
      else
        v_elapsed_pct := 1.0;
      end if;

      v_due_now := round(r.total_billed * v_elapsed_pct, 3);
      v_outstanding := greatest(0, v_due_now - r.total_paid);

      continue when v_outstanding <= 0.0005;

      v_age_pts   := least(45, r.oldest_days::numeric / 90 * 45);
      v_ratio_pts := case when v_due_now > 0 then least(35, v_outstanding / v_due_now * 35) else 0 end;
      v_count_pts := least(20, r.overdue_count * 5);

      v_score := round(v_age_pts + v_ratio_pts + v_count_pts);
      v_level := case when v_score >= 70 then 'عالية' when v_score >= 40 then 'متوسّطة' else 'منخفضة' end;
      v_action := case
        when v_score >= 70 then 'اتصال مباشر بولي الأمر'
        when v_score >= 40 then 'إرسال تذكير عاجل'
        else 'إرسال تذكير ودّي' end;

      v_rows := v_rows || jsonb_build_object(
        'student_id', r.student_id,
        'student_name', r.full_name,
        'student_code', r.code,
        'guardian', r.guardian,
        'phone', r.phone,
        'outstanding', round(v_outstanding, 3),
        'overdue_count', r.overdue_count,
        'oldest_days', r.oldest_days,
        'score', v_score,
        'level', v_level,
        'action', v_action
      );
    end;
  end loop;

  return jsonb_build_object('ok', true, 'items', v_rows);
end; $function$
;

CREATE OR REPLACE FUNCTION public.school_copilot()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$declare
  v_school   uuid;
  v_role     text;
  v_students        int := 0;
  v_employees       int := 0;
  v_fees_total      numeric := 0;
  v_fees_paid       numeric := 0;
  v_outstanding     numeric := 0;
  v_overdue_count   int := 0;
  v_pending_salary  int := 0;
  v_pending_pay     int := 0;
  v_low_stock       int := 0;
  v_revenue         numeric := 0;
  v_expense         numeric := 0;
  v_collection_rate numeric := 0;
  v_today_collected numeric := 0;
  v_alerts          jsonb := '[]'::jsonb;
  v_recos           jsonb := '[]'::jsonb;
  v_health          int;
  v_health_fin      int := 30;
  v_health_ops      int := 15;
  v_health_tasks    int := 15;
  v_health_inv      int := 10;
begin
  v_school := public.my_school_id();
  v_role   := public.my_role();
  if v_school is null then
    return jsonb_build_object('error', 'no_school');
  end if;

  -- ⚠️ إصلاح: استُثني الطلاب/الموظفون المحذوفون بصمت (deleted_at)
  select count(*) into v_students  from public.students  where school_id = v_school and status = 'active' and deleted_at is null;
  select count(*) into v_employees from public.employees where school_id = v_school and deleted_at is null;

  select coalesce(sum(total),0), coalesce(sum(paid),0)
    into v_fees_total, v_fees_paid
    from public.student_fees where school_id = v_school;
  v_outstanding := v_fees_total - v_fees_paid;
  if v_fees_total > 0 then
    v_collection_rate := round(v_fees_paid / v_fees_total * 100, 1);
  end if;

  select count(*) into v_overdue_count
    from public.student_fees
    where school_id = v_school and paid < total
      and due_date is not null and due_date < current_date;

  select count(*) into v_pending_salary
    from public.salary_requests where school_id = v_school and status = 'pending';

  select count(*) into v_pending_pay
    from public.pending_payments where school_id = v_school and status = 'pending' and (method <> 'thawani' or txn_state = 'failed');

  select count(*) into v_low_stock
    from public.inventory_items where school_id = v_school and qty <= 3;

  select coalesce(sum(amount),0) into v_today_collected
    from public.payments where school_id = v_school and paid_at = current_date;

  select
    coalesce(sum(case when a.type='revenue' then l.credit - l.debit else 0 end),0),
    coalesce(sum(case when a.type='expense' then l.debit - l.credit else 0 end),0)
    into v_revenue, v_expense
    from public.accounts a
    left join public.journal_lines l on l.account_id = a.id
    where a.school_id = v_school;

  if v_overdue_count > 0 then
    v_alerts := v_alerts || jsonb_build_object(
      'severity','high','title', v_overdue_count || ' فاتورة متأخرة عن السداد',
      'detail','رسوم تجاوزت تاريخ استحقاقها','action','send_reminders','action_label','عرض الفواتير المتأخرة','href','/fees?focus=overdue#overdue');
  end if;
  if v_pending_pay > 0 then
    v_alerts := v_alerts || jsonb_build_object(
      'severity','high','title', v_pending_pay || ' دفعة بانتظار اعتمادك',
      'detail','مدفوعات أرسلها أولياء الأمور','action','approve','action_label','مراجعة المدفوعات','href','/fees?focus=pending#pending-payments');
  end if;
  if v_pending_salary > 0 then
    v_alerts := v_alerts || jsonb_build_object(
      'severity','medium','title', v_pending_salary || ' طلب راتب بانتظار الاعتماد',
      'detail','تعديلات رواتب معلّقة','action','approve_salary','action_label','مراجعة الرواتب','href','/employees?focus=salary#salary-requests');
  end if;
  if v_low_stock > 0 then
    v_alerts := v_alerts || jsonb_build_object(
      'severity','medium','title', v_low_stock || ' صنف مخزون منخفض أو نفد',
      'detail','أصناف تحتاج إعادة تعبئة','action','restock','action_label','مراجعة المخزون','href','/inventory?focus=low#low-stock');
  end if;
  if v_collection_rate < 60 and v_fees_total > 0 then
    v_alerts := v_alerts || jsonb_build_object(
      'severity','medium','title','نسبة التحصيل منخفضة (' || v_collection_rate || '%)',
      'detail','التحصيل أقلّ من المستهدف','action','review','action_label','متابعة الرسوم','href','/fees#fees-table');
  end if;

  if v_overdue_count > 0 then
    v_recos := v_recos || jsonb_build_object(
      'title','إرسال تذكيرات السداد','reason', v_overdue_count || ' فاتورة متأخرة',
      'benefit','تحسين التحصيل وتقليل المتأخرات','action_label','إرسال التذكيرات','href','/fees?focus=overdue#overdue');
  end if;
  if v_pending_pay > 0 then
    v_recos := v_recos || jsonb_build_object(
      'title','اعتماد مدفوعات أولياء الأمور','reason', v_pending_pay || ' دفعة معلّقة',
      'benefit','تحديث الحسابات وإصدار الفواتير','action_label','فتح المدفوعات','href','/fees?focus=pending#pending-payments');
  end if;
  if v_pending_salary > 0 then
    v_recos := v_recos || jsonb_build_object(
      'title','اعتماد طلبات الرواتب','reason', v_pending_salary || ' طلب معلّق',
      'benefit','إتمام مسير الرواتب في وقته','action_label','فتح الرواتب','href','/employees?focus=salary#salary-requests');
  end if;
  if v_outstanding > 0 and v_overdue_count = 0 then
    v_recos := v_recos || jsonb_build_object(
      'title','متابعة الرسوم المستحقّة','reason','مستحقات قائمة بقيمة ' || round(v_outstanding,3),
      'benefit','تعزيز السيولة النقدية','action_label','عرض الرسوم','href','/fees#fees-table');
  end if;

  if v_students = 0 then
    v_health := null;
    v_health_fin := 0; v_health_ops := 0; v_health_tasks := 0; v_health_inv := 0;
  else
    v_health_fin := round(30 * least(v_collection_rate,100) / 100);
    v_health_tasks := greatest(0, 15 - (v_pending_salary + v_pending_pay) * 2);
    v_health_ops := greatest(0, 15 - v_overdue_count);
    v_health_inv := case when v_low_stock = 0 then 10 else greatest(0, 10 - v_low_stock) end;
    v_health := least(100, v_health_fin + v_health_tasks + v_health_ops + v_health_inv + 30);
  end if;

  return jsonb_build_object(
    'ok', true,
    'role', v_role,
    'summary', jsonb_build_object(
      'today_collected', v_today_collected,
      'outstanding', v_outstanding,
      'collection_rate', v_collection_rate,
      'pending_approvals', v_pending_salary + v_pending_pay,
      'students', v_students,
      'employees', v_employees,
      'revenue', v_revenue,
      'expense', v_expense
    ),
    'alerts', v_alerts,
    'recommendations', v_recos,
    'kpis', jsonb_build_object(
      'collection_rate', v_collection_rate,
      'outstanding', v_outstanding,
      'overdue_count', v_overdue_count,
      'pending_payments', v_pending_pay,
      'low_stock', v_low_stock
    ),
    'health', jsonb_build_object(
      'score', v_health,
      'status', case when v_health is null then 'لا توجد بيانات كافية'
                     when v_health >= 85 then 'ممتاز' when v_health >= 70 then 'جيّد'
                     when v_health >= 50 then 'متوسّط' else 'يحتاج انتباهاً' end,
      'breakdown', jsonb_build_object(
        'financial', v_health_fin, 'operations', v_health_ops,
        'tasks', v_health_tasks, 'inventory', v_health_inv)
    )
  );
end;$function$
;

CREATE OR REPLACE FUNCTION public.school_pricing_complete()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_sch uuid;
  v_all_grades text[] := array['براعم','روضة','تمهيدي','تجهيزي','الأول','الثاني','الثالث','الرابع','الخامس','السادس','السابع','الثامن','التاسع','العاشر','الحادي عشر','الثاني عشر'];
  v_missing_count int;
begin
  v_sch := public.my_school_id();
  if v_sch is null then return false; end if;

  select count(*) into v_missing_count
  from unnest(v_all_grades) as g(grade)
  where not exists (
    select 1 from public.grade_fees gf
    where gf.school_id = v_sch and gf.grade = g.grade and gf.annual_fee > 0
  );

  return v_missing_count = 0;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_bundle_setting(p_enabled boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if public.my_role() not in ('owner','admin') then
    raise exception 'غير مصرّح';
  end if;
  update public.schools set bundle_transport_meals = p_enabled
  where id = public.my_school_id();
end $function$
;

CREATE OR REPLACE FUNCTION public.set_custom_section_names(p_names text[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_school uuid := public.my_school_id();
  v_role   text := public.my_role()::text;
  v_clean  text[];
begin
  if v_school is null then raise exception 'لا توجد مدرسة مرتبطة بالحساب'; end if;
  if v_role <> 'owner' then raise exception 'غير مصرّح — المدير فقط يمكنه تغيير ترميز الشُّعب'; end if;

  -- تنظيف: إزالة الفراغات والقيم الفارغة، بلا حد أقصى للعدد
  select array_agg(distinct trim(n)) into v_clean
  from unnest(coalesce(p_names, '{}')) n
  where trim(n) <> '';

  update public.schools
    set custom_section_names = coalesce(v_clean, '{}')
    where id = v_school;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_section_styles(p_styles text[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_school uuid := public.my_school_id();
  v_role   text := public.my_role()::text;
  v_allowed text[] := array['ar_letters','numbers','en_letters','en_numbers','custom'];
begin
  if v_school is null then
    raise exception 'لا توجد مدرسة مرتبطة بالحساب';
  end if;
  if v_role <> 'owner' then
    raise exception 'غير مصرّح — المدير فقط يمكنه تغيير ترميز الشُّعب';
  end if;
  if p_styles is null or array_length(p_styles, 1) is null then
    raise exception 'اختر نمطاً واحداً على الأقل';
  end if;
  if exists (select 1 from unnest(p_styles) s where s <> all(v_allowed)) then
    raise exception 'نمط ترميز غير معروف';
  end if;

  update public.schools
    set section_styles = p_styles
    where id = v_school;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_user_permission(p_user_id uuid, p_permission text, p_grant boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_sch uuid;
  v_target record;
begin
  v_sch := public.my_school_id();
  if public.my_role() <> 'owner' then
    raise exception 'غير مصرّح: تعديل الصلاحيات للمالك فقط';
  end if;
  if p_permission not in ('journal_entries', 'reports', 'approvals') then
    raise exception 'صلاحية غير معروفة: %', p_permission;
  end if;

  select * into v_target from public.profiles
    where id = p_user_id and school_id = v_sch and role in ('admin','accountant');
  if not found then
    raise exception 'المستخدم غير موجود في مدرستك أو ليس إدارياً/محاسباً';
  end if;

  if p_grant then
    insert into public.user_permissions (user_id, school_id, permission, granted_by)
    values (p_user_id, v_sch, p_permission, auth.uid())
    on conflict (user_id, permission) do nothing;
  else
    delete from public.user_permissions
    where user_id = p_user_id and school_id = v_sch and permission = p_permission;
  end if;

  insert into public.audit_log (school_id, actor_id, action, details)
  values (v_sch, auth.uid(), 'تعديل صلاحية موظف',
    (select full_name from public.profiles where id = p_user_id) || ' — ' ||
    p_permission || ': ' || case when p_grant then 'منح' else 'سحب' end);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.staff_permissions_list()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_sch uuid;
  v_result jsonb;
begin
  v_sch := public.my_school_id();
  if public.my_role() <> 'owner' then
    raise exception 'غير مصرّح';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'user_id', p.id,
    'full_name', p.full_name,
    'role', p.role,
    'permissions', coalesce((
      select jsonb_agg(up.permission) from public.user_permissions up
      where up.user_id = p.id and up.school_id = v_sch
    ), '[]'::jsonb)
  ) order by p.full_name), '[]'::jsonb)
  into v_result
  from public.profiles p
  where p.school_id = v_sch and p.role in ('admin', 'accountant');

  return v_result;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.student_payment_tracker(p_student_id uuid)
 RETURNS TABLE(month_label text, month_key text, paid_amount numeric, has_payment boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_school uuid;
begin
  v_school := public.my_school_id();
  if v_school is null or public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح';
  end if;
  if not exists (select 1 from public.students where id = p_student_id and school_id = v_school) then
    raise exception 'الطالب غير موجود في مدرستك';
  end if;

  return query
  with months as (
    select generate_series(
      date_trunc('month', current_date - interval '11 months'),
      date_trunc('month', current_date),
      interval '1 month'
    )::date as month_start
  ),
  paid_by_month as (
    select date_trunc('month', p.paid_at)::date as month_start,
           sum(p.amount) as total_paid
    from public.payments p
    join public.student_fees f on f.id = p.fee_id
    where f.student_id = p_student_id and f.school_id = v_school
    group by date_trunc('month', p.paid_at)
  )
  select
    to_char(m.month_start, 'Mon YYYY'),
    to_char(m.month_start, 'YYYY-MM'),
    coalesce(pb.total_paid, 0),
    coalesce(pb.total_paid, 0) > 0
  from months m
  left join paid_by_month pb on pb.month_start = m.month_start
  order by m.month_start;
end $function$
;

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
  -- تبديل الفرع حكرًا على المالك — لا يُسمح بالتبديل عبر عضوية بدور آخر (admin مثلاً)
  select role into v_role
  from public.school_memberships
  where user_id = auth.uid() and school_id = p_school_id and status = 'active' and role = 'owner';

  if v_role is null then
    raise exception 'لا تملك عضوية مالك فعّالة في هذه المدرسة';
  end if;

  update public.profiles
  set school_id = p_school_id, role = v_role
  where id = auth.uid();

  select name into v_school_name from public.schools where id = p_school_id;

  insert into public.audit_log(school_id, actor_id, action, details)
  values (p_school_id, auth.uid(), 'تبديل الفرع النشط', coalesce(v_school_name, ''));

  return jsonb_build_object('ok', true, 'school_id', p_school_id, 'school_name', v_school_name, 'role', v_role);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.test_dummy_function()
 RETURNS text
 LANGUAGE plpgsql
AS $function$
declare
  v_seq int := 1;
begin
  return 'test ok: ' || v_seq::text;
end;
$function$
;

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
$function$
;

CREATE OR REPLACE FUNCTION public.update_meal_plan(p_id uuid, p_fee numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_school uuid;
begin
  v_school := public.my_school_id();
  if v_school is null or public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح بإدارة باقات التغذية';
  end if;
  if coalesce(p_fee,0) <= 0 then raise exception 'الرسم يجب أن يكون أكبر من صفر'; end if;
  if not exists (select 1 from public.meal_plans where id = p_id and school_id = v_school) then
    raise exception 'الباقة غير موجودة في مدرستك';
  end if;

  update public.meal_plans set fee = p_fee where id = p_id and school_id = v_school;
end $function$
;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TRIGGER trg_check_financial_year_open
  BEFORE INSERT ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.check_financial_year_open();

DROP TRIGGER IF EXISTS trg_check_journal_balanced ON public.journal_lines;
CREATE CONSTRAINT TRIGGER trg_check_journal_balanced
  AFTER INSERT ON public.journal_lines
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.check_journal_balanced();

-- ---------------------------------------------------------------------------
-- RLS policies (production definitions)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS academic_years_insert ON public.academic_years;
CREATE POLICY academic_years_insert ON public.academic_years AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((school_id = my_school_id()) AND (my_role() = ANY (ARRAY['owner'::user_role, 'admin'::user_role]))));

DROP POLICY IF EXISTS academic_years_read ON public.academic_years;
CREATE POLICY academic_years_read ON public.academic_years AS PERMISSIVE FOR SELECT TO public
  USING ((is_platform_admin() OR (school_id = my_school_id())));

DROP POLICY IF EXISTS academic_years_update ON public.academic_years;
CREATE POLICY academic_years_update ON public.academic_years AS PERMISSIVE FOR UPDATE TO public
  USING ((is_platform_admin() OR ((school_id = my_school_id()) AND (my_role() = ANY (ARRAY['owner'::user_role, 'admin'::user_role])))));

DROP POLICY IF EXISTS ann_platform_delete ON public.announcements;
CREATE POLICY ann_platform_delete ON public.announcements AS PERMISSIVE FOR DELETE TO public
  USING (is_platform_admin());

DROP POLICY IF EXISTS ann_platform_insert ON public.announcements;
CREATE POLICY ann_platform_insert ON public.announcements AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (is_platform_admin());

DROP POLICY IF EXISTS ann_platform_update ON public.announcements;
CREATE POLICY ann_platform_update ON public.announcements AS PERMISSIVE FOR UPDATE TO public
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

DROP POLICY IF EXISTS ann_school_read ON public.announcements;
CREATE POLICY ann_school_read ON public.announcements AS PERMISSIVE FOR SELECT TO public
  USING ((is_platform_admin() OR (target = 'all'::text) OR (target = (my_school_id())::text)));

DROP POLICY IF EXISTS audit_insert_staff_only ON public.audit_log;
CREATE POLICY audit_insert_staff_only ON public.audit_log AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((school_id = my_school_id()) AND (my_role() = ANY (ARRAY['owner'::user_role, 'admin'::user_role, 'accountant'::user_role]))));

DROP POLICY IF EXISTS audit_log_read ON public.audit_log;
CREATE POLICY audit_log_read ON public.audit_log AS PERMISSIVE FOR SELECT TO public
  USING ((is_platform_admin() OR ((school_id = my_school_id()) AND (my_role() = ANY (ARRAY['owner'::user_role, 'admin'::user_role])))));

DROP POLICY IF EXISTS caf_billing_read ON public.cafeteria_billing;
CREATE POLICY caf_billing_read ON public.cafeteria_billing AS PERMISSIVE FOR SELECT TO public
  USING ((school_id = my_school_id()));

DROP POLICY IF EXISTS certificate_requests_select ON public.certificate_requests;
CREATE POLICY certificate_requests_select ON public.certificate_requests AS PERMISSIVE FOR SELECT TO public
  USING (((parent_id = ( SELECT auth.uid() AS uid)) OR (school_id = my_school_id())));

DROP POLICY IF EXISTS cert_parent_read ON public.certificates;
CREATE POLICY cert_parent_read ON public.certificates AS PERMISSIVE FOR SELECT TO public
  USING ((student_id IN ( SELECT parent_students.student_id
   FROM parent_students
  WHERE (parent_students.parent_id = ( SELECT auth.uid() AS uid)))));

DROP POLICY IF EXISTS el_platform ON public.error_log;
CREATE POLICY el_platform ON public.error_log AS PERMISSIVE FOR SELECT TO public
  USING (is_platform_admin());

DROP POLICY IF EXISTS feedback_read ON public.feedback;
CREATE POLICY feedback_read ON public.feedback AS PERMISSIVE FOR SELECT TO public
  USING ((is_platform_admin() OR (school_id = my_school_id())));

DROP POLICY IF EXISTS feedback_update ON public.feedback;
CREATE POLICY feedback_update ON public.feedback AS PERMISSIVE FOR UPDATE TO public
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

DROP POLICY IF EXISTS financial_years_school_read ON public.financial_years;
CREATE POLICY financial_years_school_read ON public.financial_years AS PERMISSIVE FOR SELECT TO authenticated
  USING (((school_id = my_school_id()) OR is_platform_admin()));

DROP POLICY IF EXISTS food_dispenses_school_insert ON public.food_dispenses;
CREATE POLICY food_dispenses_school_insert ON public.food_dispenses AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((school_id = my_school_id()) AND (my_role() = ANY (ARRAY['owner'::user_role, 'admin'::user_role, 'accountant'::user_role]))));

DROP POLICY IF EXISTS food_dispenses_school_select ON public.food_dispenses;
CREATE POLICY food_dispenses_school_select ON public.food_dispenses AS PERMISSIVE FOR SELECT TO public
  USING ((school_id = my_school_id()));

DROP POLICY IF EXISTS food_inventory_school_all ON public.food_inventory;
CREATE POLICY food_inventory_school_all ON public.food_inventory AS PERMISSIVE FOR ALL TO public
  USING ((school_id = my_school_id()))
  WITH CHECK ((school_id = my_school_id()));

DROP POLICY IF EXISTS grade_fees_read ON public.grade_fees;
CREATE POLICY grade_fees_read ON public.grade_fees AS PERMISSIVE FOR SELECT TO public
  USING ((school_id = my_school_id()));

DROP POLICY IF EXISTS grade_fees_write ON public.grade_fees;
CREATE POLICY grade_fees_write ON public.grade_fees AS PERMISSIVE FOR ALL TO public
  USING (((school_id = my_school_id()) AND (my_role() = ANY (ARRAY['owner'::user_role, 'admin'::user_role]))))
  WITH CHECK (((school_id = my_school_id()) AND (my_role() = ANY (ARRAY['owner'::user_role, 'admin'::user_role]))));

DROP POLICY IF EXISTS guardian_invites_school_insert ON public.guardian_invites;
CREATE POLICY guardian_invites_school_insert ON public.guardian_invites AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((school_id = my_school_id()) AND (my_role() = ANY (ARRAY['owner'::user_role, 'admin'::user_role, 'accountant'::user_role]))));

DROP POLICY IF EXISTS guardian_invites_school_select ON public.guardian_invites;
CREATE POLICY guardian_invites_school_select ON public.guardian_invites AS PERMISSIVE FOR SELECT TO public
  USING ((school_id = my_school_id()));

DROP POLICY IF EXISTS guardian_invites_school_update ON public.guardian_invites;
CREATE POLICY guardian_invites_school_update ON public.guardian_invites AS PERMISSIVE FOR UPDATE TO public
  USING ((school_id = my_school_id()))
  WITH CHECK ((school_id = my_school_id()));

DROP POLICY IF EXISTS intel_flags_read ON public.intelligence_flags;
CREATE POLICY intel_flags_read ON public.intelligence_flags AS PERMISSIVE FOR SELECT TO public
  USING ((school_id = my_school_id()));

DROP POLICY IF EXISTS inventory_dispenses_school_insert ON public.inventory_dispenses;
CREATE POLICY inventory_dispenses_school_insert ON public.inventory_dispenses AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((school_id = my_school_id()) AND (my_role() = ANY (ARRAY['owner'::user_role, 'admin'::user_role, 'accountant'::user_role]))));

DROP POLICY IF EXISTS inventory_dispenses_school_select ON public.inventory_dispenses;
CREATE POLICY inventory_dispenses_school_select ON public.inventory_dispenses AS PERMISSIVE FOR SELECT TO public
  USING ((school_id = my_school_id()));

DROP POLICY IF EXISTS journal_entries_staff_rw ON public.journal_entries;
CREATE POLICY journal_entries_staff_rw ON public.journal_entries AS PERMISSIVE FOR ALL TO public
  USING (((school_id = ( SELECT profiles.school_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))) AND (( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))) = ANY (ARRAY['owner'::user_role, 'admin'::user_role, 'accountant'::user_role]))))
  WITH CHECK (((school_id = ( SELECT profiles.school_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))) AND (( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))) = ANY (ARRAY['owner'::user_role, 'admin'::user_role, 'accountant'::user_role]))));

DROP POLICY IF EXISTS own_consents_insert ON public.legal_consents;
CREATE POLICY own_consents_insert ON public.legal_consents AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

DROP POLICY IF EXISTS own_consents_select ON public.legal_consents;
CREATE POLICY own_consents_select ON public.legal_consents AS PERMISSIVE FOR SELECT TO public
  USING ((( SELECT auth.uid() AS uid) = user_id));

DROP POLICY IF EXISTS notif_update ON public.notifications;
CREATE POLICY notif_update ON public.notifications AS PERMISSIVE FOR UPDATE TO public
  USING ((((audience = 'staff'::text) AND (school_id = my_school_id())) OR ((audience = 'guardian'::text) AND (guardian_id = ( SELECT auth.uid() AS uid)))));

DROP POLICY IF EXISTS organizations_owner_read ON public.organizations;
CREATE POLICY organizations_owner_read ON public.organizations AS PERMISSIVE FOR SELECT TO authenticated
  USING (((owner_id = auth.uid()) OR is_platform_admin()));

DROP POLICY IF EXISTS ps_parent_read ON public.parent_students;
CREATE POLICY ps_parent_read ON public.parent_students AS PERMISSIVE FOR SELECT TO public
  USING ((parent_id = ( SELECT auth.uid() AS uid)));

DROP POLICY IF EXISTS payments_parent_read ON public.payments;
CREATE POLICY payments_parent_read ON public.payments AS PERMISSIVE FOR SELECT TO public
  USING ((fee_id IN ( SELECT f.id
   FROM (student_fees f
     JOIN parent_students ps ON ((ps.student_id = f.student_id)))
  WHERE (ps.parent_id = ( SELECT auth.uid() AS uid)))));

DROP POLICY IF EXISTS payroll_items_rw ON public.payroll_items;
CREATE POLICY payroll_items_rw ON public.payroll_items AS PERMISSIVE FOR ALL TO public
  USING ((run_id IN ( SELECT payroll_runs.id
   FROM payroll_runs
  WHERE (payroll_runs.school_id IN ( SELECT profiles.school_id
           FROM profiles
          WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = ANY (ARRAY['owner'::user_role, 'admin'::user_role, 'accountant'::user_role]))))))))
  WITH CHECK ((run_id IN ( SELECT payroll_runs.id
   FROM payroll_runs
  WHERE (payroll_runs.school_id IN ( SELECT profiles.school_id
           FROM profiles
          WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = ANY (ARRAY['owner'::user_role, 'admin'::user_role, 'accountant'::user_role]))))))));

DROP POLICY IF EXISTS payroll_runs_rw ON public.payroll_runs;
CREATE POLICY payroll_runs_rw ON public.payroll_runs AS PERMISSIVE FOR ALL TO public
  USING ((school_id IN ( SELECT profiles.school_id
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = ANY (ARRAY['owner'::user_role, 'admin'::user_role, 'accountant'::user_role]))))))
  WITH CHECK ((school_id IN ( SELECT profiles.school_id
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = ANY (ARRAY['owner'::user_role, 'admin'::user_role, 'accountant'::user_role]))))));

DROP POLICY IF EXISTS payroll_settings_rw ON public.payroll_settings;
CREATE POLICY payroll_settings_rw ON public.payroll_settings AS PERMISSIVE FOR ALL TO public
  USING ((school_id IN ( SELECT profiles.school_id
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = ANY (ARRAY['owner'::user_role, 'admin'::user_role, 'accountant'::user_role]))))))
  WITH CHECK ((school_id IN ( SELECT profiles.school_id
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = ANY (ARRAY['owner'::user_role, 'admin'::user_role]))))));

DROP POLICY IF EXISTS pending_insert ON public.pending_payments;
CREATE POLICY pending_insert ON public.pending_payments AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((guardian_id = ( SELECT auth.uid() AS uid)) AND (school_id = my_school_id())));

DROP POLICY IF EXISTS pc_read ON public.platform_countries;
CREATE POLICY pc_read ON public.platform_countries AS PERMISSIVE FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS "service role only" ON public.receipt_verifications;
CREATE POLICY "service role only" ON public.receipt_verifications AS PERMISSIVE FOR ALL TO public
  USING (false);

DROP POLICY IF EXISTS school_memberships_self_read ON public.school_memberships;
CREATE POLICY school_memberships_self_read ON public.school_memberships AS PERMISSIVE FOR SELECT TO authenticated
  USING (((user_id = auth.uid()) OR ((school_id = my_school_id()) AND (my_role() = ANY (ARRAY['owner'::user_role, 'admin'::user_role]))) OR is_platform_admin()));

DROP POLICY IF EXISTS "service role only" ON public.school_registrations;
CREATE POLICY "service role only" ON public.school_registrations AS PERMISSIVE FOR ALL TO public
  USING (false);

DROP POLICY IF EXISTS platform_admin_schools_update ON public.schools;
CREATE POLICY platform_admin_schools_update ON public.schools AS PERMISSIVE FOR UPDATE TO public
  USING (is_platform_admin());

DROP POLICY IF EXISTS schools_read ON public.schools;
CREATE POLICY schools_read ON public.schools AS PERMISSIVE FOR SELECT TO public
  USING ((is_platform_admin() OR (id = my_school_id())));

DROP POLICY IF EXISTS subscriptions_rw ON public.subscriptions;
CREATE POLICY subscriptions_rw ON public.subscriptions AS PERMISSIVE FOR ALL TO public
  USING ((is_platform_admin() OR (school_id = ( SELECT profiles.school_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))))
  WITH CHECK ((is_platform_admin() OR (school_id = ( SELECT profiles.school_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))));

-- ---------------------------------------------------------------------------
-- Storage buckets and the receipt policies (production definitions)
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
  ('logos', 'logos', true, NULL, NULL),
  ('subscription-receipts', 'subscription-receipts', false, 5242880, '{image/jpeg,image/png,image/webp,application/pdf}'::text[]),
  ('invoices', 'invoices', false, 2097152, '{application/pdf}'::text[]),
  ('certificates', 'certificates', false, 5242880, '{image/jpeg,image/png,image/webp,application/pdf}'::text[]),
  ('fee-receipts', 'fee-receipts', false, 5242880, '{image/jpeg,image/png,image/webp,application/pdf}'::text[])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS fee_receipts_school_upload ON storage.objects;
CREATE POLICY fee_receipts_school_upload ON storage.objects AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((bucket_id = 'fee-receipts'::text) AND ((storage.foldername(name))[1] = ( SELECT (profiles.school_id)::text AS school_id
   FROM profiles
  WHERE (profiles.id = auth.uid())))));

DROP POLICY IF EXISTS fee_receipts_staff_read ON storage.objects;
CREATE POLICY fee_receipts_staff_read ON storage.objects AS PERMISSIVE FOR SELECT TO public
  USING (((bucket_id = 'fee-receipts'::text) AND (is_platform_admin() OR (((storage.foldername(name))[1] = ( SELECT (profiles.school_id)::text AS school_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND (my_role() = ANY (ARRAY['owner'::user_role, 'admin'::user_role, 'accountant'::user_role]))))));

DROP POLICY IF EXISTS subscription_receipts_read ON storage.objects;
CREATE POLICY subscription_receipts_read ON storage.objects AS PERMISSIVE FOR SELECT TO public
  USING (((bucket_id = 'subscription-receipts'::text) AND (((storage.foldername(name))[1] = ( SELECT (profiles.school_id)::text AS school_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) OR is_platform_admin())));

DROP POLICY IF EXISTS subscription_receipts_school_upload ON storage.objects;
CREATE POLICY subscription_receipts_school_upload ON storage.objects AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((bucket_id = 'subscription-receipts'::text) AND ((storage.foldername(name))[1] = ( SELECT (profiles.school_id)::text AS school_id
   FROM profiles
  WHERE (profiles.id = auth.uid())))));

-- ---------------------------------------------------------------------------
-- Function EXECUTE grants (production state)
-- Default: authenticated only. Exceptions below: service-role-only (payment
-- gateway internals) and functions production leaves executable by PUBLIC/anon.
-- ---------------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind IN ('f', 'p')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig);
  END LOOP;

  -- service-role only
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('_confirm_thawani_payment_core', 'confirm_gateway_payment',
                        'mark_gateway_payment_failed', 'record_thawani_payment', 'set_gateway_session')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
  END LOOP;

  -- executable by PUBLIC (as in production)
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('approve_payment', 'cafeteria_subscribers', 'cancel_meal_purchase',
                        'check_financial_year_open', 'check_journal_balanced',
                        'create_manual_journal_entry', 'delete_payment_within_window',
                        'edit_payment_within_window', 'find_payment_by_invoice_number',
                        'food_purchase', 'has_permission', 'latest_editable_payment',
                        'mark_meal_purchase_paid', 'meal_purchases_list', 'my_permissions',
                        'my_subscription_status', 'next_expense_code', 'next_invoice_number',
                        'record_payment', 'reject_payment', 'school_pricing_complete',
                        'set_bundle_setting', 'set_custom_section_names', 'set_user_permission',
                        'staff_permissions_list', 'student_payment_tracker', 'test_dummy_function',
                        'update_meal_plan')
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO PUBLIC', r.sig);
  END LOOP;
END $$;

RESET check_function_bodies;
