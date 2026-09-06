set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public._confirm_thawani_payment_core(p_pending_id uuid, p_provider_ref text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- Defense-in-depth: this core is Thawani-specific. Both current callers
  -- already filter on method='thawani' upstream, but the RPC itself must
  -- not trust that.
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
$function$
;

CREATE OR REPLACE FUNCTION public.acc_id(p_code text)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select id from public.accounts where school_id = public.my_school_id() and code = p_code limit 1;
$function$
;

CREATE OR REPLACE FUNCTION public.accept_staff_invite()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_email  text;
  v_invite record;
begin
  select email into v_email from auth.users where id = auth.uid();
  if v_email is null then
    return jsonb_build_object('ok', false, 'reason', 'no_user');
  end if;

  -- ابحث عن دعوة معلّقة بهذا البريد
  select * into v_invite from public.staff_invites
  where email = lower(v_email) and status = 'pending' limit 1;

  if v_invite.id is null then
    return jsonb_build_object('ok', false, 'reason', 'no_invite');
  end if;

  -- أنشئ/حدّث ملف المستخدم بالدور والمدرسة
  insert into public.profiles (id, school_id, role, full_name)
  values (auth.uid(), v_invite.school_id, v_invite.role, coalesce(v_invite.full_name, split_part(v_email, '@', 1)))
  on conflict (id) do update
    set school_id = v_invite.school_id, role = v_invite.role;

  update public.staff_invites
  set status = 'accepted', accepted_at = now()
  where id = v_invite.id;

  return jsonb_build_object('ok', true, 'role', v_invite.role, 'school_id', v_invite.school_id);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.account_balances()
 RETURNS TABLE(account_id uuid, code text, name text, type text, balance numeric, is_active boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    a.id,
    a.code,
    a.name,
    a.type,
    coalesce(round(sum(l.debit - l.credit), 3), 0) as balance,
    a.is_active
  from public.accounts a
  left join public.journal_lines l
    on l.account_id = a.id and l.school_id = a.school_id
  where a.school_id = public.my_school_id()
  group by a.id, a.code, a.name, a.type, a.is_active
  order by a.code;
$function$
;

CREATE OR REPLACE FUNCTION public.accrue_student_fee()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_entry uuid;
  v_acc_receivable uuid;
  v_acc_revenue uuid;
BEGIN
  IF coalesce(NEW.total, 0) <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_acc_receivable FROM public.accounts WHERE school_id = NEW.school_id AND code = '1210';
  SELECT id INTO v_acc_revenue FROM public.accounts WHERE school_id = NEW.school_id AND code = coalesce(NEW.revenue_account_code, '4100');

  IF v_acc_receivable IS NOT NULL AND v_acc_revenue IS NOT NULL THEN
    INSERT INTO public.journal_entries (school_id, description, reference, fee_id, created_by)
    VALUES (
      NEW.school_id,
      'استحقاق فاتورة: ' || coalesce(NEW.description, ''),
      'ACCR-' || left(NEW.id::text, 8),
      NEW.id,
      auth.uid()
    )
    RETURNING id INTO v_entry;

    INSERT INTO public.journal_lines (school_id, entry_id, account_id, debit, credit) VALUES
      (NEW.school_id, v_entry, v_acc_receivable, NEW.total, 0),
      (NEW.school_id, v_entry, v_acc_revenue, 0, NEW.total);
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.add_annual_meal_fee(p_student uuid, p_plan uuid, p_annual_amount numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_school uuid;
  v_role   user_role;
  v_plan_name text;
begin
  -- مصدر السياق الموحّد (بدل القراءة المباشرة من profiles)
  v_school := public.my_school_id();
  v_role   := public.my_role();

  if v_school is null then raise exception 'لا مدرسة مرتبطة بحسابك'; end if;
  if v_role not in ('owner','admin') then raise exception 'غير مصرّح'; end if;

  if not exists (select 1 from public.students where id = p_student and school_id = v_school) then
    raise exception 'الطالب غير موجود في مدرستك';
  end if;

  select name into v_plan_name from public.meal_plans where id = p_plan and school_id = v_school;
  if v_plan_name is null then raise exception 'الباقة غير موجودة في مدرستك'; end if;

  -- التحقق على (الطالب + الخطة) معاً — يطابق الفهرس الفريد uq_meal_subs_student_plan
  if not exists (
    select 1 from public.meal_subscriptions
    where student_id = p_student and school_id = v_school and plan_id = p_plan
  ) then
    insert into public.meal_subscriptions(school_id, student_id, plan_id, billing)
    values (v_school, p_student, p_plan, 'annual');
  end if;

  if coalesce(p_annual_amount, 0) > 0 then
    insert into public.student_fees(school_id, student_id, description, total, paid, due_date)
    values (v_school, p_student,
            'رسوم التغذية السنوية' || coalesce(' — ' || v_plan_name, ''),
            p_annual_amount, 0, current_date + interval '30 days');
  end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.add_employee(p_full_name text, p_job_title text DEFAULT NULL::text, p_nationality text DEFAULT 'OM'::text, p_basic numeric DEFAULT 0, p_allowance numeric DEFAULT 0, p_iban text DEFAULT NULL::text, p_code text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_id_type text DEFAULT 'CIVIL'::text, p_id_number text DEFAULT NULL::text, p_bank_name text DEFAULT NULL::text, p_bank_account_no text DEFAULT NULL::text, p_subject_to_pasi boolean DEFAULT true)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_school_id uuid;
  v_role      user_role;
  v_code      text;
  v_emp_id    uuid;
  v_seq       int;
  v_nat       text;
begin
  -- مصدر السياق الموحّد (بدل القراءة المباشرة من profiles)
  v_school_id := public.my_school_id();
  v_role      := public.my_role();

  if v_school_id is null then
    raise exception 'لا مدرسة مرتبطة بحسابك';
  end if;
  if v_role not in ('owner', 'admin') then
    raise exception 'غير مصرّح: إضافة الموظفين للمدير أو الإداري فقط';
  end if;
  if coalesce(trim(p_full_name), '') = '' then
    raise exception 'اسم الموظف مطلوب';
  end if;

  -- توحيد ترميز الجنسية
  v_nat := case
    when lower(coalesce(trim(p_nationality),'om')) in ('om','omani','عماني') then 'OM'
    else 'NON_OM' end;

  if coalesce(trim(p_code), '') = '' then
    select count(*) + 1 into v_seq from public.employees where school_id = v_school_id;
    v_code := 'EMP-' || lpad(v_seq::text, 3, '0');
    while exists (select 1 from public.employees where school_id = v_school_id and code = v_code) loop
      v_seq := v_seq + 1;
      v_code := 'EMP-' || lpad(v_seq::text, 3, '0');
    end loop;
  else
    v_code := trim(p_code);
    if exists (select 1 from public.employees where school_id = v_school_id and code = v_code) then
      raise exception 'الرقم الوظيفي % مستخدم بالفعل', v_code;
    end if;
  end if;

  insert into public.employees (
    school_id, code, full_name, job_title, nationality,
    basic_salary, other_allowance, iban, email,
    id_type, id_number, bank_name, bank_account_no, subject_to_pasi
  ) values (
    v_school_id, v_code, trim(p_full_name), nullif(trim(p_job_title), ''),
    v_nat,
    coalesce(p_basic, 0), coalesce(p_allowance, 0),
    nullif(trim(p_iban), ''), nullif(lower(trim(p_email)), ''),
    coalesce(nullif(trim(p_id_type),''), 'CIVIL'),
    nullif(trim(p_id_number), ''),
    nullif(trim(p_bank_name), ''),
    nullif(trim(p_bank_account_no), ''),
    case when v_nat = 'NON_OM' then false else coalesce(p_subject_to_pasi, true) end
  )
  returning id into v_emp_id;

  insert into public.audit_log (school_id, actor_id, action, details)
  values (v_school_id, auth.uid(), 'إضافة موظف', trim(p_full_name) || ' (' || v_code || ')');

  return v_emp_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.add_student(p_full_name text, p_grade text, p_section text DEFAULT NULL::text, p_guardian_name text DEFAULT NULL::text, p_guardian_phone text DEFAULT NULL::text, p_guardian_email text DEFAULT NULL::text, p_birth_date date DEFAULT NULL::date, p_gender text DEFAULT NULL::text, p_code text DEFAULT NULL::text, p_annual_fee numeric DEFAULT 0, p_country_code text DEFAULT '968'::text, p_transport_type text DEFAULT 'none'::text, p_discount_pct numeric DEFAULT 0)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_school_id uuid; v_role user_role; v_code text;
  v_student_id uuid; v_seq int; v_phone text;
begin
  -- مصدر السياق الموحّد (بدل القراءة المباشرة من profiles)
  v_school_id := public.my_school_id();
  v_role      := public.my_role();

  if v_school_id is null then raise exception 'لا مدرسة مرتبطة بحسابك'; end if;
  if v_role not in ('owner','admin') then
    raise exception 'غير مصرّح: إضافة الطلاب للمدير أو الإداري فقط'; end if;
  if coalesce(trim(p_full_name),'') = '' then raise exception 'اسم الطالب مطلوب'; end if;
  if coalesce(trim(p_grade),'') = '' then raise exception 'الصف/المرحلة مطلوب'; end if;
  if coalesce(trim(p_section),'') = '' then raise exception 'الشعبة مطلوبة'; end if;
  if coalesce(p_annual_fee,0) <= 0 then raise exception 'الرسوم السنوية مطلوبة ويجب أن تكون أكبر من صفر'; end if;
  if p_discount_pct is not null and (p_discount_pct < 0 or p_discount_pct > 100) then
    raise exception 'نسبة التخفيض يجب أن تكون بين 0 و 100'; end if;

  v_phone := public.normalize_phone(p_guardian_phone, coalesce(p_country_code,'968'));
  if v_phone is null then
    raise exception 'رقم ولي الأمر مطلوب لتمكينه من متابعة أبنائه'; end if;
  if not public.is_valid_gulf_phone(v_phone) then
    raise exception 'رقم ولي الأمر غير صالح: يجب أن يكون رقماً عُمانياً صحيحاً (8 خانات تبدأ بـ 7 أو 9)'; end if;

  if coalesce(trim(p_code),'') = '' then
    select count(*) + 1 into v_seq from public.students where school_id = v_school_id;
    v_code := 'STU-' || lpad(v_seq::text, 3, '0');
    while exists (select 1 from public.students where school_id = v_school_id and code = v_code) loop
      v_seq := v_seq + 1;
      v_code := 'STU-' || lpad(v_seq::text, 3, '0');
    end loop;
  else
    v_code := trim(p_code);
    if exists (select 1 from public.students where school_id = v_school_id and code = v_code) then
      raise exception 'الرقم المدرسي % مستخدم بالفعل', v_code; end if;
  end if;

  insert into public.students (
    school_id, code, full_name, grade, section,
    guardian_name, guardian_phone, guardian_email,
    birth_date, gender, annual_fee, transport_type, discount_pct
  ) values (
    v_school_id, v_code, trim(p_full_name), trim(p_grade), nullif(trim(p_section),''),
    nullif(trim(p_guardian_name),''), v_phone, nullif(trim(p_guardian_email),''),
    p_birth_date, nullif(trim(p_gender),''), coalesce(p_annual_fee,0),
    coalesce(nullif(trim(p_transport_type),''), 'none'), coalesce(p_discount_pct,0)
  ) returning id into v_student_id;

  if coalesce(p_annual_fee,0) > 0 then
    insert into public.student_fees (school_id, student_id, description, total, paid, due_date)
    values (v_school_id, v_student_id,
            'الرسوم الدراسية السنوية' ||
              case when coalesce(p_transport_type,'none') = 'school'
                   then ' (شاملة النقل)' else '' end,
            p_annual_fee, 0, current_date + interval '30 days');
  end if;

  insert into public.audit_log (school_id, actor_id, action, details)
  values (v_school_id, auth.uid(), 'إضافة طالب', trim(p_full_name) || ' (' || v_code || ')');

  return v_student_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.add_student_fee(p_student_id uuid, p_description text, p_total numeric, p_due_date date DEFAULT NULL::date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_school uuid;
  v_fee_id uuid;
begin
  v_school := public.my_school_id();
  if public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح بإضافة الرسوم';
  end if;
  if not exists (select 1 from public.students
                 where id = p_student_id and school_id = v_school) then
    raise exception 'الطالب غير موجود في مدرستك';
  end if;
  if coalesce(p_total, 0) <= 0 then
    raise exception 'قيمة الرسم يجب أن تكون أكبر من صفر';
  end if;

  insert into public.student_fees (school_id, student_id, description, total, paid, due_date)
  values (
    v_school, p_student_id,
    coalesce(nullif(trim(p_description), ''), 'رسوم دراسية'),
    p_total, 0,
    coalesce(p_due_date, current_date + interval '30 days')
  )
  returning id into v_fee_id;

  -- القيد المحاسبي يُنشأ تلقائياً عبر trigger accrue_student_fee

  insert into public.audit_log (school_id, actor_id, action, details)
  values (v_school, auth.uid(), 'إضافة رسم',
          coalesce(p_description, 'رسوم') || ' — ' || p_total::text);

  return v_fee_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.approve_certificate_request(p_request_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_school uuid;
  v_req record;
  v_cert_id uuid;
begin
  v_school := public.my_school_id();
  if public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح';
  end if;

  select * into v_req from public.certificate_requests where id = p_request_id and school_id = v_school;
  if v_req is null then raise exception 'الطلب غير موجود في مدرستك'; end if;
  if v_req.status <> 'pending' then raise exception 'هذا الطلب تمت معالجته مسبقًا'; end if;

  -- تصدر الشهادة بنفس منطق الإصدار اليدوي (يتحقق من السداد لبراءة الذمة تلقائيًا)
  v_cert_id := public.generate_certificate(v_req.student_id, v_req.kind);

  update public.certificate_requests
  set status = 'approved', certificate_id = v_cert_id, reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_request_id;

  return v_cert_id;
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
  v_school uuid;
  v_pp record;
  v_result jsonb;
begin
  v_school := public.my_school_id();
  if public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح بالاعتماد';
  end if;
  select * into v_pp from public.pending_payments where id = p_id and school_id = v_school;
  if v_pp is null then raise exception 'الدفعة غير موجودة'; end if;
  if v_pp.status <> 'pending' then raise exception 'الدفعة سبق البتّ فيها'; end if;

  v_result := public.record_payment(v_pp.fee_id, v_pp.amount, v_pp.method, current_date);

  update public.pending_payments
  set status = 'approved', resolved_at = now(), resolved_by = auth.uid()
  where id = p_id;

  insert into public.notifications(school_id, audience, guardian_id, body)
  values (v_school, 'guardian', v_pp.guardian_id,
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
end $function$
;

CREATE OR REPLACE FUNCTION public.approve_salary_request(p_request_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r record;
begin
  if public.my_role() <> 'owner' then
    raise exception 'غير مصرّح: اعتماد الرواتب للمدير فقط';
  end if;

  select * into r from public.salary_requests
    where id = p_request_id and school_id = public.my_school_id() and status = 'pending';
  if not found then raise exception 'الطلب غير موجود أو سبق البتّ فيه'; end if;

  update public.employees
    set basic_salary = r.new_basic, other_allowance = r.new_allow
    where id = r.employee_id and school_id = public.my_school_id();

  update public.salary_requests
    set status = 'approved', decided_by = auth.uid(), decided_at = now()
    where id = p_request_id;

  insert into public.audit_log(school_id,actor_id,action,details)
  values(public.my_school_id(), auth.uid(), 'اعتماد تعديل راتب', r.employee_id::text);
end; $function$
;

CREATE OR REPLACE FUNCTION public.approve_subscription(p_sub_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare s record;
begin
  if not public.is_platform_admin() then
    raise exception 'غير مصرّح: اعتماد الاشتراكات لمدير المنصة فقط';
  end if;

  select * into s from public.subscriptions
    where id = p_sub_id and status = 'pending';
  if not found then raise exception 'الاشتراك غير موجود أو ليس بانتظار الاعتماد'; end if;

  update public.subscriptions set status = 'active' where id = p_sub_id;

  insert into public.audit_log(school_id, actor_id, action, details)
  values(s.school_id, auth.uid(), 'اعتماد اشتراك (تحويل بنكي)', p_sub_id::text);
end; $function$
;

CREATE OR REPLACE FUNCTION public.assistant_context()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_school uuid; v_role text; v_copilot jsonb; v_school_name text;
begin
  v_school := public.my_school_id();
  v_role := public.my_role()::text;
  if v_school is null then
    return jsonb_build_object('ok', false, 'error', 'no_school');
  end if;
  select name into v_school_name from public.schools where id = v_school;
  v_copilot := public.school_copilot();
  return jsonb_build_object('ok', true, 'role', v_role, 'school_name', v_school_name, 'data', v_copilot);
end; $function$
;

CREATE OR REPLACE FUNCTION public.assistant_search_help(q text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_role text; v_out jsonb;
begin
  v_role := public.my_role()::text;
  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_out
  from (
    select slug, category, page_route, title, summary, body, steps
    from public.help_articles
    where is_published
      and (cardinality(role_scope) = 0 or v_role = any (role_scope))
      and (
        q is null or length(trim(q)) = 0
        or title ilike '%'||q||'%' or summary ilike '%'||q||'%'
        or body ilike '%'||q||'%' or category ilike '%'||q||'%'
        or exists (select 1 from unnest(keywords) k where k ilike '%'||q||'%')
      )
    order by
      case when q is not null and title ilike '%'||q||'%' then 0 else 1 end,
      sort_order
    limit 8
  ) t;
  return v_out;
end; $function$
;

CREATE OR REPLACE FUNCTION public.available_plans()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_school  uuid;
  v_current text;
  v_rows    jsonb;
begin
  v_school := my_school_id();

  select coalesce(sub.plan::text, 'starter') into v_current
  from public.subscriptions sub
  where sub.school_id = v_school and sub.status in ('active','trial','pending')
  order by sub.created_at desc limit 1;

  select jsonb_agg(
    jsonb_build_object(
      'code', p.code,
      'name', p.name_ar,
      'price', p.price_omr,
      'price_regular', case
        when p.price_regular is not null
         and (p.offer_ends_at is null or p.offer_ends_at >= current_date)
        then p.price_regular else null end,
      'offer_ends_at', case
        when p.offer_ends_at is not null and p.offer_ends_at >= current_date
        then p.offer_ends_at else null end,
      'discount_pct', case
        when p.price_regular is not null and p.price_regular > 0
         and (p.offer_ends_at is null or p.offer_ends_at >= current_date)
        then round((1 - p.price_omr / p.price_regular) * 100)
        else null end,
      'max_students', p.max_students,
      'max_staff', p.max_staff,
      'max_branches', p.max_branches,
      'is_current', (p.code = coalesce(v_current, 'starter'))
    ) order by p.sort_order
  ) into v_rows
  from public.plans p
  where p.is_active;

  return jsonb_build_object('ok', true, 'plans', coalesce(v_rows, '[]'::jsonb));
end;
$function$
;

CREATE OR REPLACE FUNCTION public.backup_status()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_school uuid;
  v_last   timestamptz;
  v_days   int;
begin
  v_school := my_school_id();
  if v_school is null or my_role() not in ('owner','admin') then
    return jsonb_build_object('ok', false);
  end if;

  select last_backup into v_last
  from public.backup_log where school_id = v_school;

  if v_last is null then
    return jsonb_build_object(
      'ok', true, 'ever', false, 'should_remind', true,
      'days_since', null,
      'message', 'لم تأخذ نسخة احتياطية بعد — ننصح بتحميل نسخة من بيانات مدرستك.'
    );
  end if;

  v_days := extract(day from (now() - v_last))::int;

  return jsonb_build_object(
    'ok', true, 'ever', true,
    'last_backup', v_last,
    'days_since', v_days,
    'should_remind', (v_days >= 30),
    'message', case
      when v_days >= 30 then 'مضى ' || v_days || ' يوماً على آخر نسخة احتياطية — ننصح بتحميل نسخة جديدة.'
      else null
    end
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.balance_sheet_asof(p_asof date)
 RETURNS TABLE(section text, code text, name text, balance numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    a.type as section, a.code, a.name,
    case when a.type in ('asset')
      then coalesce(round(sum(l.debit - l.credit), 3), 0)
      else coalesce(round(sum(l.credit - l.debit), 3), 0)
    end as balance
  from public.accounts a
  left join public.journal_lines l on l.account_id = a.id
  left join public.journal_entries e on e.id = l.entry_id
    and e.entry_date <= p_asof
  where a.school_id = public.my_school_id()
    and a.type in ('asset', 'liability', 'equity')
  group by a.id, a.code, a.name, a.type
  having coalesce(round(sum(l.debit - l.credit), 3), 0) <> 0
  order by a.type, a.code;
$function$
;

CREATE OR REPLACE FUNCTION public.bill_cafeteria(p_month text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_school uuid;
  v_count int := 0;
  r record;
begin
  v_school := public.my_school_id();
  if v_school is null or public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح بفوترة التغذية';
  end if;
  if p_month is null or p_month !~ '^\d{4}-\d{2}$' then
    raise exception 'صيغة الشهر غير صحيحة (YYYY-MM)';
  end if;

  perform public.ensure_cafeteria_account();

  for r in
    select ms.id as sub_id, ms.student_id, mp.name as plan_name, mp.fee
    from public.meal_subscriptions ms
    join public.meal_plans mp on mp.id = ms.plan_id
    join public.students st on st.id = ms.student_id
    where ms.school_id = v_school and st.status = 'active'
      and mp.plan_type = 'monthly'
      and coalesce(ms.last_billed_month,'') <> p_month
  loop
    insert into public.student_fees(school_id, student_id, description, total, paid, due_date)
    values (v_school, r.student_id,
            'تغذية مدرسية شهرية — ' || r.plan_name || ' (' || p_month || ')',
            r.fee, 0, (p_month || '-01')::date);
    -- ⚠️ إصلاح: التحديث يستهدف صفّ الاشتراك المحدَّد (ms.id) لا كل اشتراكات
    -- الطالب — بدونه، طالب عنده خطتان شهريتان (فطور+غداء) كانت أول خطة
    -- تُفوتَر تُعلِّم last_billed_month على الاثنتين معاً، فتُستثنى الثانية
    -- من الحلقة فوق قبل ما تُفوتَر فعلياً — خسارة تحصيل صامتة كل شهر.
    update public.meal_subscriptions set last_billed_month = p_month
    where id = r.sub_id;
    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    raise exception 'كل المشتركين الشهريين مفوترون لهذا الشهر بالفعل';
  end if;

  return v_count;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.bill_cafeteria_student(p_student_id uuid, p_month text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_school uuid;
  r record;
  v_count int := 0;
begin
  v_school := public.my_school_id();
  if v_school is null or public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح بفوترة التغذية';
  end if;
  if p_month is null or p_month !~ '^\d{4}-\d{2}$' then
    raise exception 'صيغة الشهر غير صحيحة (YYYY-MM)';
  end if;

  perform public.ensure_cafeteria_account();

  for r in
    select mo.student_id, mp.name as plan_name, mp.fee as unit_fee, count(*) as meals_count
    from public.meal_orders mo
    join public.meal_plans mp on mp.id = mo.plan_id
    join public.students st on st.id = mo.student_id
    where mo.school_id = v_school and st.status = 'active'
      and to_char(mo.meal_date, 'YYYY-MM') = p_month
      and mo.student_id = p_student_id
    group by mo.student_id, mp.name, mp.fee
    having count(*) > 0
  loop
    if exists (
      select 1 from public.student_fees
      where student_id = r.student_id
        and description like 'تغذية مدرسية شهرية — ' || r.plan_name || '%' || p_month
    ) then
      continue;
    end if;

    insert into public.student_fees(school_id, student_id, description, total, paid, due_date)
    values (v_school, r.student_id,
            'تغذية مدرسية شهرية — ' || r.plan_name || ' (' || r.meals_count || ' وجبة × ' ||
              to_char(r.unit_fee,'FM999990.000') || ') — ' || p_month,
            r.unit_fee * r.meals_count, 0, (p_month || '-01')::date);
    v_count := v_count + 1;
  end loop;

  return jsonb_build_object('ok', true, 'invoices_created', v_count);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.block_approved_payroll_items()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare s text;
begin
  select status into s from public.payroll_runs
   where id = coalesce(new.run_id, old.run_id);
  if s in ('approved','paid') then
    raise exception 'لا يمكن تعديل سطور دورة رواتب معتمدة';
  end if;
  return coalesce(new, old);
end $function$
;

CREATE OR REPLACE FUNCTION public.block_journal_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  -- يُسمح بالتحديث فقط حين تضبط دالة العكس علم الجلسة (وسم reversed_by_entry)
  if tg_op = 'UPDATE' and current_setting('rusoom.allow_journal_flag', true) = 'on' then
    return new;
  end if;
  raise exception 'القيود المحاسبية لا تُعدّل ولا تُحذف — استخدم القيد العكسي للتصحيح';
end; $function$
;

CREATE OR REPLACE FUNCTION public.cafeteria_plans()
 RETURNS TABLE(id uuid, name text, fee numeric, plan_type text, subscribers bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح';
  end if;
  return query
  select mp.id, mp.name, mp.fee, mp.plan_type,
    (select count(*) from public.meal_subscriptions ms
       join public.students s on s.id = ms.student_id
       where ms.plan_id = mp.id and s.status = 'active') as subscribers
  from public.meal_plans mp
  where mp.school_id = public.my_school_id() and mp.active
  order by mp.created_at;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.cafeteria_subscribers()
 RETURNS TABLE(student_id uuid, student_name text, guardian text, plan_name text, fee numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح';
  end if;
  return query
  select s.id, s.full_name, s.guardian_name, mp.name, mp.fee
  from public.meal_subscriptions ms
  join public.students s on s.id = ms.student_id
  join public.meal_plans mp on mp.id = ms.plan_id
  where ms.school_id = public.my_school_id()
  order by s.full_name;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.calc_social_insurance(p_basic numeric, p_allow numeric, p_nationality text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_school uuid := public.my_school_id();
  v_emp_rate numeric; v_er_rate numeric; v_cap numeric; v_expat_exempt boolean;
  v_gross numeric; v_base numeric; v_emp numeric; v_er numeric;
begin
  select ins_emp_rate, ins_er_rate, ins_cap, ins_expat_exempt
    into v_emp_rate, v_er_rate, v_cap, v_expat_exempt
    from public.schools where id = v_school;

  v_gross := coalesce(p_basic,0) + coalesce(p_allow,0);
  -- تطبيق الحد الأقصى إن وُجد
  v_base := case when v_cap is not null then least(v_gross, v_cap) else v_gross end;

  -- إعفاء الوافد (إن كانت المدرسة تُعفيه)
  if p_nationality <> 'om' and v_expat_exempt then
    v_emp := 0; v_er := 0;
  else
    v_emp := round(v_base * v_emp_rate, 3);
    v_er := round(v_base * v_er_rate, 3);
  end if;

  return jsonb_build_object(
    'gross', v_gross,
    'employee', v_emp,
    'employer', v_er,
    'net', round(v_gross - v_emp, 3)
  );
end; $function$
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

  if not exists (select 1 from public.profiles
                 where id = auth.uid() and school_id = r.school_id
                   and role in ('owner','accountant'))
  then raise exception 'غير مصرّح: إلغاء الدورات للمدير أو المحاسب فقط'; end if;

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

CREATE OR REPLACE FUNCTION public.cashflow_forecast()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_school   uuid;
  v_rate     numeric;
  v_billed   numeric;
  v_paid     numeric;
  v_months   jsonb := '[]'::jsonb;
  m          int;
  v_start    date;
  v_end      date;
  v_due      numeric;
  v_expected numeric;
  v_label    text;
  v_total_expected numeric := 0;
  v_range_start date;
  v_range_end   date;
  v_due_by_month jsonb;
begin
  v_school := public.my_school_id();
  if v_school is null then return jsonb_build_object('error','no_school'); end if;

  if not public.intelligence_enabled('forecast') then
    return jsonb_build_object('ok', false, 'disabled', true);
  end if;

  select coalesce(sum(total),0), coalesce(sum(paid),0)
    into v_billed, v_paid
    from public.student_fees where school_id = v_school;
  v_rate := case when v_billed > 0 then least(1.0, v_paid / v_billed) else 0.85 end;

  -- استعلام واحد يجلب مستحقات كل الأشهر الستة معاً، مجمَّعة حسب شهر الاستحقاق
  v_range_start := date_trunc('month', current_date)::date;
  v_range_end   := (date_trunc('month', v_range_start) + interval '6 months')::date;

  select coalesce(jsonb_object_agg(month_key, due_amt), '{}'::jsonb)
    into v_due_by_month
  from (
    select to_char(date_trunc('month', due_date), 'YYYY-MM') as month_key,
           sum(total - paid) as due_amt
    from public.student_fees
    where school_id = v_school and paid < total
      and due_date >= v_range_start and due_date < v_range_end
    group by date_trunc('month', due_date)
  ) t;

  -- توزيع النتائج على الأشهر الستة بالذاكرة فقط — بدون أي استعلام إضافي
  for m in 0..5 loop
    v_start := v_range_start + (m || ' months')::interval;
    v_end   := (date_trunc('month', v_start) + interval '1 month')::date;
    v_label := to_char(v_start, 'YYYY-MM');

    v_due := coalesce((v_due_by_month ->> v_label)::numeric, 0);
    v_expected := round(v_due * v_rate, 3);
    v_total_expected := v_total_expected + v_expected;

    v_months := v_months || jsonb_build_object(
      'month', v_label,
      'due', round(v_due, 3),
      'expected', v_expected
    );
  end loop;

  return jsonb_build_object(
    'ok', true,
    'collection_rate', round(v_rate * 100, 1),
    'total_expected_6m', round(v_total_expected, 3),
    'months', v_months
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.certificate_requests_list(p_status text DEFAULT 'pending'::text)
 RETURNS TABLE(id uuid, student_id uuid, student_name text, parent_name text, kind text, status text, reason text, created_at timestamp with time zone, reviewed_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح';
  end if;
  return query
  select cr.id, cr.student_id, s.full_name, p.full_name, cr.kind, cr.status, cr.reason, cr.created_at, cr.reviewed_at
  from public.certificate_requests cr
  join public.students s on s.id = cr.student_id
  join public.profiles p on p.id = cr.parent_id
  where cr.school_id = public.my_school_id()
    and (p_status is null or cr.status = p_status)
  order by cr.created_at desc;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.check_and_increment_rate_limit(p_key text, p_limit integer, p_window_minutes integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_new_count int;
begin
  insert into public.rate_limits (key, count, window_start)
  values (p_key, 1, now())
  on conflict (key) do update
    set count = case
          -- نافذة منتهية: نبدأ من جديد
          when public.rate_limits.window_start < now() - (p_window_minutes || ' minutes')::interval
            then 1
          -- لسه ضمن النافذة: زيادة تصاعدية
          else public.rate_limits.count + 1
        end,
        window_start = case
          when public.rate_limits.window_start < now() - (p_window_minutes || ' minutes')::interval
            then now()
          else public.rate_limits.window_start
        end
  returning count into v_new_count;

  return v_new_count <= p_limit;
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
  select coalesce(sum(debit),0), coalesce(sum(credit),0)
    into d, c from public.journal_lines where entry_id = new.entry_id;
  -- يُفحص بعد إدراج كل السطور؛ السماح بفارق ضئيل جداً (تقريب)
  if abs(d - c) > 0.0005 then
    raise exception 'قيد غير متوازن: مدين % دائن %', d, c;
  end if;
  return new;
end; $function$
;

CREATE OR REPLACE FUNCTION public.check_rate_limit(p_key text, p_limit integer, p_window_sec integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_count int; v_start timestamptz; v_now timestamptz := now();
  v_reset timestamptz;
begin
  -- upsert ذرّي مع قفل الصفّ
  insert into public.rate_limits(key, count, window_start)
  values (p_key, 1, v_now)
  on conflict (key) do update
    set count = case
          -- نافذة جديدة: صفّر العدّاد
          when public.rate_limits.window_start < v_now - (p_window_sec || ' seconds')::interval then 1
          else public.rate_limits.count + 1
        end,
        window_start = case
          when public.rate_limits.window_start < v_now - (p_window_sec || ' seconds')::interval then v_now
          else public.rate_limits.window_start
        end
  returning count, window_start into v_count, v_start;

  v_reset := v_start + (p_window_sec || ' seconds')::interval;

  return json_build_object(
    'allowed', v_count <= p_limit,
    'remaining', greatest(0, p_limit - v_count),
    'reset_at', v_reset
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.claim_queue_batch(p_limit integer DEFAULT 20)
 RETURNS SETOF notification_queue
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  -- للعامل فقط (service role يتجاوز RLS؛ هذه حماية إضافية)
  return query
  update public.notification_queue q
    set status = 'processing', attempts = attempts + 1
    where q.id in (
      select id from public.notification_queue
      where status in ('queued','failed')
        and next_retry_at <= now()
        and attempts < max_attempts
      order by next_retry_at
      limit p_limit
      for update skip locked
    )
    returning q.*;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  delete from public.rate_limits where window_start < now() - interval '1 day';
$function$
;

CREATE OR REPLACE FUNCTION public.collection_analytics()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_school uuid := public.my_school_id();
  v_months jsonb;
  v_this_year numeric;
  v_last_year numeric;
begin
  if v_school is null then return jsonb_build_object('error','no_school'); end if;

  -- التحصيل الشهري لآخر 12 شهراً
  select jsonb_agg(jsonb_build_object('month', m, 'amount', amt) order by m)
    into v_months
  from (
    select to_char(date_trunc('month', paid_at),'YYYY-MM') as m, sum(amount) as amt
    from public.payments
    where school_id = v_school and paid_at >= (current_date - interval '12 months')
    group by date_trunc('month', paid_at)
  ) t;

  -- إجمالي هذا العام والعام الماضي (للمقارنة)
  select coalesce(sum(amount),0) into v_this_year
    from public.payments where school_id = v_school
      and extract(year from paid_at) = extract(year from current_date);
  select coalesce(sum(amount),0) into v_last_year
    from public.payments where school_id = v_school
      and extract(year from paid_at) = extract(year from current_date) - 1;

  return jsonb_build_object(
    'months', coalesce(v_months, '[]'::jsonb),
    'this_year', round(v_this_year,3),
    'last_year', round(v_last_year,3)
  );
end; $function$
;

CREATE OR REPLACE FUNCTION public.confirm_gateway_payment(p_id uuid, p_provider_ref text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  return public._confirm_thawani_payment_core(p_id, p_provider_ref);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.control_center_subscriptions()
 RETURNS TABLE(school_id uuid, school_name text, country text, plan text, status text, period_start timestamp with time zone, period_end timestamp with time zone, amount numeric)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- distinct on (s.id) + الترتيب التنازلي = أحدث اشتراك لكل مدرسة فقط.
  -- بدونها، مدرسة لها 3 اشتراكات تُنتج 3 صفوف بنفس الاسم.
  select distinct on (s.id)
    s.id,
    s.name,
    s.country,
    sub.plan::text,
    sub.status::text,
    sub.created_at,
    sub.renews_at,
    (case sub.plan::text
       when 'monthly'  then 7
       when 'yearly'   then 72
       when 'annual'   then 72
       when 'lifetime' then 350
       else 0
     end)::numeric
  from public.schools s
  left join public.subscriptions sub on sub.school_id = s.id
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

  -- ⚠️ إصلاح: كل الإجماليات أدناه تستثني المدارس المعلّمة is_test = true
  -- (مدارس اختبار داخلي لتجربة أداء المنصة)، حتى لا تلوّث بيانات مالية
  -- ومدارس تجريبية إجماليات الإيرادات والعدّادات الحقيقية.
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

  select coalesce(sum(case
      when sub.plan = 'monthly' then 7
      when sub.plan = 'yearly' then 72.0/12
      when sub.plan = 'lifetime' then 0
      else 0 end), 0)
    into v_mrr
    from public.subscriptions sub
    join public.schools s on s.id = sub.school_id and not s.is_test
    where sub.status = 'active';

  select coalesce(sum(case
      when sub.plan = 'monthly' then 84
      when sub.plan = 'yearly' then 72
      when sub.plan = 'lifetime' then 350
      else 0 end), 0)
    into v_annual
    from public.subscriptions sub
    join public.schools s on s.id = sub.school_id and not s.is_test
    where sub.status = 'active';

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

CREATE OR REPLACE FUNCTION public.copilot_gated()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.intelligence_enabled('copilot') then
    return jsonb_build_object('ok', false, 'disabled', true);
  end if;
  return public.school_copilot();
end; $function$
;

CREATE OR REPLACE FUNCTION public.create_academic_year(p_label text, p_start_date date, p_end_date date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_school uuid;
  v_id uuid;
begin
  v_school := my_school_id();
  if v_school is null or my_role() not in ('owner','admin') then
    raise exception 'غير مصرّح بإنشاء عام دراسي';
  end if;
  if coalesce(trim(p_label), '') = '' then
    raise exception 'اسم العام الدراسي مطلوب';
  end if;
  if p_start_date >= p_end_date then
    raise exception 'تاريخ البداية يجب أن يسبق تاريخ النهاية';
  end if;
  if exists (select 1 from public.academic_years
             where school_id = v_school and label = trim(p_label)) then
    raise exception 'يوجد عام دراسي بهذا الاسم بالفعل';
  end if;

  insert into public.academic_years (school_id, label, start_date, end_date)
  values (v_school, trim(p_label), p_start_date, p_end_date)
  returning id into v_id;

  insert into public.audit_log (school_id, actor_id, action, details)
  values (v_school, auth.uid(), 'إنشاء عام دراسي', trim(p_label));

  return v_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.current_academic_year()
 RETURNS TABLE(id uuid, label text, start_date date, end_date date)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select id, label, start_date, end_date
  from public.academic_years
  where school_id = my_school_id() and is_current = true;
$function$
;

CREATE OR REPLACE FUNCTION public.daily_payments_report(p_date date DEFAULT CURRENT_DATE, p_to date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_school uuid;
  v_role   text;
  v_from   date;
  v_until  date;
  v_items  jsonb;
  v_total  numeric;
  v_cash   numeric;
  v_bank   numeric;
  v_count  int;
BEGIN
  v_school := public.my_school_id();
  v_role   := public.my_role();

  IF v_school IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_school');
  END IF;

  IF v_role NOT IN ('owner','admin','accountant','platform_admin') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  -- تحديد النطاق: لو p_to فاضي، النطاق = يوم واحد (p_date)
  v_from  := p_date;
  v_until := COALESCE(p_to, p_date);

  -- تصحيح تلقائي لو انعكس الترتيب
  IF v_until < v_from THEN
    v_from  := p_to;
    v_until := p_date;
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.paid_at DESC, t.created_at DESC), '[]'::jsonb)
    INTO v_items
  FROM (
    SELECT
      st.full_name    AS student_name,
      st.code         AS student_code,
      st.grade        AS grade,
      sf.description  AS fee_description,
      p.amount        AS amount,
      p.method        AS method,
      p.paid_at       AS paid_at,
      p.created_at    AS created_at
    FROM public.payments p
    JOIN public.student_fees sf ON sf.id = p.fee_id
    JOIN public.students st     ON st.id = sf.student_id
    WHERE p.school_id = v_school
      AND p.deleted_at IS NULL
      AND p.paid_at BETWEEN v_from AND v_until
  ) t;

  SELECT
    COALESCE(SUM(p.amount), 0),
    COALESCE(SUM(p.amount) FILTER (WHERE p.method = 'cash'), 0),
    COALESCE(SUM(p.amount) FILTER (WHERE p.method <> 'cash'), 0),
    COUNT(*)
  INTO v_total, v_cash, v_bank, v_count
  FROM public.payments p
  WHERE p.school_id = v_school
    AND p.deleted_at IS NULL
    AND p.paid_at BETWEEN v_from AND v_until;

  RETURN jsonb_build_object(
    'ok', true,
    'from', v_from,
    'to', v_until,
    'is_range', v_from <> v_until,
    'count', v_count,
    'total', v_total,
    'cash', v_cash,
    'bank', v_bank,
    'items', v_items
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.dashboard_summary()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_school uuid := public.my_school_id();
  v_result jsonb;
  v_students int;
  v_employees int;
  v_fees_total numeric;
  v_fees_paid numeric;
  v_overdue int;
  v_pending_salary int;
  v_revenue numeric;
  v_expense numeric;
  v_year_start date := date_trunc('year', current_date)::date;
  v_year_end date := (date_trunc('year', current_date) + interval '1 year' - interval '1 day')::date;
begin
  if v_school is null then
    return jsonb_build_object('error', 'no_school');
  end if;

  select count(*) into v_students from public.students where school_id = v_school and status = 'active' and deleted_at is null;
  select count(*) into v_employees from public.employees where school_id = v_school and deleted_at is null;

  -- التحصيل: الإجمالي والمدفوع والمتأخر — مقيّد الآن بالسنة الميلادية
  -- الحالية (حسب تاريخ إنشاء الفاتورة) بدل جمع كل فواتير المدرسة منذ
  -- إنشائها إلى الأبد.
  select coalesce(sum(total),0), coalesce(sum(paid),0)
    into v_fees_total, v_fees_paid
    from public.student_fees
    where school_id = v_school
      and deleted_at is null
      and created_at >= v_year_start and created_at <= v_year_end + interval '1 day';

  select count(*) into v_overdue
    from public.student_fees
    where school_id = v_school and deleted_at is null and (total - paid) > 0.0005
      and due_date is not null and due_date < current_date
      and created_at >= v_year_start and created_at <= v_year_end + interval '1 day';

  select count(*) into v_pending_salary
    from public.salary_requests where school_id = v_school and status = 'pending';

  -- الإيرادات والمصروفات — مقيّدة الآن بالسنة الميلادية الحالية عبر
  -- entry_date بدل جمع كل journal_lines منذ إنشاء المدرسة إلى الأبد.
  select
    coalesce(-sum(case when a.type='revenue' then l.debit - l.credit else 0 end),0),
    coalesce( sum(case when a.type='expense' then l.debit - l.credit else 0 end),0)
    into v_revenue, v_expense
    from public.journal_lines l
    join public.journal_entries e on e.id = l.entry_id
    join public.accounts a on a.id = l.account_id and a.school_id = v_school
    where l.school_id = v_school
      and e.entry_date >= v_year_start and e.entry_date <= v_year_end;

  v_result := jsonb_build_object(
    'students', v_students,
    'employees', v_employees,
    'overdue_count', v_overdue,
    'pending_salary', v_pending_salary,
    'collection_rate', case when v_fees_total > 0 then round(v_fees_paid / v_fees_total * 100) else 100 end,
    'outstanding', round(v_fees_total - v_fees_paid, 3),
    'fees_total', round(v_fees_total, 3),
    'fees_paid', round(v_fees_paid, 3),
    'revenue', round(v_revenue, 3),
    'expense', round(v_expense, 3),
    'profit', round(v_revenue - v_expense, 3),
    'period', 'calendar_year_' || extract(year from current_date)::text
  );

  return v_result;
end; $function$
;

CREATE OR REPLACE FUNCTION public.delete_certificate(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح';
  end if;
  delete from public.certificates where id = p_id and school_id = public.my_school_id();
end;
$function$
;

CREATE OR REPLACE FUNCTION public.delete_meal_purchase(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_school uuid; v_role user_role; v_entry uuid;
begin
  v_school := public.my_school_id();
  v_role   := public.my_role();
  if v_role not in ('owner','admin','accountant') then raise exception 'غير مصرّح'; end if;

  select journal_entry_id into v_entry from public.meal_purchases where id = p_id and school_id = v_school;
  if v_entry is not null then
    perform public.reverse_journal_entry(v_entry, 'حذف سجل مشتريات وجبات');
  end if;

  delete from public.meal_purchases where id = p_id and school_id = v_school;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.enabled_countries()
 RETURNS SETOF platform_countries
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select * from public.platform_countries where enabled = true order by name_ar;
$function$
;

CREATE OR REPLACE FUNCTION public.enqueue_notification(p_channel text, p_recipient text, p_payload jsonb, p_dedupe_key text DEFAULT NULL::text, p_max_attempts integer DEFAULT 5)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id uuid;
  v_school uuid;
  v_role text;
  v_recipient_ok boolean;
begin
  v_school := public.my_school_id();
  v_role   := public.my_role()::text;

  if v_school is null then
    raise exception 'no school context for caller';
  end if;

  if v_role not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح: إرسال الإشعارات للطاقم الإداري فقط';
  end if;

  -- التحقق أن المستلم من جهات اتصال هذه المدرسة (قراءة بيانات مشروعة من profiles)
  select exists (
    select 1 from public.profiles pr
    where pr.school_id = v_school and pr.phone = p_recipient
    union
    select 1 from public.students s
    where s.school_id = v_school and s.guardian_phone = p_recipient
  ) into v_recipient_ok;

  if not v_recipient_ok then
    raise exception 'recipient % is not a known contact of this school', p_recipient;
  end if;

  insert into public.notification_queue(school_id, channel, recipient, payload, dedupe_key, max_attempts)
  values (v_school, p_channel, p_recipient, p_payload, p_dedupe_key, coalesce(p_max_attempts,5))
  on conflict (school_id, dedupe_key) where dedupe_key is not null do nothing
  returning id into v_id;

  return v_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.ensure_cafeteria_account()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_school uuid;
begin
  v_school := public.my_school_id();
  if v_school is null then return; end if;
  insert into public.accounts(school_id, code, name, type)
  select v_school, '4220', 'إيرادات التغذية المدرسية', 'revenue'
  where not exists (
    select 1 from public.accounts where school_id = v_school and code = '4220'
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.ensure_inventory_accounts()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_school uuid;
begin
  v_school := public.my_school_id();
  if v_school is null then return; end if;
  insert into public.accounts(school_id, code, name, type)
  select v_school, '1310', 'مخزون الكتب والزي المدرسي', 'asset'
  where not exists (select 1 from public.accounts where school_id = v_school and code = '1310');
  insert into public.accounts(school_id, code, name, type)
  select v_school, '5520', 'تكلفة المبيعات (كتب وزي)', 'expense'
  where not exists (select 1 from public.accounts where school_id = v_school and code = '5520');
end;
$function$
;

CREATE OR REPLACE FUNCTION public.ensure_meal_cost_accounts()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_school uuid;
begin
  v_school := public.my_school_id();
  if v_school is null then return; end if;
  insert into public.accounts(school_id, code, name, type)
  select v_school, '5230', 'تكلفة الوجبات (تغذية)', 'expense'
  where not exists (select 1 from public.accounts where school_id = v_school and code = '5230');
  insert into public.accounts(school_id, code, name, type)
  select v_school, '2110', 'ذمم موردي التغذية', 'liability'
  where not exists (select 1 from public.accounts where school_id = v_school and code = '2110');
end;
$function$
;

CREATE OR REPLACE FUNCTION public.ensure_transport_account()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_school uuid;
begin
  v_school := public.my_school_id();
  if v_school is null then return; end if;
  insert into public.accounts(school_id, code, name, type)
  select v_school, '4210', 'إيرادات النقل المدرسي', 'revenue'
  where not exists (select 1 from public.accounts where school_id = v_school and code = '4210');
end;
$function$
;

CREATE OR REPLACE FUNCTION public.export_school_backup()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_school uuid;
  v_result jsonb;
begin
  v_school := my_school_id();
  if v_school is null or my_role() not in ('owner','admin') then
    return jsonb_build_object('ok', false, 'reason', 'unauthorized');
  end if;

  v_result := jsonb_build_object(
    'ok', true,
    'exported_at', now(),
    'format_version', 1,
    'school', (select to_jsonb(s) from public.schools s where s.id = v_school),
    'students', (
      select coalesce(jsonb_agg(to_jsonb(st)), '[]'::jsonb)
      from public.students st where st.school_id = v_school and st.deleted_at is null
    ),
    'student_fees', (
      select coalesce(jsonb_agg(to_jsonb(f)), '[]'::jsonb)
      from public.student_fees f where f.school_id = v_school
    ),
    'parents', (
      select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb)
      from public.profiles p where p.school_id = v_school and p.role = 'parent'
    ),
    'parent_students', (
      select coalesce(jsonb_agg(to_jsonb(ps)), '[]'::jsonb)
      from public.parent_students ps where ps.school_id = v_school
    ),
    'staff', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id, 'full_name', p.full_name, 'role', p.role, 'phone', p.phone
      )), '[]'::jsonb)
      from public.profiles p where p.school_id = v_school and p.role in ('owner','admin','accountant')
    ),
    'journal_entries', (
      select coalesce(jsonb_agg(to_jsonb(je)), '[]'::jsonb)
      from public.journal_entries je where je.school_id = v_school
    ),
    'journal_lines', (
      select coalesce(jsonb_agg(to_jsonb(jl)), '[]'::jsonb)
      from public.journal_lines jl where jl.school_id = v_school
    )
  );

  -- جدول الموظفين — منفصل بمعالجة خطأ (قد يختلف اسمه)
  begin
    v_result := v_result || jsonb_build_object('employees', (
      select coalesce(jsonb_agg(to_jsonb(e)), '[]'::jsonb)
      from public.employees e where e.school_id = v_school
    ));
  exception when others then
    v_result := v_result || jsonb_build_object('employees', '[]'::jsonb);
  end;

  return v_result;
exception when others then
  return jsonb_build_object('ok', false, 'reason', 'error', 'detail', sqlerrm);
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
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.school_id = r.school_id
        and p.role in ('owner','admin','accountant')
    );
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
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.school_id = r.school_id
        and p.role in ('owner','admin','accountant')
    )
  order by i.employee_name;
$function$
;

CREATE OR REPLACE FUNCTION public.financial_summary()
 RETURNS TABLE(revenue numeric, expense numeric, profit numeric, cash numeric, receivables numeric, vat numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with bal as (
    select a.code, a.type,
      coalesce(sum(l.debit - l.credit), 0) as b
    from public.accounts a
    left join public.journal_lines l
      on l.account_id = a.id and l.school_id = a.school_id
    where a.school_id = public.my_school_id()
    group by a.code, a.type
  )
  select
    round(coalesce(-sum(b) filter (where type = 'revenue'), 0), 3) as revenue,
    round(coalesce( sum(b) filter (where type = 'expense'), 0), 3) as expense,
    round(coalesce(-sum(b) filter (where type = 'revenue'), 0)
        - coalesce( sum(b) filter (where type = 'expense'), 0), 3) as profit,
    round(coalesce( sum(b) filter (where code in ('1110','1120')), 0), 3) as cash,
    round(coalesce( sum(b) filter (where code = '1210'), 0), 3) as receivables,
    round(coalesce(-sum(b) filter (where code = '2210'), 0), 3) as vat
  from bal;
$function$
;

CREATE OR REPLACE FUNCTION public.food_dispense(p_item uuid, p_qty numeric, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_school uuid; v_item record; v_cost numeric; v_entry uuid;
BEGIN
  v_school := public.my_school_id();
  IF public.my_role() NOT IN ('owner','admin','accountant') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  SELECT * INTO v_item FROM public.food_inventory WHERE id = p_item AND school_id = v_school;
  IF v_item IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  IF coalesce(p_qty,0) <= 0 THEN RETURN jsonb_build_object('ok', false, 'reason', 'invalid_qty'); END IF;
  IF p_qty > v_item.qty THEN RETURN jsonb_build_object('ok', false, 'reason', 'insufficient_qty', 'available', v_item.qty); END IF;

  PERFORM public.ensure_inventory_accounts();
  v_cost := round(p_qty * v_item.cost, 3);

  UPDATE public.food_inventory SET qty = qty - p_qty WHERE id = p_item;

  INSERT INTO public.food_dispenses (school_id, item_id, qty, cost, reason, dispensed_by)
  VALUES (v_school, p_item, p_qty, v_cost, nullif(trim(coalesce(p_reason,'')), ''), auth.uid());

  INSERT INTO public.journal_entries (school_id, description, reference, created_by)
  VALUES (
    v_school,
    'صرف مواد غذائية: ' || v_item.name || ' ×' || p_qty || ' ' || v_item.unit || coalesce(' — ' || nullif(trim(p_reason),''), ''),
    'FDISP-' || left(p_item::text,8), auth.uid()
  )
  RETURNING id INTO v_entry;

  INSERT INTO public.journal_lines (school_id, entry_id, account_id, debit, credit) VALUES
    (v_school, v_entry, public.acc_id('5210'), v_cost, 0),
    (v_school, v_entry, public.acc_id('1320'), 0, v_cost);

  RETURN jsonb_build_object('ok', true, 'item_name', v_item.name, 'remaining_qty', v_item.qty - p_qty);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.food_inventory_list()
 RETURNS SETOF food_inventory
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT * FROM public.food_inventory
  WHERE school_id = public.my_school_id()
  ORDER BY name;
$function$
;

CREATE OR REPLACE FUNCTION public.food_purchase(p_item uuid, p_qty numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_school uuid; v_item record; v_cost numeric; v_entry uuid;
BEGIN
  v_school := public.my_school_id();
  IF public.my_role() NOT IN ('owner','admin','accountant') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  SELECT * INTO v_item FROM public.food_inventory WHERE id = p_item AND school_id = v_school;
  IF v_item IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  IF coalesce(p_qty,0) <= 0 THEN RETURN jsonb_build_object('ok', false, 'reason', 'invalid_qty'); END IF;

  PERFORM public.ensure_inventory_accounts();
  v_cost := round(p_qty * v_item.cost, 3);

  UPDATE public.food_inventory SET qty = qty + p_qty WHERE id = p_item;

  INSERT INTO public.journal_entries (school_id, description, reference, created_by)
  VALUES (v_school, 'شراء مواد غذائية: ' || v_item.name || ' ×' || p_qty || ' ' || v_item.unit, 'FPUR-' || left(p_item::text,8), auth.uid())
  RETURNING id INTO v_entry;

  INSERT INTO public.journal_lines (school_id, entry_id, account_id, debit, credit) VALUES
    (v_school, v_entry, public.acc_id('1320'), v_cost, 0),
    (v_school, v_entry, public.acc_id('1120'), 0, v_cost);

  RETURN jsonb_build_object('ok', true, 'item_name', v_item.name, 'new_qty', v_item.qty + p_qty);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.generate_certificate(p_student_id uuid, p_kind text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_school uuid; v_st record; v_school_name text; v_serial text; v_id uuid;
  v_title text; v_body text;
  v_total numeric; v_paid numeric; v_remaining numeric;
begin
  v_school := public.my_school_id();
  if public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح بإصدار الشهادات';
  end if;
  select * into v_st from public.students where id = p_student_id and school_id = v_school;
  if v_st is null then raise exception 'الطالب غير موجود في مدرستك'; end if;
  if p_kind not in ('enrollment','clearance','fees_statement') then
    raise exception 'نوع شهادة غير مدعوم';
  end if;

  select name into v_school_name from public.schools where id = v_school;
  select coalesce(sum(total),0), coalesce(sum(paid),0)
    into v_total, v_paid
    from public.student_fees where student_id = p_student_id;
  v_remaining := v_total - v_paid;

  v_serial := 'CRT-' || to_char(now(),'YYYYMMDD') || '-' || upper(substr(p_student_id::text,1,6));

  if p_kind = 'enrollment' then
    v_title := 'شهادة قيد';
    v_body := 'تشهد ' || v_school_name || ' بأن الطالب/ة: ' || v_st.full_name ||
              ' (رقم القيد: ' || v_st.code || ') مقيّد/ة لدينا في الصف ' || v_st.grade ||
              coalesce(' شعبة ' || v_st.section, '') ||
              '، وهو/هي طالب/ة منتظم/ة. حُرّرت هذه الشهادة بناءً على طلب ولي الأمر لتقديمها لمن يهمه الأمر.';
  elsif p_kind = 'clearance' then
    v_title := 'شهادة براءة ذمة مالية';
    if v_remaining > 0.0005 then
      raise exception 'لا يمكن إصدار براءة ذمة: على الطالب رسوم متبقّية بقيمة %', to_char(v_remaining,'FM999990.000');
    end if;
    v_body := 'تشهد ' || v_school_name || ' بأن الطالب/ة: ' || v_st.full_name ||
              ' (رقم القيد: ' || v_st.code || ') قد سدّد/ت كامل الرسوم المستحقة عليه/ا، وليس عليه/ا أي التزامات مالية تجاه المدرسة حتى تاريخه.';
  else -- fees_statement
    v_title := 'إفادة رسوم';
    v_body := 'إفادة بحالة رسوم الطالب/ة: ' || v_st.full_name || ' (رقم القيد: ' || v_st.code || ').' ||
              ' إجمالي الرسوم: ' || to_char(v_total,'FM999990.000') ||
              ' — المسدّد: ' || to_char(v_paid,'FM999990.000') ||
              ' — المتبقّي: ' || to_char(v_remaining,'FM999990.000') || '.';
  end if;

  insert into public.certificates(school_id, student_id, kind, title, serial, body, issued_by)
  values (v_school, p_student_id, p_kind, v_title, v_serial, v_body, auth.uid())
  returning id into v_id;

  insert into public.audit_log(school_id, actor_id, action, details)
  values (v_school, auth.uid(), 'إصدار ' || v_title, v_st.full_name || ' · ' || v_serial);

  return v_id;
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
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and school_id = p_school_id
      and role in ('owner','admin','accountant')
  ) then raise exception 'غير مصرح'; end if;

  -- النسب من schools (المصدر الموحّد)
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

CREATE OR REPLACE FUNCTION public.grade_fees_list()
 RETURNS TABLE(grade text, annual_fee numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  return query
  select gf.grade, gf.annual_fee
  from public.grade_fees gf
  where gf.school_id = public.my_school_id()
  order by gf.grade;
end;
$function$
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
  -- مصدر السياق الموحّد (بدل القراءة المباشرة من profiles)
  v_school_id := public.my_school_id();
  v_my_role   := public.my_role();

  if v_school_id is null then
    raise exception 'لا مدرسة مرتبطة بحسابك';
  end if;
  if v_my_role <> 'owner' then
    raise exception 'غير مصرّح: منح الصلاحيات للمدير فقط';
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
  v_meal_name text;
  v_meal_amt  numeric;
  v_plan_id   uuid;
  v_ok        int := 0;
  v_fail      int := 0;
  v_errors    jsonb := '[]'::jsonb;
  v_rownum    int := 0;
begin
  -- مصدر السياق الموحّد (بدل القراءة المباشرة من profiles)
  v_school_id := public.my_school_id();
  v_role      := public.my_role();

  if v_school_id is null then
    raise exception 'لا مدرسة مرتبطة بحسابك';
  end if;
  if v_role not in ('owner', 'admin') then
    raise exception 'غير مصرّح: الاستيراد للمدير أو الإداري فقط';
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

      v_fee := coalesce(nullif(trim(r->>'annual_fee'), '')::numeric, 0);

      insert into public.students (
        school_id, code, full_name, grade, section,
        guardian_name, guardian_phone, guardian_email,
        birth_date, gender, annual_fee
      ) values (
        v_school_id, v_code,
        trim(r->>'full_name'), trim(r->>'grade'), nullif(trim(r->>'section'), ''),
        nullif(trim(r->>'guardian_name'), ''), nullif(trim(r->>'guardian_phone'), ''),
        nullif(trim(r->>'guardian_email'), ''),
        nullif(trim(r->>'birth_date'), '')::date,
        nullif(trim(r->>'gender'), ''),
        v_fee
      )
      returning id into v_sid;

      if v_fee > 0 then
        insert into public.student_fees (school_id, student_id, description, total, paid, due_date)
        values (v_school_id, v_sid, 'الرسوم الدراسية السنوية', v_fee, 0, current_date + interval '30 days');
      end if;

      -- باقة تغذية سنوية (اختيارية) — تُطابق بالاسم
      v_meal_name := nullif(trim(r->>'meal_plan'), '');
      v_meal_amt  := coalesce(nullif(trim(r->>'meal_annual'), '')::numeric, 0);

      if v_meal_name is not null then
        select id into v_plan_id
        from public.meal_plans
        where school_id = v_school_id and name = v_meal_name
        limit 1;

        if v_plan_id is null then
          raise exception 'باقة التغذية "%" غير موجودة', v_meal_name;
        end if;

        insert into public.meal_subscriptions(school_id, student_id, plan_id, billing)
        values (v_school_id, v_sid, v_plan_id, 'annual');

        if v_meal_amt > 0 then
          insert into public.student_fees (school_id, student_id, description, total, paid, due_date)
          values (v_school_id, v_sid, 'رسوم التغذية السنوية — ' || v_meal_name,
                  v_meal_amt, 0, current_date + interval '30 days');
        end if;
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
  select
    case when a.type = 'revenue' then 'revenue' else 'expense' end as section,
    a.code, a.name,
    case when a.type = 'revenue'
      then coalesce(round(sum(l.credit - l.debit), 3), 0)
      else coalesce(round(sum(l.debit - l.credit), 3), 0)
    end as amount
  from public.accounts a
  left join public.journal_lines l on l.account_id = a.id
  left join public.journal_entries e on e.id = l.entry_id
    and e.entry_date >= p_from and e.entry_date <= p_to
  where a.school_id = public.my_school_id()
    and a.type in ('revenue', 'expense')
  group by a.id, a.code, a.name, a.type
  having coalesce(round(sum(l.debit - l.credit), 3), 0) <> 0
  order by section, a.code;
$function$
;

CREATE OR REPLACE FUNCTION public.intelligence_enabled(p_engine text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(
    (select enabled from public.intelligence_flags
       where school_id = public.my_school_id() and engine = p_engine),
    true   -- الافتراضي: مفعّل
  );
$function$
;

CREATE OR REPLACE FUNCTION public.intelligence_status()
 RETURNS TABLE(engine text, name_ar text, description text, enabled boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with catalog(engine, name_ar, description) as (
    values
      ('copilot',  'المساعد التنفيذي', 'ملخّص يومي وتنبيهات وتوصيات من بيانات المدرسة'),
      ('risk',     'مؤشّر خطورة التعثّر', 'ترتيب أولياء الأمور حسب احتمال تأخّر السداد'),
      ('forecast', 'التنبّؤ بالتدفّق النقدي', 'توقّع التحصيل المتوقّع للأشهر القادمة')
  )
  select c.engine, c.name_ar, c.description,
         coalesce(f.enabled, true) as enabled   -- مفعّل افتراضياً
  from catalog c
  left join public.intelligence_flags f
    on f.engine = c.engine and f.school_id = public.my_school_id()
  order by c.engine;
$function$
;

CREATE OR REPLACE FUNCTION public.inventory_categories()
 RETURNS TABLE(category text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select unnest(array['كتب','زي مدرسي','قرطاسية','أخرى']) as category
  union
  select distinct category from public.inventory_items where school_id = public.my_school_id()
  order by category;
$function$
;

CREATE OR REPLACE FUNCTION public.inventory_category_report()
 RETURNS TABLE(category text, items_count bigint, total_qty numeric, total_value numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select category, count(*) as items_count, coalesce(sum(qty),0) as total_qty, coalesce(sum(qty*cost),0) as total_value
  from public.inventory_items
  where school_id = public.my_school_id()
  group by category
  order by total_value desc;
$function$
;

CREATE OR REPLACE FUNCTION public.inventory_dispense(p_item uuid, p_qty integer, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_school uuid; v_item record; v_cost numeric; v_entry uuid;
begin
  v_school := public.my_school_id();
  if public.my_role() not in ('owner','admin','accountant') then raise exception 'غير مصرّح'; end if;

  select * into v_item from public.inventory_items where id = p_item and school_id = v_school;
  if v_item is null then raise exception 'الصنف غير موجود'; end if;
  if coalesce(p_qty,0) <= 0 then raise exception 'كمية غير صحيحة'; end if;
  if p_qty > v_item.qty then raise exception 'الكمية أكبر من الرصيد المتاح (%)', v_item.qty; end if;

  perform public.ensure_inventory_accounts();
  v_cost := round(p_qty * v_item.cost, 3);

  -- خصم الكمية (بدون فاتورة وبدون إيراد)
  update public.inventory_items set qty = qty - p_qty where id = p_item;

  -- سجل الحركة — تاريخ وسبب لكل صرف
  insert into public.inventory_dispenses(school_id, item_id, qty, cost, reason, dispensed_by)
  values (v_school, p_item, p_qty, v_cost, nullif(trim(coalesce(p_reason,'')), ''), auth.uid());

  -- قيد محاسبي: مصاريف إدارية مدين / مخزون دائن (مصروف تشغيلي، ليس تكلفة مبيعات)
  insert into public.journal_entries(school_id, description, reference, created_by)
  values (
    v_school,
    'صرف استهلاكي داخلي: ' || v_item.name || ' ×' || p_qty || coalesce(' — ' || nullif(trim(p_reason),''), ''),
    'DISP-' || left(p_item::text,8),
    auth.uid()
  )
  returning id into v_entry;

  insert into public.journal_lines(school_id, entry_id, account_id, debit, credit) values
    (v_school, v_entry, public.acc_id('5210'), v_cost, 0),
    (v_school, v_entry, public.acc_id('1310'), 0, v_cost);

  return jsonb_build_object('ok', true, 'item_name', v_item.name, 'qty', p_qty, 'cost', v_cost, 'remaining_qty', v_item.qty - p_qty);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.inventory_dispenses_list(p_limit integer DEFAULT 50)
 RETURNS TABLE(id uuid, item_name text, qty integer, cost numeric, reason text, dispensed_by_name text, dispensed_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select d.id, i.name, d.qty, d.cost, d.reason,
    coalesce(pr.full_name, 'موظف'), d.dispensed_at
  from public.inventory_dispenses d
  join public.inventory_items i on i.id = d.item_id
  left join public.profiles pr on pr.id = d.dispensed_by
  where d.school_id = public.my_school_id()
  order by d.dispensed_at desc
  limit greatest(1, least(p_limit, 500));
$function$
;

CREATE OR REPLACE FUNCTION public.inventory_list(p_category text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, name text, qty integer, cost numeric, price numeric, vat_rate numeric, stock_value numeric, category text, subtype text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select id, name, qty, cost, price, vat_rate, round(qty * cost, 3) as stock_value, category, subtype
  from public.inventory_items
  where school_id = public.my_school_id()
    and (p_category is null or category = p_category)
  order by category, created_at;
$function$
;

CREATE OR REPLACE FUNCTION public.inventory_purchase(p_item uuid, p_qty integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_school uuid; v_item record; v_cost numeric; v_entry uuid;
begin
  v_school := public.my_school_id();
  if public.my_role() not in ('owner','admin','accountant') then raise exception 'غير مصرّح'; end if;
  select * into v_item from public.inventory_items where id = p_item and school_id = v_school;
  if v_item is null then raise exception 'الصنف غير موجود'; end if;
  if coalesce(p_qty,0) <= 0 then raise exception 'كمية غير صحيحة'; end if;

  perform public.ensure_inventory_accounts();
  v_cost := round(p_qty * v_item.cost, 3);

  -- زيادة الكمية
  update public.inventory_items set qty = qty + p_qty where id = p_item;

  -- قيد محاسبي: مخزون مدين / بنك دائن
  insert into public.journal_entries(school_id, description, reference, created_by)
  values (v_school, 'شراء مخزون: ' || v_item.name || ' ×' || p_qty, 'PUR-' || left(p_item::text,8), auth.uid())
  returning id into v_entry;

  insert into public.journal_lines(school_id, entry_id, account_id, debit, credit) values
    (v_school, v_entry, public.acc_id('1310'), v_cost, 0),
    (v_school, v_entry, public.acc_id('1120'), 0, v_cost);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.inventory_purchases_summary()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_school uuid;
  v_general numeric;
  v_food numeric;
BEGIN
  v_school := public.my_school_id();
  IF v_school IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_school'); END IF;

  -- إجمالي ما دخل حساب مخزون الكتب والزي (1310) عبر الشراء (مدين)
  SELECT coalesce(sum(jl.debit), 0) INTO v_general
  FROM public.journal_lines jl
  JOIN public.accounts a ON a.id = jl.account_id
  WHERE a.school_id = v_school AND a.code = '1310';

  -- إجمالي ما دخل حساب مخزون التغذية (1320) عبر الشراء (مدين)
  SELECT coalesce(sum(jl.debit), 0) INTO v_food
  FROM public.journal_lines jl
  JOIN public.accounts a ON a.id = jl.account_id
  WHERE a.school_id = v_school AND a.code = '1320';

  RETURN jsonb_build_object('ok', true, 'general_purchases', v_general, 'food_purchases', v_food);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.inventory_sell(p_item uuid, p_qty integer, p_student uuid, p_apply_tax boolean DEFAULT true)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_school uuid; v_item record; v_cogs numeric; v_total numeric; v_entry uuid;
  v_subtotal numeric; v_vat numeric;
begin
  v_school := public.my_school_id();
  if public.my_role() not in ('owner','admin','accountant') then raise exception 'غير مصرّح'; end if;
  select * into v_item from public.inventory_items where id = p_item and school_id = v_school;
  if v_item is null then raise exception 'الصنف غير موجود'; end if;
  if coalesce(p_qty,0) <= 0 then raise exception 'كمية غير صحيحة'; end if;
  if p_qty > v_item.qty then raise exception 'الكمية أكبر من الرصيد المتاح (%)' , v_item.qty; end if;
  if not exists (select 1 from public.students where id = p_student and school_id = v_school) then
    raise exception 'الطالب غير موجود في مدرستك';
  end if;

  perform public.ensure_inventory_accounts();

  -- المجموع الفرعي + الضريبة (إن طُبّقت)
  v_subtotal := round(p_qty * v_item.price, 3);
  v_vat := case
    when p_apply_tax then round(v_subtotal * (coalesce(v_item.vat_rate, 0) / 100.0), 3)
    else 0
  end;
  v_total := v_subtotal + v_vat;
  v_cogs  := round(p_qty * v_item.cost, 3);

  -- خصم الكمية
  update public.inventory_items set qty = qty - p_qty where id = p_item;

  -- فاتورة رسوم للطالب (إيراد المبيعات)
  insert into public.student_fees(school_id, student_id, description, total, paid, due_date)
  values (
    v_school, p_student,
    v_item.name || ' ×' || p_qty || case when p_apply_tax and v_vat > 0 then ' (شامل ضريبة)' else '' end,
    v_total, 0, current_date
  );

  -- قيد تكلفة المبيعات: 5520 مدين / 1310 دائن
  insert into public.journal_entries(school_id, description, reference, created_by)
  values (v_school, 'تكلفة مبيعات: ' || v_item.name || ' ×' || p_qty, 'COGS-' || left(p_item::text,8), auth.uid())
  returning id into v_entry;

  insert into public.journal_lines(school_id, entry_id, account_id, debit, credit) values
    (v_school, v_entry, public.acc_id('5520'), v_cogs, 0),
    (v_school, v_entry, public.acc_id('1310'), 0, v_cogs);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.invite_staff(p_email text, p_role text, p_full_name text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_school_id uuid;
  v_my_role   user_role;
  v_invite_id uuid;
begin
  v_school_id := public.my_school_id();
  v_my_role   := public.my_role();

  if v_school_id is null then
    raise exception 'لا مدرسة مرتبطة بحسابك';
  end if;

  if v_my_role <> 'owner' then
    raise exception 'غير مصرّح: دعوة الطاقم للمدير فقط';
  end if;

  if p_role not in ('admin', 'accountant') then
    raise exception 'الدور يجب أن يكون admin أو accountant';
  end if;

  if coalesce(trim(p_email), '') = '' then
    raise exception 'البريد الإلكتروني مطلوب';
  end if;

  insert into public.staff_invites (school_id, email, role, full_name, invited_by)
  values (v_school_id, lower(trim(p_email)), p_role::user_role, nullif(trim(p_full_name), ''), auth.uid())
  on conflict (school_id, email)
  do update set role = p_role::user_role, full_name = nullif(trim(p_full_name), ''), status = 'pending'
  returning id into v_invite_id;

  insert into public.audit_log (school_id, actor_id, action, details)
  values (v_school_id, auth.uid(), 'دعوة عضو طاقم',
          lower(trim(p_email)) || ' (' || (case p_role when 'admin' then 'إداري' else 'محاسب' end) || ')');

  return v_invite_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'platform_admin'
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_valid_gulf_phone(p_normalized text)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
begin
  if p_normalized is null then
    return false;
  end if;
  -- عُمان: 968 + 8 خانات تبدأ بـ 7 أو 9
  if p_normalized ~ '^968[79][0-9]{7}$' then
    return true;
  end if;
  return false;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.journal_period(p_from date, p_to date)
 RETURNS TABLE(entry_date date, reference text, description text, account_code text, account_name text, debit numeric, credit numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    e.entry_date, e.reference, e.description,
    a.code, a.name,
    round(l.debit, 3), round(l.credit, 3)
  from public.journal_entries e
  join public.journal_lines l on l.entry_id = e.id
  join public.accounts a on a.id = l.account_id
  where e.school_id = public.my_school_id()
    and e.entry_date >= p_from and e.entry_date <= p_to
  order by e.entry_date, e.id, a.code;
$function$
;

CREATE OR REPLACE FUNCTION public.last_promotion()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_school uuid;
  v_row    public.promotion_log%rowtype;
begin
  v_school := my_school_id();
  if v_school is null or my_role() not in ('owner','admin') then
    return jsonb_build_object('ok', false);
  end if;

  select * into v_row from public.promotion_log
  where school_id = v_school
  order by created_at desc limit 1;

  if not found then
    return jsonb_build_object('ok', true, 'exists', false);
  end if;

  return jsonb_build_object(
    'ok', true, 'exists', true,
    'academic_year', v_row.academic_year,
    'promoted', v_row.promoted,
    'repeated', v_row.repeated,
    'graduated', v_row.graduated,
    'created_at', v_row.created_at
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.link_parent_by_email(p_email text, p_student_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_school uuid; v_parent uuid; v_name text;
begin
  v_school := public.my_school_id();
  if public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح بربط أولياء الأمور';
  end if;
  if not exists (select 1 from public.students where id = p_student_id and school_id = v_school) then
    raise exception 'الطالب غير موجود في مدرستك';
  end if;

  -- ابحث عن حساب ولي الأمر عبر auth.users بالبريد، ثم profile بدور parent
  select p.id, p.full_name into v_parent, v_name
  from public.profiles p
  join auth.users u on u.id = p.id
  where lower(u.email) = lower(trim(p_email))
    and p.school_id = v_school and p.role = 'parent'
  limit 1;

  if v_parent is null then
    raise exception 'لا يوجد حساب ولي أمر بهذا البريد في مدرستك. اطلب منه التسجيل أولاً بدور ولي أمر.';
  end if;

  insert into public.parent_students(school_id, parent_id, student_id)
  values (v_school, v_parent, p_student_id)
  on conflict (parent_id, student_id) do nothing;

  return v_name;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.link_parent_by_student(p_student_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
 v_school uuid;
 v_phone  text;
 v_parent uuid;
begin
 v_school := public.my_school_id();
 if public.my_role() not in ('owner','admin','accountant') then
   raise exception 'غير مصرّح بربط أولياء الأمور';
 end if;
 select guardian_phone into v_phone
 from public.students
 where id = p_student_id and school_id = v_school and deleted_at is null;
 if v_phone is null then
   return jsonb_build_object('ok', false, 'reason', 'student_not_found_or_no_phone');
 end if;
 -- 🔧 المقارنة الآن عبر normalize_phone() بدل التطابق الحرفي
 select id into v_parent
 from public.profiles
 where role = 'parent' and public.normalize_phone(phone) = public.normalize_phone(v_phone)
 limit 1;
 if v_parent is null then
   return jsonb_build_object('ok', false, 'reason', 'no_parent_account',
     'phone', v_phone);
 end if;
 insert into public.parent_students(school_id, parent_id, student_id)
 values (v_school, v_parent, p_student_id)
 on conflict do nothing;
 return jsonb_build_object('ok', true);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.link_parent_to_student(p_parent_id uuid, p_student_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_school uuid;
begin
  v_school := public.my_school_id();
  if public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح بربط أولياء الأمور';
  end if;
  if not exists (select 1 from public.students where id = p_student_id and school_id = v_school) then
    raise exception 'الطالب غير موجود في مدرستك';
  end if;
  if not exists (select 1 from public.profiles where id = p_parent_id and school_id = v_school and role = 'parent') then
    raise exception 'حساب ولي الأمر غير موجود في مدرستك';
  end if;

  insert into public.parent_students(school_id, parent_id, student_id)
  values (v_school, p_parent_id, p_student_id)
  on conflict (parent_id, student_id) do nothing;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.log_error(p_source text, p_severity text, p_message text, p_context jsonb DEFAULT NULL::jsonb, p_request_id text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_id uuid;
begin
  insert into public.error_log(school_id, source, severity, message, context, request_id)
  values (public.my_school_id(), p_source, coalesce(p_severity,'error'), p_message, p_context, p_request_id)
  returning id into v_id;
  return v_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.log_recommendation_action(p_rec_type text, p_rec_title text, p_target_count integer DEFAULT NULL::integer, p_expected_amount numeric DEFAULT NULL::numeric)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_school uuid;
  v_id uuid;
begin
  v_school := my_school_id();
  if v_school is null or my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح';
  end if;

  insert into public.recommendation_log
    (school_id, actor_id, rec_type, rec_title, target_count, expected_amount)
  values
    (v_school, auth.uid(), p_rec_type, p_rec_title, p_target_count, p_expected_amount)
  returning id into v_id;

  return v_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.mark_gateway_payment_failed(p_id uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_pp record;
begin
  select * into v_pp from public.pending_payments where id = p_id for update;
  if v_pp is null then raise exception 'الدفعة غير موجودة'; end if;

  -- لو سبق تأكيدها كمدفوعة، لا نلمسها أبداً
  if v_pp.status = 'approved' or v_pp.txn_state = 'paid' then
    return;
  end if;

  update public.pending_payments
  set txn_state = 'failed',
      failure_reason = p_reason,
      state_updated_at = now()
  where id = p_id;

  insert into public.payment_state_log(payment_id, school_id, from_state, to_state, reason, actor_id)
  values (p_id, v_pp.school_id, v_pp.txn_state, 'failed', p_reason, null);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.mark_guardian_invited(p_phone text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_school uuid;
BEGIN
  v_school := public.my_school_id();
  IF v_school IS NULL OR public.my_role() NOT IN ('owner','admin','accountant') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unauthorized');
  END IF;

  INSERT INTO public.guardian_invites (school_id, phone, invited_at, invited_by)
  VALUES (v_school, p_phone, now(), auth.uid())
  ON CONFLICT (school_id, phone)
  DO UPDATE SET invited_at = now(), invited_by = auth.uid();

  RETURN jsonb_build_object('ok', true);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.mark_meal_purchase_paid(p_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_school uuid;
  v_role   user_role;
  v_purchase record;
  v_entry  uuid;
begin
  v_school := public.my_school_id();
  v_role   := public.my_role();
  if v_school is null then raise exception 'لا مدرسة مرتبطة بحسابك'; end if;
  if v_role not in ('owner','admin','accountant') then raise exception 'غير مصرّح'; end if;

  select * into v_purchase from public.meal_purchases where id = p_id and school_id = v_school;
  if v_purchase is null then raise exception 'الشراء غير موجود في مدرستك'; end if;
  if v_purchase.paid then raise exception 'هذا الشراء مدفوع بالفعل'; end if;

  perform public.ensure_meal_cost_accounts();

  if v_purchase.total_cost > 0 then
    insert into public.journal_entries (school_id, description, reference, created_by)
    values (v_school, 'سداد مستحقات مشتريات وجبات', 'MPAY-' || left(p_id::text,8), auth.uid())
    returning id into v_entry;

    insert into public.journal_lines (school_id, entry_id, account_id, debit, credit) values
      (v_school, v_entry, public.acc_id('2110'), v_purchase.total_cost, 0),
      (v_school, v_entry, public.acc_id('1120'), 0, v_purchase.total_cost);
  end if;

  update public.meal_purchases set paid = true, updated_at = now() where id = p_id;

  return v_entry;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.mark_notifications_read()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update public.notifications
  set is_read = true
  where (audience = 'staff' and school_id = public.my_school_id())
     or (audience = 'guardian' and guardian_id = auth.uid());
end;
$function$
;

CREATE OR REPLACE FUNCTION public.mark_queue_result(p_id uuid, p_success boolean, p_error text DEFAULT NULL::text, p_provider_id text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_attempts int; v_max int;
begin
  select attempts, max_attempts into v_attempts, v_max
    from public.notification_queue where id = p_id;

  if p_success then
    update public.notification_queue
      set status = 'sent', sent_at = now(), provider_id = p_provider_id, last_error = null
      where id = p_id;
  else
    update public.notification_queue
      set status = case when v_attempts >= v_max then 'dead' else 'failed' end,
          last_error = p_error,
          -- backoff أسّي: 1د، 2د، 4د، 8د، 16د
          next_retry_at = now() + (power(2, least(v_attempts,5)) * interval '1 minute')
      where id = p_id;
  end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.meal_cost_report(p_period text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_school     uuid;
  v_meals      int;
  v_cost       numeric;
  v_avg        numeric;
  v_students   int;
  v_per_std    numeric;
  v_suppliers  jsonb;
begin
  v_school := public.my_school_id();
  if v_school is null then raise exception 'لا مدرسة مرتبطة بحسابك'; end if;

  select coalesce(sum(meals_count),0), coalesce(sum(total_cost),0)
  into v_meals, v_cost
  from public.meal_purchases
  where school_id = v_school and (p_period is null or period = p_period);

  v_avg := case when v_meals > 0 then round(v_cost / v_meals, 3) else 0 end;

  select count(distinct student_id) into v_students
  from public.meal_subscriptions where school_id = v_school;

  v_per_std := case when v_students > 0 then round(v_cost / v_students, 3) else 0 end;

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_suppliers
  from (
    select coalesce(s.name,'—') as supplier,
           sum(mp.meals_count) as meals,
           sum(mp.total_cost)  as cost,
           case when sum(mp.meals_count) > 0
                then round(sum(mp.total_cost)/sum(mp.meals_count),3) else 0 end as avg_cost
    from public.meal_purchases mp
    left join public.suppliers s on s.id = mp.supplier_id
    where mp.school_id = v_school and (p_period is null or mp.period = p_period)
    group by s.name
    order by sum(mp.total_cost) desc
  ) t;

  return jsonb_build_object(
    'meals_purchased', v_meals,
    'total_cost', v_cost,
    'avg_per_meal', v_avg,
    'meal_students', v_students,
    'avg_per_student', v_per_std,
    'suppliers', v_suppliers
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.meal_purchases_list(p_period text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, supplier_id uuid, supplier_name text, purchase_date date, purchase_type text, meals_count integer, unit_cost numeric, total_cost numeric, period text, paid boolean, notes text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select mp.id, mp.supplier_id, s.name, mp.purchase_date, mp.purchase_type,
         mp.meals_count, mp.unit_cost, mp.total_cost, mp.period, mp.paid, mp.notes
  from public.meal_purchases mp
  left join public.suppliers s on s.id = mp.supplier_id
  where mp.school_id = public.my_school_id()
    and (p_period is null or mp.period = p_period)
  order by mp.purchase_date desc, mp.created_at desc;
$function$
;

CREATE OR REPLACE FUNCTION public.meal_suppliers()
 RETURNS SETOF suppliers
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select * from public.suppliers
  where school_id = public.my_school_id()
  order by active desc, name;
$function$
;

CREATE OR REPLACE FUNCTION public.my_notifications(p_limit integer DEFAULT 30)
 RETURNS SETOF notifications
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select * from public.notifications n
  where (n.audience = 'staff' and n.school_id = public.my_school_id() and public.my_role() in ('owner','admin','accountant'))
     or (n.audience = 'guardian' and n.guardian_id = auth.uid())
  order by n.created_at desc
  limit p_limit;
$function$
;

CREATE OR REPLACE FUNCTION public.my_role()
 RETURNS user_role
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case
    when p.role = 'platform_admin' and p.impersonating_school_id is not null
      then 'owner'::user_role
    else p.role
  end
  from public.profiles p where p.id = auth.uid();
$function$
;

CREATE OR REPLACE FUNCTION public.my_school_feedback()
 RETURNS SETOF feedback
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select * from public.feedback
  where school_id = public.my_school_id()
  order by created_at desc;
$function$
;

CREATE OR REPLACE FUNCTION public.my_school_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(
    case when p.role = 'platform_admin' then p.impersonating_school_id else null end,
    p.school_id
  )
  from public.profiles p where p.id = auth.uid();
$function$
;

CREATE OR REPLACE FUNCTION public.my_vat_setting()
 RETURNS TABLE(country_code text, vat_mode text, vat_rate numeric, applies boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    c.code, c.vat_mode, c.vat_rate,
    case
      when c.vat_mode = 'mandatory' then true
      when c.vat_mode = 'optional'  then s.vat_enabled
      else false
    end as applies
  from public.schools s
  join public.platform_countries c on c.code = coalesce(s.country, 'OM')
  where s.id = public.my_school_id();
$function$
;

CREATE OR REPLACE FUNCTION public.next_grade(p_grade text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
declare
  grades text[] := array[
    'روضة','تمهيدي','تجهيزي','الأول','الثاني','الثالث','الرابع','الخامس',
    'السادس','السابع','الثامن','التاسع','العاشر','الحادي عشر','الثاني عشر'
  ];
  i int;
begin
  i := array_position(grades, trim(p_grade));
  if i is null then return null; end if;              -- صف غير معروف
  if i >= array_length(grades, 1) then return null; end if;  -- الصف الأخير → تخرّج
  return grades[i + 1];
end;
$function$
;

CREATE OR REPLACE FUNCTION public.normalize_phone(p_raw text, p_country_code text DEFAULT '968'::text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare
  v text;
  v_map text[][] := array[
    ['٠','0'],['١','1'],['٢','2'],['٣','3'],['٤','4'],
    ['٥','5'],['٦','6'],['٧','7'],['٨','8'],['٩','9']
  ];
  i int;
begin
  if p_raw is null or trim(p_raw) = '' then
    return null;
  end if;

  v := trim(p_raw);

  for i in 1 .. array_length(v_map, 1) loop
    v := replace(v, v_map[i][1], v_map[i][2]);
  end loop;

  v := regexp_replace(v, '[^0-9]', '', 'g');

  if left(v, 2) = '00' then
    v := substr(v, 3);
  end if;

  if left(v, length(p_country_code)) = p_country_code
     and length(v) = length(p_country_code) + 8 then
    return v;
  end if;

  if length(v) = 8 then
    return p_country_code || v;
  end if;

  return v;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.overdue_reminders()
 RETURNS TABLE(student_id uuid, student_name text, guardian_name text, guardian_phone text, remaining numeric)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select s.id, s.full_name,
         coalesce(s.guardian_name, 'ولي الأمر'),
         s.guardian_phone,
         sum(f.total - f.paid) as remaining
  from public.students s
  join public.student_fees f on f.student_id = s.id
  where s.school_id = public.my_school_id()
    and s.deleted_at is null
    and s.status = 'active'
    and s.guardian_phone is not null
  group by s.id, s.full_name, s.guardian_name, s.guardian_phone
  having sum(f.total - f.paid) > 0.0005;
$function$
;

CREATE OR REPLACE FUNCTION public.parent_certificate_requests()
 RETURNS TABLE(id uuid, student_name text, kind text, status text, reason text, created_at timestamp with time zone, reviewed_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select cr.id, s.full_name, cr.kind, cr.status, cr.reason, cr.created_at, cr.reviewed_at
  from public.certificate_requests cr
  join public.students s on s.id = cr.student_id
  where cr.parent_id = auth.uid()
  order by cr.created_at desc;
$function$
;

CREATE OR REPLACE FUNCTION public.parent_certificates()
 RETURNS TABLE(id uuid, student_name text, kind text, title text, serial text, body text, file_path text, file_name text, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select c.id, s.full_name, c.kind, c.title, c.serial, c.body, c.file_path, c.file_name, c.created_at
  from public.certificates c
  join public.students s on s.id = c.student_id
  join public.parent_students ps on ps.student_id = c.student_id
  where ps.parent_id = auth.uid()
  order by c.created_at desc;
$function$
;

CREATE OR REPLACE FUNCTION public.parent_children()
 RETURNS TABLE(student_id uuid, student_name text, grade text, section text, total numeric, paid numeric, remaining numeric, pending numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    s.id, s.full_name, s.grade, s.section,
    coalesce(sum(f.total),0), coalesce(sum(f.paid),0),
    coalesce(sum(f.total - f.paid),0),
    coalesce((
      select sum(pp.amount) from public.pending_payments pp
      join public.student_fees f2 on f2.id = pp.fee_id
      where f2.student_id = s.id and pp.status = 'pending'
    ),0)
  from public.parent_students ps
  join public.students s on s.id = ps.student_id
  left join public.student_fees f on f.student_id = s.id
  where ps.parent_id = auth.uid()
  group by s.id, s.full_name, s.grade, s.section
  order by s.full_name;
$function$
;

CREATE OR REPLACE FUNCTION public.parent_fees()
 RETURNS TABLE(fee_id uuid, student_name text, description text, total numeric, paid numeric, remaining numeric, due_date date)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    f.id, s.full_name, f.description,
    f.total, f.paid, (f.total - f.paid), f.due_date
  from public.parent_students ps
  join public.students s on s.id = ps.student_id
  join public.student_fees f on f.student_id = s.id
  where ps.parent_id = auth.uid()
  order by (f.total - f.paid) desc, f.due_date;
$function$
;

CREATE OR REPLACE FUNCTION public.parent_receipts()
 RETURNS TABLE(payment_id uuid, student_name text, description text, amount numeric, method text, paid_at date)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    pay.id, s.full_name, f.description,
    pay.amount, pay.method, pay.paid_at
  from public.parent_students ps
  join public.students s on s.id = ps.student_id
  join public.student_fees f on f.student_id = s.id
  join public.payments pay on pay.fee_id = f.id
  where ps.parent_id = auth.uid()
  order by pay.paid_at desc;
$function$
;

CREATE OR REPLACE FUNCTION public.parent_signup_by_phone(p_full_name text, p_phone text, p_country_code text DEFAULT '968'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
 v_phone     text;
 v_school_id uuid;
 v_matched   int;
 v_linked    int := 0;
 r_student   record;
begin
 -- 1) التحقّق أن المستخدم مسجّل دخوله ولا يملك ملفاً بعد
 if auth.uid() is null then
   return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
 end if;
 if exists (select 1 from public.profiles where id = auth.uid()) then
   return jsonb_build_object('ok', false, 'reason', 'already_registered');
 end if;
 -- 2) تطبيع الرقم والتحقّق منه
 v_phone := public.normalize_phone(p_phone, coalesce(p_country_code, '968'));
 if v_phone is null or not public.is_valid_gulf_phone(v_phone) then
   return jsonb_build_object('ok', false, 'reason', 'invalid_phone');
 end if;
 -- 3) ابحث عن طلاب مسجّلين بنفس رقم ولي الأمر
 --    (guardian_phone مخزّن مطبّعاً بفضل add_student)
 select count(*) into v_matched
 from public.students
 where guardian_phone = v_phone and deleted_at is null;
 if v_matched = 0 then
   return jsonb_build_object('ok', false, 'reason', 'no_children_found');
 end if;
 -- 4) حدّد المدرسة من أول طالب مطابق
 --    (توصية 1ب: لو الرقم في عدة مدارس، نربط الكل — لكن school_id للملف
 --     يكون من أول مدرسة؛ الروابط قد تمتد لعدة مدارس)
 select school_id into v_school_id
 from public.students
 where guardian_phone = v_phone and deleted_at is null
 order by created_at
 limit 1;
 -- 5) أنشئ ملف ولي الأمر
 insert into public.profiles (id, school_id, role, full_name, phone)
 values (
   auth.uid(), v_school_id, 'parent',
   coalesce(nullif(trim(p_full_name), ''), 'ولي أمر'),
   v_phone
 );
 -- 6) اربطه بكل أبنائه المطابقين (عبر كل المدارس — توصية 1ب)
 for r_student in
   select id, school_id from public.students
   where guardian_phone = v_phone and deleted_at is null
 loop
   insert into public.parent_students (school_id, parent_id, student_id)
   values (r_student.school_id, auth.uid(), r_student.id)
   on conflict do nothing;
   v_linked := v_linked + 1;
 end loop;
 return jsonb_build_object(
   'ok', true,
   'school_id', v_school_id,
   'children_linked', v_linked
 );
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
end $function$
;

CREATE OR REPLACE FUNCTION public.payroll_yearly_summary(p_year integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_school uuid;
  v_year   int := coalesce(p_year, extract(year from current_date)::int);
  v_yearly_gross numeric;
  v_yearly_net   numeric;
  v_rows jsonb;
BEGIN
  v_school := public.my_school_id();
  IF v_school IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_school'); END IF;

  -- إجمالي السنة: من دورات الرواتب المعتمدة/المدفوعة فقط (لا الملغاة)
  SELECT coalesce(sum(total_gross), 0), coalesce(sum(total_net), 0)
    INTO v_yearly_gross, v_yearly_net
  FROM public.payroll_runs
  WHERE school_id = v_school
    AND period_year = v_year
    AND status IN ('approved', 'paid');

  -- قائمة تفصيلية بكل دورة راتب في السنة المطلوبة
  SELECT coalesce(jsonb_agg(row_to_json(t) ORDER BY t.period_month), '[]'::jsonb)
    INTO v_rows
  FROM (
    SELECT period_month, status, total_gross, total_net, total_pasi_er, approved_at, payment_journal_entry_id IS NOT NULL AS is_paid
    FROM public.payroll_runs
    WHERE school_id = v_school AND period_year = v_year AND status IN ('approved', 'paid')
  ) t;

  RETURN jsonb_build_object(
    'ok', true, 'year', v_year,
    'yearly_gross', v_yearly_gross, 'yearly_net', v_yearly_net,
    'rows', v_rows
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.pending_payments_list(p_page integer DEFAULT 1, p_page_size integer DEFAULT 20)
 RETURNS TABLE(id uuid, guardian text, student text, amount numeric, method text, bank_ref text, receipt_url text, created_at timestamp with time zone, guardian_phone text, school_name text, total_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح';
  end if;
  return query
  select pp.id,
    coalesce(g.full_name,'ولي أمر'), s.full_name,
    pp.amount, pp.method, pp.bank_ref, pp.receipt_url, pp.created_at,
    coalesce(g.phone, s.guardian_phone),
    sch.name,
    count(*) over() as total_count
  from public.pending_payments pp
  join public.student_fees f on f.id = pp.fee_id
  join public.students s on s.id = f.student_id
  left join public.profiles g on g.id = pp.guardian_id
  left join public.schools sch on sch.id = pp.school_id
  where pp.school_id = public.my_school_id() and pp.status = 'pending'
    and (pp.method <> 'thawani' or pp.txn_state = 'failed')
  order by pp.created_at
  limit greatest(1, least(coalesce(p_page_size, 20), 100))
  offset greatest(0, (coalesce(p_page, 1) - 1) * greatest(1, least(coalesce(p_page_size, 20), 100)));
end;
$function$
;

CREATE OR REPLACE FUNCTION public.plan_usage()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_school   uuid;
  v_plan     text;
  v_p        public.plans%rowtype;
  v_students int;
  v_staff    int;
  v_pct      numeric;
begin
  v_school := my_school_id();
  if v_school is null then
    return jsonb_build_object('ok', false, 'reason', 'no_school');
  end if;

  select coalesce(sub.plan::text, 'starter') into v_plan
  from public.subscriptions sub
  where sub.school_id = v_school
    and sub.status in ('active','trial','pending')
  order by sub.created_at desc
  limit 1;

  v_plan := coalesce(v_plan, 'starter');

  select * into v_p from public.plans where code = v_plan;
  if not found then
    select * into v_p from public.plans where code = 'starter';
  end if;

  select count(*) into v_students
  from public.students
  where school_id = v_school and deleted_at is null and status = 'active';

  select count(*) into v_staff
  from public.profiles
  where school_id = v_school and role in ('owner','admin','accountant');

  v_pct := case
    when v_p.max_students is null then 0
    when v_p.max_students = 0 then 0
    else round((v_students::numeric / v_p.max_students) * 100, 1)
  end;

  return jsonb_build_object(
    'ok', true,
    'plan_code', v_p.code,
    'plan_name', v_p.name_ar,
    'price_omr', v_p.price_omr,
    'students_used', v_students,
    'students_max', v_p.max_students,
    'students_pct', v_pct,
    'staff_used', v_staff,
    'staff_max', v_p.max_staff,
    'near_limit', (v_p.max_students is not null and v_pct >= 90),
    'over_limit', (v_p.max_students is not null and v_students > v_p.max_students),
    'suggested_plan', (
      select p2.name_ar from public.plans p2
      where p2.is_active
        and (p2.max_students is null or p2.max_students >= v_students)
        and p2.sort_order > v_p.sort_order
      order by p2.sort_order limit 1
    )
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.platform_audit_log(p_limit integer DEFAULT 100)
 RETURNS TABLE(id uuid, school_name text, actor_name text, action text, details text, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    a.id, s.name, coalesce(p.full_name, 'النظام'),
    a.action, a.details, a.created_at
  from public.audit_log a
  left join public.schools s on s.id = a.school_id
  left join public.profiles p on p.id = a.actor_id
  where public.is_platform_admin()
  order by a.created_at desc
  limit p_limit;
$function$
;

CREATE OR REPLACE FUNCTION public.platform_error_log(p_limit integer DEFAULT 100, p_severity text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, school_name text, source text, severity text, message text, context jsonb, resolved boolean, created_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select e.id, coalesce(s.name, '—'), e.source, e.severity, e.message, e.context, e.resolved, e.created_at
  from public.error_log e
  left join public.schools s on s.id = e.school_id
  where public.my_role() = 'platform_admin'
    and (p_severity is null or e.severity = p_severity)
  order by e.created_at desc
  limit greatest(1, least(p_limit, 500));
$function$
;

CREATE OR REPLACE FUNCTION public.platform_feedback(p_limit integer DEFAULT 200)
 RETURNS TABLE(id uuid, school_name text, author_name text, kind text, priority text, body text, status text, reply text, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    f.id, s.name, f.author_name,
    f.kind, f.priority, f.body, f.status,
    f.reply, f.created_at
  from public.feedback f
  left join public.schools s on s.id = f.school_id
  where public.is_platform_admin()
  order by
    case f.status when 'open' then 0 else 1 end,
    case f.priority when 'urgent' then 0 when 'important' then 1 else 2 end,
    f.created_at desc
  limit p_limit;
$function$
;

CREATE OR REPLACE FUNCTION public.platform_school_analytics()
 RETURNS TABLE(school_id uuid, school_name text, country text, students integer, employees integer, fees_total numeric, fees_paid numeric, collection_rate integer, last_activity timestamp with time zone, is_test boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    s.id, s.name, s.country,
    (select count(*) from public.students st where st.school_id = s.id and st.status = 'active' and st.deleted_at is null)::int,
    (select count(*) from public.employees e where e.school_id = s.id and e.deleted_at is null)::int,
    coalesce((select sum(f.total) from public.student_fees f where f.school_id = s.id), 0),
    coalesce((select sum(f.paid) from public.student_fees f where f.school_id = s.id), 0),
    case when coalesce((select sum(f.total) from public.student_fees f where f.school_id = s.id), 0) > 0
      then round(coalesce((select sum(f.paid) from public.student_fees f where f.school_id = s.id), 0)
        / (select sum(f.total) from public.student_fees f where f.school_id = s.id) * 100)::int
      else 100 end,
    (select max(a.created_at) from public.audit_log a where a.school_id = s.id),
    s.is_test
  from public.schools s
  where public.is_platform_admin()
  order by s.is_test asc, s.name;
$function$
;

CREATE OR REPLACE FUNCTION public.platform_school_audit(p_school_id uuid, p_limit integer DEFAULT 60)
 RETURNS TABLE(id uuid, actor_name text, action text, details text, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select a.id, coalesce(p.full_name,'—'), a.action, a.details, a.created_at
  from public.audit_log a
  left join public.profiles p on p.id = a.actor_id
  where a.school_id = p_school_id and public.is_platform_admin()
  order by a.created_at desc
  limit p_limit;
$function$
;

CREATE OR REPLACE FUNCTION public.platform_school_detail(p_school_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_result jsonb;
begin
  if not is_platform_admin() then
    raise exception 'غير مصرّح';
  end if;

  select jsonb_build_object(
    'school', (select to_jsonb(s) from public.schools s where s.id = p_school_id),
    'subscription', (select to_jsonb(x) from (
        select plan, status, trial_ends_at, renews_at, pay_method, receipt_url, created_at,
               case plan::text
                 when 'monthly'  then 7
                 when 'yearly'   then 72
                 when 'lifetime' then 350
                 else 0
               end as amount
        from public.subscriptions
        where school_id = p_school_id
        order by created_at desc
        limit 1
    ) x),
    'users', (select coalesce(jsonb_agg(to_jsonb(u)), '[]'::jsonb) from (
        select id, full_name, role, created_at
        from public.profiles where school_id = p_school_id
    ) u),
    -- ⚠️ إصلاح: استُثني الطلاب المحذوفون بصمت وغير النشطين — كانت هذي الدالة
    -- تحسب كل صف بجدول الطلاب بلا أي شرط، حتى المحذوفين والمنقولين والمتخرجين
    -- ⚠️ إصلاح إضافي: أُضيف عدّاد fees (كان ناقصًا وتسبب بعرض 0 بالواجهة رغم
    -- توفر fees_total/collected فعليًا)
    'stats', jsonb_build_object(
      'students',   (select count(*) from public.students   where school_id = p_school_id and status = 'active' and deleted_at is null),
      'employees',  (select count(*) from public.employees  where school_id = p_school_id and deleted_at is null),
      'fees',       (select count(*) from public.student_fees where school_id = p_school_id),
      'fees_total', (select coalesce(sum(total), 0) from public.student_fees where school_id = p_school_id),
      'collected',  (select coalesce(sum(paid), 0)  from public.student_fees where school_id = p_school_id)
    )
  ) into v_result;

  return v_result;
end $function$
;

CREATE OR REPLACE FUNCTION public.platform_set_user_active(p_user_id uuid, p_active boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_school uuid; v_role user_role;
begin
  if not public.is_platform_admin() then
    raise exception 'غير مصرّح: لمدير المنصة فقط';
  end if;
  select school_id, role into v_school, v_role from public.profiles where id = p_user_id;
  -- حماية: لا يمكن إيقاف مدير المدرسة (حفاظاً على وصول المدرسة لحسابها)
  if v_role = 'owner' and not p_active then
    raise exception 'لا يمكن إيقاف مدير المدرسة';
  end if;
  update public.profiles set active = p_active where id = p_user_id;

  insert into public.audit_log(school_id, actor_id, action, details)
  values (v_school, auth.uid(),
    case when p_active then 'تفعيل مستخدم من مدير المنصة' else 'إيقاف مستخدم من مدير المنصة' end,
    'معالجة دعم');
end;
$function$
;

CREATE OR REPLACE FUNCTION public.platform_summary()
 RETURNS TABLE(total_schools bigint, active_subs bigint, pending_subs bigint, trial_subs bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    (select count(*) from public.schools),
    (select count(*) from public.subscriptions where status = 'active'),
    (select count(*) from public.subscriptions where status = 'pending'),
    (select count(*) from public.subscriptions where status = 'trial')
  where public.is_platform_admin();
$function$
;

CREATE OR REPLACE FUNCTION public.platform_system_health()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
  v_conn jsonb;
  v_queue jsonb;
  v_whatsapp jsonb;
  v_email jsonb;
  v_payments jsonb;
  v_errors jsonb;
  v_quotas jsonb;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'غير مصرّح: صحّة النظام لمدير المنصة فقط';
  END IF;

  SELECT jsonb_build_object(
    'total', count(*),
    'active', count(*) FILTER (WHERE state = 'active'),
    'idle', count(*) FILTER (WHERE state = 'idle'),
    'max_connections', (SELECT setting::int FROM pg_settings WHERE name = 'max_connections')
  ) INTO v_conn
  FROM pg_stat_activity
  WHERE datname = current_database();

  SELECT jsonb_build_object(
    'pending', count(*) FILTER (WHERE status IN ('queued','processing')),
    'dead', count(*) FILTER (WHERE status = 'dead'),
    'oldest_pending_seconds', COALESCE(EXTRACT(EPOCH FROM (now() - min(created_at) FILTER (WHERE status IN ('queued','processing')))), 0)
  ) INTO v_queue
  FROM notification_queue;

  SELECT jsonb_build_object(
    'sample_size', count(*),
    'sent', count(*) FILTER (WHERE status = 'sent'),
    'failed', count(*) FILTER (WHERE status IN ('failed','dead')),
    'last_sent_at', max(sent_at) FILTER (WHERE status = 'sent')
  ) INTO v_whatsapp
  FROM (
    SELECT status, sent_at FROM notification_queue
    WHERE channel = 'whatsapp' AND status IN ('sent','failed','dead')
    ORDER BY created_at DESC LIMIT 100
  ) w;

  SELECT jsonb_build_object(
    'sample_size', count(*),
    'sent', count(*) FILTER (WHERE status = 'sent'),
    'failed', count(*) FILTER (WHERE status IN ('failed','dead')),
    'last_sent_at', max(sent_at) FILTER (WHERE status = 'sent')
  ) INTO v_email
  FROM (
    SELECT status, sent_at FROM notification_queue
    WHERE channel = 'email' AND status IN ('sent','failed','dead')
    ORDER BY created_at DESC LIMIT 100
  ) e;

  SELECT jsonb_build_object(
    'last_paid_at', max(created_at) FILTER (WHERE to_state = 'paid'),
    'last_failed_at', max(created_at) FILTER (WHERE to_state = 'failed'),
    'paid_24h', count(*) FILTER (WHERE to_state = 'paid' AND created_at > now() - interval '24 hours'),
    'failed_24h', count(*) FILTER (WHERE to_state = 'failed' AND created_at > now() - interval '24 hours')
  ) INTO v_payments
  FROM payment_state_log;

  SELECT jsonb_build_object(
    'critical_24h', count(*) FILTER (WHERE severity = 'critical' AND created_at > now() - interval '24 hours'),
    'unresolved_total', count(*) FILTER (WHERE resolved IS NOT TRUE)
  ) INTO v_errors
  FROM error_log;

  -- حصص Supabase الفعلية القابلة للقياس مباشرة من القاعدة (بدون API خارجي):
  -- حجم قاعدة البيانات ومساحة التخزين، ضد حدود الخطة المجانية.
  SELECT jsonb_build_object(
    'db_size_bytes', pg_database_size(current_database()),
    'db_limit_bytes', 500 * 1024 * 1024,
    'storage_size_bytes', COALESCE((SELECT SUM((metadata->>'size')::bigint) FROM storage.objects), 0),
    'storage_limit_bytes', 1024 * 1024 * 1024
  ) INTO v_quotas;

  v_result := jsonb_build_object(
    'connections', v_conn,
    'queue', v_queue,
    'whatsapp', v_whatsapp,
    'email', v_email,
    'payments', v_payments,
    'errors', v_errors,
    'quotas', v_quotas,
    'generated_at', now()
  );

  RETURN v_result;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.platform_update_school(p_school_id uuid, p_name text DEFAULT NULL::text, p_phone text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_address text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_platform_admin() then
    raise exception 'غير مصرّح: لمدير المنصة فقط';
  end if;
  update public.schools set
    name = coalesce(nullif(trim(p_name),''), name),
    phone = coalesce(nullif(trim(p_phone),''), phone),
    email = coalesce(nullif(trim(p_email),''), email),
    address = coalesce(nullif(trim(p_address),''), address)
  where id = p_school_id;

  insert into public.audit_log(school_id, actor_id, action, details)
  values (p_school_id, auth.uid(), 'تعديل بيانات المدرسة من مدير المنصة', 'معالجة دعم');
end;
$function$
;

CREATE OR REPLACE FUNCTION public.promote_students(p_academic_year text, p_repeat_ids uuid[] DEFAULT '{}'::uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_school   uuid;
  v_promoted int := 0;
  v_graduated int := 0;
  v_repeated int := 0;
begin
  v_school := my_school_id();
  if v_school is null then
    raise exception 'لا مدرسة مرتبطة بحسابك';
  end if;
  if my_role() not in ('owner','admin') then
    raise exception 'ترقية الطلاب للمدير أو الإداري فقط';
  end if;
  if coalesce(trim(p_academic_year), '') = '' then
    raise exception 'العام الدراسي مطلوب';
  end if;

  -- منع التنفيذ مرّتين لنفس العام
  if exists (
    select 1 from public.promotion_log
    where school_id = v_school and academic_year = trim(p_academic_year)
  ) then
    return jsonb_build_object(
      'ok', false,
      'reason', 'already_promoted',
      'message', 'نُفّذت ترقية هذا العام مسبقاً — لا يمكن تكرارها'
    );
  end if;

  -- 1) الترقية: الطلاب النشطون غير المعيدين ولهم صف تالٍ
  with moved as (
    update public.students s
    set grade = public.next_grade(s.grade)
    where s.school_id = v_school
      and s.deleted_at is null
      and s.status = 'active'
      and s.id <> all(p_repeat_ids)
      and public.next_grade(s.grade) is not null
    returning 1
  )
  select count(*) into v_promoted from moved;

  -- 2) التخرّج: الصف الأخير، غير المعيدين
  with grads as (
    update public.students s
    set status = 'graduated'
    where s.school_id = v_school
      and s.deleted_at is null
      and s.status = 'active'
      and s.id <> all(p_repeat_ids)
      and trim(s.grade) = 'الثاني عشر'
    returning 1
  )
  select count(*) into v_graduated from grads;

  -- 3) المعيدون: يبقون كما هم (لا تغيير) — نحصيهم فقط
  select count(*) into v_repeated
  from public.students s
  where s.school_id = v_school
    and s.deleted_at is null
    and s.status = 'active'
    and s.id = any(p_repeat_ids);

  -- 4) سجّل العملية (يمنع التكرار مستقبلاً)
  insert into public.promotion_log
    (school_id, actor_id, academic_year, promoted, repeated, graduated)
  values
    (v_school, auth.uid(), trim(p_academic_year), v_promoted, v_repeated, v_graduated);

  -- 5) وثّق في سجل التدقيق
  insert into public.audit_log (school_id, actor_id, action, details)
  values (
    v_school, auth.uid(), 'ترقية نهاية العام',
    'العام ' || trim(p_academic_year) || ': رُقّي ' || v_promoted ||
    ' · أعاد ' || v_repeated || ' · تخرّج ' || v_graduated
  );

  return jsonb_build_object(
    'ok', true,
    'promoted', v_promoted,
    'repeated', v_repeated,
    'graduated', v_graduated
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.promotion_preview(p_repeat_ids uuid[] DEFAULT '{}'::uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_school   uuid;
  v_promote  int := 0;
  v_graduate int := 0;
  v_repeat   int := 0;
  v_unknown  int := 0;
begin
  v_school := my_school_id();
  if v_school is null or my_role() not in ('owner','admin') then
    return jsonb_build_object('ok', false, 'reason', 'unauthorized');
  end if;

  select
    count(*) filter (where s.id <> all(p_repeat_ids) and public.next_grade(s.grade) is not null),
    count(*) filter (where s.id <> all(p_repeat_ids) and public.next_grade(s.grade) is null and trim(s.grade) = 'الثاني عشر'),
    count(*) filter (where s.id = any(p_repeat_ids)),
    count(*) filter (where public.next_grade(s.grade) is null and trim(s.grade) <> 'الثاني عشر')
  into v_promote, v_graduate, v_repeat, v_unknown
  from public.students s
  where s.school_id = v_school
    and s.deleted_at is null
    and s.status = 'active';

  return jsonb_build_object(
    'ok', true,
    'to_promote', v_promote,
    'to_graduate', v_graduate,
    'to_repeat', v_repeat,
    'unknown_grade', v_unknown
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.public_schools()
 RETURNS TABLE(id uuid, name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select id, name from public.schools order by name;
$function$
;

CREATE OR REPLACE FUNCTION public.recommendations_impact()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_school uuid;
  v_acted  int;
  v_expected numeric;
  v_collected numeric;
begin
  v_school := my_school_id();
  if v_school is null or my_role() not in ('owner','admin','accountant') then
    return jsonb_build_object('ok', false, 'reason', 'unauthorized');
  end if;

  -- كم توصية نُفّذت هذا الشهر
  select count(*), coalesce(sum(expected_amount), 0)
    into v_acted, v_expected
  from public.recommendation_log
  where school_id = v_school
    and created_at >= date_trunc('month', current_date);

  -- كم تحصّل فعلياً بعد تنفيذ توصيات التذكير هذا الشهر
  -- (مدفوعات سُجّلت بعد وقت التوصية)
  select coalesce(sum(sf.paid), 0) into v_collected
  from public.student_fees sf
  where sf.school_id = v_school
    and sf.updated_at >= date_trunc('month', current_date);

  return jsonb_build_object(
    'ok', true,
    'actions_this_month', v_acted,
    'expected_amount', round(v_expected, 3),
    'collected_this_month', round(v_collected, 3)
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.record_backup()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_school uuid;
begin
  v_school := my_school_id();
  if v_school is null or my_role() not in ('owner','admin') then
    return;
  end if;

  insert into public.backup_log (school_id, last_backup, actor_id, count)
  values (v_school, now(), auth.uid(), 1)
  on conflict (school_id) do update set
    last_backup = now(),
    actor_id = auth.uid(),
    count = public.backup_log.count + 1;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.record_meal_taken(p_student_id uuid, p_plan_id uuid, p_date date DEFAULT CURRENT_DATE)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_school uuid;
begin
  v_school := public.my_school_id();
  if v_school is null or public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح بتسجيل الوجبات';
  end if;
  insert into public.meal_orders(school_id, student_id, plan_id, meal_date)
  values (v_school, p_student_id, p_plan_id, p_date)
  on conflict (student_id, plan_id, meal_date) do nothing;
  return jsonb_build_object('ok', true);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.record_meals_today_bulk(p_date date DEFAULT CURRENT_DATE)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_school uuid; v_count int := 0;
begin
  v_school := public.my_school_id();
  if v_school is null or public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح بتسجيل الوجبات';
  end if;

  insert into public.meal_orders(school_id, student_id, plan_id, meal_date)
  select ms.school_id, ms.student_id, ms.plan_id, p_date
  from public.meal_subscriptions ms
  join public.students st on st.id = ms.student_id
  where ms.school_id = v_school and st.status = 'active'
  on conflict (student_id, plan_id, meal_date) do nothing;

  get diagnostics v_count = row_count;
  return jsonb_build_object('ok', true, 'recorded', v_count);
end;
$function$
;

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
  v_dup_count int;
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

  -- حارس التكرار: نفس الفاتورة + نفس المبلغ + نفس الطريقة خلال آخر 10 ثوانٍ
  select count(*) into v_dup_count
  from public.payments
  where fee_id = p_fee_id
    and amount = p_amount
    and method = coalesce(p_method, 'bank')
    and created_at > now() - interval '10 seconds';

  if v_dup_count > 0 then
    raise exception 'تم رصد محاولة تسجيل دفعة مكررة (نفس المبلغ والطريقة خلال ثوانٍ قليلة) — تم رفضها للحماية من الازدواج';
  end if;

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
end $function$
;

CREATE OR REPLACE FUNCTION public.record_thawani_payment(p_pending_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  return public._confirm_thawani_payment_core(p_pending_id, null);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.record_uploaded_certificate(p_student_id uuid, p_title text, p_file_path text, p_file_name text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_school uuid; v_serial text; v_id uuid; v_name text;
begin
  v_school := public.my_school_id();
  if public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح برفع الشهادات';
  end if;
  if not exists (select 1 from public.students where id = p_student_id and school_id = v_school) then
    raise exception 'الطالب غير موجود في مدرستك';
  end if;
  select full_name into v_name from public.students where id = p_student_id;
  v_serial := 'UPL-' || to_char(now(),'YYYYMMDD') || '-' || upper(substr(p_student_id::text,1,6));

  insert into public.certificates(school_id, student_id, kind, title, serial, file_path, file_name, issued_by)
  values (v_school, p_student_id, 'uploaded', coalesce(nullif(trim(p_title),''),'شهادة مرفوعة'), v_serial, p_file_path, p_file_name, auth.uid())
  returning id into v_id;

  insert into public.audit_log(school_id, actor_id, action, details)
  values (v_school, auth.uid(), 'رفع شهادة', v_name || ' · ' || coalesce(p_file_name,''));

  return v_id;
end;
$function$
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
end $function$
;

CREATE OR REPLACE FUNCTION public.register_school(p_name text, p_branch text, p_country text, p_currency text, p_cr text, p_license text, p_vat text, p_phone text, p_email text, p_address text, p_owner_name text, p_bank_iban text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare new_school_id uuid;
begin
  if exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'لديك مدرسة مسجّلة بالفعل بهذا الحساب';
  end if;

  -- التحقق من رقم الحساب البنكي إن أُدخل (الصيغة والطول حسب الدولة)
  if coalesce(trim(p_bank_iban),'') <> '' then
    declare v_iban text := upper(replace(p_bank_iban,' ',''));
            v_len int;
    begin
      v_len := case p_country
        when 'OM' then 23 when 'SA' then 24 when 'AE' then 23
        when 'QA' then 29 when 'KW' then 30 when 'BH' then 22 else 23 end;
      if v_iban !~ '^[A-Z]{2}[0-9A-Z]+$' then
        raise exception 'رقم الحساب البنكي (IBAN) غير صحيح';
      end if;
      if left(v_iban,2) <> p_country then
        raise exception 'يجب أن يبدأ الحساب البنكي برمز الدولة (%)', p_country;
      end if;
      if length(v_iban) <> v_len then
        raise exception 'طول الحساب البنكي غير صحيح (% من % خانة)', length(v_iban), v_len;
      end if;
      p_bank_iban := v_iban;
    end;
  end if;

  insert into public.schools(name,branch,country,currency,cr_number,moe_license,vat_number,phone,email,address,bank_iban,bank_enabled)
  values(p_name,p_branch,p_country,p_currency,p_cr,p_license,p_vat,p_phone,p_email,p_address,
         nullif(p_bank_iban,''), (nullif(p_bank_iban,'') is not null))
  returning id into new_school_id;

  if p_country = 'OM' then
    update public.schools set ins_cap = 3000, ins_configured = true where id = new_school_id;
  else
    update public.schools set ins_configured = false where id = new_school_id;
  end if;

  insert into public.profiles(id,school_id,role,full_name,phone)
  values(auth.uid(), new_school_id, 'owner', coalesce(p_owner_name,'مدير المدرسة'), p_phone);

  insert into public.subscriptions(school_id,plan,status,trial_ends_at)
  values(new_school_id,'trial','trial', now() + interval '14 days');

  insert into public.accounts(school_id,code,name,type) values
    (new_school_id,'1110','الصندوق','asset'),
    (new_school_id,'1120','البنك','asset'),
    (new_school_id,'1210','ذمم أولياء الأمور','asset'),
    (new_school_id,'2210','ضريبة القيمة المضافة المستحقة','liability'),
    (new_school_id,'2320','رواتب مستحقة','liability'),
    (new_school_id,'3100','رأس المال','equity'),
    (new_school_id,'4100','إيرادات الرسوم الدراسية','revenue'),
    (new_school_id,'5110','مصروف الرواتب','expense'),
    (new_school_id,'5120','مصروف التأمينات','expense'),
    (new_school_id,'5210','مصاريف إدارية','expense');

  insert into public.audit_log(school_id,actor_id,action,details)
  values(new_school_id, auth.uid(), 'تسجيل مدرسة جديدة', p_name);

  return new_school_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.reject_certificate_request(p_request_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_school uuid;
begin
  v_school := public.my_school_id();
  if public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح';
  end if;
  update public.certificate_requests
  set status = 'rejected', reason = nullif(trim(p_reason),''), reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_request_id and school_id = v_school and status = 'pending';
  if not found then raise exception 'الطلب غير موجود أو تمت معالجته مسبقًا'; end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.reject_payment(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_school uuid; v_pp record;
begin
  v_school := public.my_school_id();
  if public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح';
  end if;
  select * into v_pp from public.pending_payments where id = p_id and school_id = v_school;
  if v_pp is null or v_pp.status <> 'pending' then raise exception 'غير قابل للرفض'; end if;

  update public.pending_payments
  set status = 'rejected', resolved_at = now(), resolved_by = auth.uid()
  where id = p_id;

  insert into public.notifications(school_id, audience, guardian_id, body)
  values (v_school, 'guardian', v_pp.guardian_id,
    '❌ تعذّر اعتماد دفعتك (' || to_char(v_pp.amount,'FM999990.000') || '). يرجى مراجعة المدرسة أو إعادة المحاولة.');
end;
$function$
;

CREATE OR REPLACE FUNCTION public.reject_subscription(p_sub_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare s record;
begin
  if not public.is_platform_admin() then
    raise exception 'غير مصرّح: لمدير المنصة فقط';
  end if;
  select * into s from public.subscriptions where id = p_sub_id and status = 'pending';
  if not found then raise exception 'الاشتراك غير موجود أو ليس معلّقاً'; end if;

  update public.subscriptions set status = 'expired' where id = p_sub_id;
  insert into public.audit_log(school_id, actor_id, action, details)
  values(s.school_id, auth.uid(), 'رفض اشتراك (تحويل بنكي)', p_sub_id::text);
end; $function$
;

CREATE OR REPLACE FUNCTION public.request_certificate(p_student_id uuid, p_kind text DEFAULT 'enrollment'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_school uuid;
  v_id uuid;
begin
  if public.my_role() <> 'parent' then
    raise exception 'هذا الإجراء متاح لولي الأمر فقط';
  end if;
  if p_kind not in ('enrollment','clearance','fees_statement') then
    raise exception 'نوع شهادة غير مدعوم';
  end if;
  if not exists (select 1 from public.parent_students where parent_id = auth.uid() and student_id = p_student_id) then
    raise exception 'هذا الطالب غير مرتبط بحسابك';
  end if;
  select school_id into v_school from public.students where id = p_student_id;
  if v_school is null then raise exception 'الطالب غير موجود'; end if;

  if exists (
    select 1 from public.certificate_requests
    where student_id = p_student_id and kind = p_kind and status = 'pending'
  ) then
    raise exception 'لديك طلب سابق قيد الانتظار لهذه الشهادة';
  end if;

  insert into public.certificate_requests(school_id, student_id, parent_id, kind)
  values (v_school, p_student_id, auth.uid(), p_kind)
  returning id into v_id;

  return v_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.resolve_error(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if public.my_role() <> 'platform_admin' then
    raise exception 'غير مصرّح';
  end if;
  update public.error_log set resolved = true where id = p_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.resolve_feedback(p_id uuid, p_status text, p_reply text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_platform_admin() then
    raise exception 'غير مصرّح: متابعة الشكاوى لمدير المنصة فقط';
  end if;
  update public.feedback
  set status = coalesce(nullif(p_status,''), status),
      reply = coalesce(p_reply, reply),
      updated_at = now()
  where id = p_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.restore_record(p_table text, p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if public.my_role() not in ('owner','admin') then
    raise exception 'غير مصرّح بالاسترجاع';
  end if;
  if p_table not in ('students','student_fees','payments','employees','journal_entries','certificates') then
    raise exception 'جدول غير مدعوم';
  end if;
  execute format(
    'update public.%I set deleted_at = null where id = $1 and school_id = public.my_school_id()',
    p_table
  ) using p_id;

  insert into public.audit_log(school_id, actor_id, action, details)
  values (public.my_school_id(), auth.uid(), 'استرجاع سجلّ: ' || p_table, p_id::text);
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
  if public.my_role() not in ('owner','accountant') then
    raise exception 'غير مصرّح: عكس القيود لمدير المدرسة أو المحاسب فقط';
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
  v_school uuid;
  v_rows   jsonb := '[]'::jsonb;
  r        record;
  v_score      numeric;
  v_age_pts    numeric;
  v_ratio_pts  numeric;
  v_count_pts  numeric;
  v_level      text;
  v_action     text;
begin
  v_school := public.my_school_id();
  if v_school is null then return jsonb_build_object('error','no_school'); end if;

  if not public.intelligence_enabled('risk') then
    return jsonb_build_object('ok', false, 'disabled', true);
  end if;

  for r in
    select
      s.id as student_id, s.full_name, s.code,
      coalesce(s.guardian_name, '—') as guardian, s.guardian_phone as phone,
      coalesce(sum(f.total - f.paid), 0) as outstanding,
      coalesce(sum(f.total), 0)          as total_billed,
      count(*) filter (where f.paid < f.total and f.due_date is not null and f.due_date < current_date) as overdue_count,
      coalesce(max(current_date - f.due_date) filter (where f.paid < f.total and f.due_date is not null and f.due_date < current_date), 0) as oldest_days
    from public.students s
    join public.student_fees f on f.student_id = s.id and f.school_id = v_school
    -- ⚠️ إصلاح: استُثني الطلاب المحذوفون بصمت — كان محرّك المخاطر يقترح "اتصال
    -- مباشر بولي الأمر" لتحصيل دين طالب غير مسجّل بالمدرسة فعلياً
    where s.school_id = v_school and s.status = 'active' and s.deleted_at is null
    group by s.id, s.full_name, s.code, s.guardian_name, s.guardian_phone
    having coalesce(sum(f.total - f.paid), 0) > 0.0005
    order by
      coalesce(max(current_date - f.due_date) filter (where f.paid < f.total and f.due_date is not null and f.due_date < current_date), 0) desc,
      coalesce(sum(f.total - f.paid), 0) desc
  loop
    v_age_pts   := least(45, r.oldest_days::numeric / 90 * 45);
    v_ratio_pts := case when r.total_billed > 0 then least(35, r.outstanding / r.total_billed * 35) else 0 end;
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
      'outstanding', round(r.outstanding, 3),
      'overdue_count', r.overdue_count,
      'oldest_days', r.oldest_days,
      'score', v_score,
      'level', v_level,
      'action', v_action
    );
  end loop;

  return jsonb_build_object('ok', true, 'items', v_rows);
end; $function$
;

CREATE OR REPLACE FUNCTION public.save_bus(p_routes text[], p_driver text, p_supervisor text, p_capacity integer, p_fee numeric, p_pay_to text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_school uuid; v_id uuid; v_routes text[];
begin
  v_school := public.my_school_id();
  if v_school is null or public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح بإدارة الباصات';
  end if;

  select array_agg(nullif(trim(x),'')) filter (where nullif(trim(x),'') is not null)
    into v_routes from unnest(coalesce(p_routes, '{}')) x;

  if v_routes is null or array_length(v_routes,1) is null then
    raise exception 'مسار واحد على الأقل مطلوب';
  end if;
  if coalesce(trim(p_driver),'') = '' then
    raise exception 'اسم السائق مطلوب';
  end if;
  if coalesce(p_fee,0) <= 0 then raise exception 'الرسم الشهري يجب أن يكون أكبر من صفر'; end if;
  if coalesce(p_pay_to,'school') not in ('school','driver','private') then
    raise exception 'جهة الدفع غير صحيحة';
  end if;

  insert into public.buses(school_id, route, routes, driver, supervisor, capacity, fee, pay_to)
  values (v_school, array_to_string(v_routes,' / '), v_routes, trim(p_driver),
          nullif(trim(p_supervisor),''), coalesce(p_capacity,30), p_fee, coalesce(p_pay_to,'school'))
  returning id into v_id;
  return v_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.save_food_item(p_name text, p_unit text, p_qty numeric, p_cost numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_school uuid; v_id uuid; v_opening_value numeric; v_entry uuid;
BEGIN
  v_school := public.my_school_id();
  IF public.my_role() NOT IN ('owner','admin','accountant') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  IF v_school IS NULL OR coalesce(trim(p_name),'') = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_input');
  END IF;

  INSERT INTO public.food_inventory (school_id, name, unit, qty, cost)
  VALUES (v_school, trim(p_name), coalesce(nullif(trim(p_unit),''),'كجم'), coalesce(p_qty,0), coalesce(p_cost,0))
  RETURNING id INTO v_id;

  v_opening_value := round(coalesce(p_qty,0) * coalesce(p_cost,0), 3);
  IF v_opening_value > 0 THEN
    PERFORM public.ensure_inventory_accounts();

    INSERT INTO public.journal_entries (school_id, description, reference, created_by)
    VALUES (v_school, 'رصيد افتتاحي لمخزون تغذية: ' || p_name || ' ×' || p_qty, 'FOPEN-' || left(v_id::text,8), auth.uid())
    RETURNING id INTO v_entry;

    INSERT INTO public.journal_lines (school_id, entry_id, account_id, debit, credit) VALUES
      (v_school, v_entry, public.acc_id('1320'), v_opening_value, 0),
      (v_school, v_entry, public.acc_id('3100'), 0, v_opening_value);
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.save_grade_fee(p_grade text, p_annual_fee numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_school uuid;
begin
  if public.my_role() not in ('owner','admin') then
    raise exception 'غير مصرّح: تعديل تسعير المراحل للمدير أو الإداري فقط';
  end if;
  v_school := public.my_school_id();
  if coalesce(trim(p_grade),'') = '' then raise exception 'المرحلة مطلوبة'; end if;
  if p_annual_fee is null or p_annual_fee < 0 then raise exception 'قيمة الرسوم غير صحيحة'; end if;

  insert into public.grade_fees(school_id, grade, annual_fee)
  values (v_school, trim(p_grade), p_annual_fee)
  on conflict (school_id, grade) do update set annual_fee = excluded.annual_fee, updated_at = now();

  insert into public.audit_log(school_id, actor_id, action, details)
  values (v_school, auth.uid(), 'تحديث تسعير مرحلة', trim(p_grade) || ' → ' || p_annual_fee::text);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.save_inventory_item(p_name text, p_qty integer, p_cost numeric, p_price numeric, p_vat numeric DEFAULT 5, p_category text DEFAULT 'أخرى'::text, p_subtype text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_school uuid; v_id uuid; v_opening_value numeric; v_entry uuid;
begin
  v_school := public.my_school_id();
  if v_school is null or public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح بإدارة المخزون';
  end if;
  if coalesce(trim(p_name),'') = '' then raise exception 'اسم الصنف مطلوب'; end if;

  insert into public.inventory_items(school_id, name, qty, cost, price, vat_rate, category, subtype)
  values (v_school, p_name, coalesce(p_qty,0), coalesce(p_cost,0), coalesce(p_price,0), coalesce(p_vat,5),
          coalesce(nullif(trim(p_category),''), 'أخرى'), nullif(trim(coalesce(p_subtype,'')), ''))
  returning id into v_id;

  v_opening_value := round(coalesce(p_qty,0) * coalesce(p_cost,0), 3);
  if v_opening_value > 0 then
    perform public.ensure_inventory_accounts();

    insert into public.journal_entries(school_id, description, reference, created_by)
    values (v_school, 'رصيد افتتاحي لمخزون: ' || p_name || ' ×' || p_qty, 'OPEN-' || left(v_id::text,8), auth.uid())
    returning id into v_entry;

    insert into public.journal_lines(school_id, entry_id, account_id, debit, credit) values
      (v_school, v_entry, public.acc_id('1310'), v_opening_value, 0),
      (v_school, v_entry, public.acc_id('3100'), 0, v_opening_value);
  end if;

  return v_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.save_meal_plan(p_name text, p_fee numeric, p_type text DEFAULT 'monthly'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_school uuid; v_id uuid;
begin
  v_school := public.my_school_id();
  if v_school is null or public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح بإدارة باقات التغذية';
  end if;
  if coalesce(trim(p_name),'') = '' then raise exception 'اسم الباقة مطلوب'; end if;
  if coalesce(p_fee,0) <= 0 then raise exception 'الرسم يجب أن يكون أكبر من صفر'; end if;
  if p_type not in ('annual','monthly') then raise exception 'نوع الباقة غير صحيح'; end if;

  insert into public.meal_plans(school_id, name, fee, plan_type)
  values (v_school, p_name, p_fee, p_type)
  returning id into v_id;
  return v_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.save_meal_purchase(p_id uuid, p_supplier uuid, p_date date, p_type text, p_meals integer, p_unit_cost numeric, p_period text, p_paid boolean, p_notes text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_school uuid;
  v_role   user_role;
  v_id     uuid;
  v_total  numeric;
  v_entry  uuid;
  v_supplier_name text;
begin
  v_school := public.my_school_id();
  v_role   := public.my_role();
  if v_school is null then raise exception 'لا مدرسة مرتبطة بحسابك'; end if;
  if v_role not in ('owner','admin','accountant') then raise exception 'غير مصرّح'; end if;

  v_total := coalesce(p_meals,0) * coalesce(p_unit_cost,0);

  if p_id is null then
    perform public.ensure_meal_cost_accounts();
    select name into v_supplier_name from public.suppliers where id = p_supplier;

    insert into public.meal_purchases(
      school_id, supplier_id, purchase_date, purchase_type,
      meals_count, unit_cost, total_cost, period, paid, notes, created_by
    ) values (
      v_school, p_supplier, coalesce(p_date, current_date),
      coalesce(nullif(trim(p_type),''),'daily'),
      coalesce(p_meals,0), coalesce(p_unit_cost,0), v_total,
      nullif(trim(p_period),''), coalesce(p_paid,false), nullif(trim(p_notes),''), auth.uid()
    )
    returning id into v_id;

    if v_total > 0 then
      insert into public.journal_entries (school_id, description, reference, created_by)
      values (
        v_school,
        'مشتريات وجبات: ' || coalesce(v_supplier_name,'—') || ' (' || coalesce(p_meals,0) || ' وجبة)',
        'MPUR-' || left(v_id::text,8), auth.uid()
      )
      returning id into v_entry;

      insert into public.journal_lines (school_id, entry_id, account_id, debit, credit) values
        (v_school, v_entry, public.acc_id('5230'), v_total, 0),
        (v_school, v_entry,
         case when coalesce(p_paid,false) then public.acc_id('1120') else public.acc_id('2110') end,
         0, v_total);

      update public.meal_purchases set journal_entry_id = v_entry where id = v_id;
    end if;
  else
    update public.meal_purchases set
      supplier_id = p_supplier, purchase_date = coalesce(p_date, current_date),
      purchase_type = coalesce(nullif(trim(p_type),''),'daily'),
      meals_count = coalesce(p_meals,0), unit_cost = coalesce(p_unit_cost,0),
      total_cost = v_total, period = nullif(trim(p_period),''),
      notes = nullif(trim(p_notes),''), updated_at = now()
    where id = p_id and school_id = v_school
    returning id into v_id;
    if v_id is null then raise exception 'الشراء غير موجود في مدرستك'; end if;
  end if;

  return v_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.save_supplier(p_id uuid, p_name text, p_contact text, p_phone text, p_email text, p_vat text, p_active boolean)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_school uuid;
  v_role   user_role;
  v_id     uuid;
begin
  v_school := public.my_school_id();
  v_role   := public.my_role();
  if v_school is null then raise exception 'لا مدرسة مرتبطة بحسابك'; end if;
  if v_role not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح';
  end if;
  if coalesce(trim(p_name),'') = '' then raise exception 'اسم المورّد مطلوب'; end if;

  if p_id is null then
    insert into public.suppliers(school_id, name, contact_name, phone, email, vat_number, active)
    values (v_school, trim(p_name), nullif(trim(p_contact),''), nullif(trim(p_phone),''),
            nullif(trim(p_email),''), nullif(trim(p_vat),''), coalesce(p_active,true))
    returning id into v_id;
  else
    update public.suppliers set
      name = trim(p_name), contact_name = nullif(trim(p_contact),''),
      phone = nullif(trim(p_phone),''), email = nullif(trim(p_email),''),
      vat_number = nullif(trim(p_vat),''), active = coalesce(p_active,true)
    where id = p_id and school_id = v_school
    returning id into v_id;
    if v_id is null then raise exception 'المورّد غير موجود في مدرستك'; end if;
  end if;

  return v_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.school_copilot()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
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
    from public.pending_payments where school_id = v_school and status = 'pending';

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
end; $function$
;

CREATE OR REPLACE FUNCTION public.send_announcement(p_title text, p_body text, p_kind text, p_target text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_id uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'غير مصرّح: إرسال الإعلانات لمدير المنصة فقط';
  end if;
  if p_title is null or length(trim(p_title)) = 0 then
    raise exception 'عنوان الإعلان مطلوب';
  end if;
  insert into public.announcements(title, body, kind, target, created_by)
  values(trim(p_title), trim(p_body), coalesce(p_kind,'info'), coalesce(p_target,'all'), auth.uid())
  returning id into v_id;
  return v_id;
end; $function$
;

CREATE OR REPLACE FUNCTION public.set_country_enabled(p_code text, p_enabled boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_platform_admin() then
    raise exception 'غير مصرّح — هذا الإجراء لمالك المنصّة فقط';
  end if;
  update public.platform_countries
    set enabled = p_enabled, updated_at = now()
    where code = p_code;
  if not found then
    raise exception 'دولة غير معروفة: %', p_code;
  end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_current_academic_year(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_school uuid;
begin
  v_school := my_school_id();
  if v_school is null or my_role() not in ('owner','admin') then
    raise exception 'غير مصرّح';
  end if;
  if not exists (select 1 from public.academic_years
                 where id = p_id and school_id = v_school) then
    raise exception 'العام الدراسي غير موجود في مدرستك';
  end if;

  update public.academic_years set is_current = false
  where school_id = v_school and is_current = true;

  update public.academic_years set is_current = true
  where id = p_id and school_id = v_school;

  insert into public.audit_log (school_id, actor_id, action, details)
  values (v_school, auth.uid(), 'تعيين العام الدراسي الحالي',
          (select label from public.academic_years where id = p_id));
end $function$
;

CREATE OR REPLACE FUNCTION public.set_employee_manager(p_employee_id uuid, p_manager_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_school uuid;
  v_cursor uuid;
  v_guard  int := 0;
begin
  if public.my_role() <> 'owner' then
    raise exception 'غير مصرّح: تعديل الهيكل التنظيمي لمدير المدرسة فقط';
  end if;

  v_school := public.my_school_id();

  -- تأكّد أن الموظف والمدير من نفس المدرسة (عزل)
  if not exists (select 1 from public.employees where id = p_employee_id and school_id = v_school) then
    raise exception 'الموظف غير موجود في مدرستك';
  end if;
  if p_manager_id is not null then
    if not exists (select 1 from public.employees where id = p_manager_id and school_id = v_school) then
      raise exception 'المدير المحدّد غير موجود في مدرستك';
    end if;
    if p_manager_id = p_employee_id then
      raise exception 'لا يمكن أن يتبع الموظف نفسه';
    end if;
    -- منع الحلقات: اصعد سلسلة المديرين وتأكّد ألّا نعود للموظف
    v_cursor := p_manager_id;
    while v_cursor is not null and v_guard < 100 loop
      if v_cursor = p_employee_id then
        raise exception 'هذا التعيين يُنشئ حلقة في الهيكل التنظيمي';
      end if;
      select manager_id into v_cursor from public.employees where id = v_cursor;
      v_guard := v_guard + 1;
    end loop;
  end if;

  update public.employees set manager_id = p_manager_id where id = p_employee_id;

  insert into public.audit_log(school_id, actor_id, action, details)
  values (v_school, auth.uid(), 'set_manager', 'تحديث الهيكل التنظيمي للموظف');
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_employee_photo(p_employee_id uuid, p_photo_url text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_school uuid;
begin
  if public.my_role() <> 'owner' then
    raise exception 'غير مصرّح: تعديل صور الموظفين لمدير المدرسة فقط';
  end if;
  v_school := public.my_school_id();
  if not exists (select 1 from public.employees where id = p_employee_id and school_id = v_school) then
    raise exception 'الموظف غير موجود في مدرستك';
  end if;
  if p_photo_url is not null and length(trim(p_photo_url)) > 0
     and p_photo_url not like 'https://%' then
    raise exception 'رابط الصورة يجب أن يبدأ بـ https://';
  end if;
  update public.employees set photo_url = nullif(trim(p_photo_url), '') where id = p_employee_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_gateway_session(p_id uuid, p_session_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_pp record;
begin
  select * into v_pp from public.pending_payments where id = p_id for update;
  if v_pp is null then raise exception 'الدفعة غير موجودة'; end if;
  if v_pp.txn_state <> 'pending' then
    raise exception 'لا يمكن ربط جلسة دفع بدفعة ليست بحالة pending (الحالية: %)', v_pp.txn_state;
  end if;

  update public.pending_payments
  set txn_state = 'processing',
      provider_ref = p_session_id,
      state_updated_at = now()
  where id = p_id;

  insert into public.payment_state_log(payment_id, school_id, from_state, to_state, reason, actor_id)
  values (p_id, v_pp.school_id, 'pending', 'processing', 'thawani_session_created', null);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_intelligence_flag(p_engine text, p_enabled boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if public.my_role() <> 'owner' then
    raise exception 'غير مصرّح: ضبط محرّكات الذكاء لمدير المدرسة فقط';
  end if;
  insert into public.intelligence_flags(school_id, engine, enabled, updated_at)
  values (public.my_school_id(), p_engine, p_enabled, now())
  on conflict (school_id, engine)
  do update set enabled = excluded.enabled, updated_at = now();
end; $function$
;

CREATE OR REPLACE FUNCTION public.set_school_active(p_school_id uuid, p_active boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_platform_admin() then
    raise exception 'غير مصرّح: لمدير المنصة فقط';
  end if;
  -- يُستخدم حقل status في الاشتراك للإيقاف الفعلي
  if not p_active then
    update public.subscriptions set status = 'expired'
      where school_id = p_school_id and status = 'active';
  end if;
  insert into public.audit_log(school_id, actor_id, action, details)
  values(p_school_id, auth.uid(), case when p_active then 'تفعيل مدرسة' else 'إيقاف مدرسة' end, p_school_id::text);
end; $function$
;

CREATE OR REPLACE FUNCTION public.set_school_vat(p_enabled boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_mode text; v_school uuid;
begin
  if public.my_role() <> 'owner' then
    raise exception 'غير مصرّح: إعداد الضريبة لمدير المدرسة فقط';
  end if;
  v_school := public.my_school_id();

  select c.vat_mode into v_mode
  from public.schools s
  join public.platform_countries c on c.code = coalesce(s.country, 'OM')
  where s.id = v_school;

  if v_mode = 'mandatory' then
    raise exception 'الضريبة إلزامية في دولتك ولا يمكن تعطيلها';
  elsif v_mode = 'none' then
    raise exception 'لا توجد ضريبة مطبّقة في دولتك';
  end if;

  -- الحالة optional فقط تصل هنا
  update public.schools set vat_enabled = p_enabled where id = v_school;

  insert into public.audit_log(school_id, actor_id, action, details)
  values (v_school, auth.uid(), 'set_vat', 'تحديث إعداد احتساب الضريبة: ' || p_enabled::text);
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
  v_allowed text[] := array['ar_letters','numbers','en_letters','en_numbers'];
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
  -- رفض أي قيمة خارج القائمة المسموحة
  if exists (select 1 from unnest(p_styles) s where s <> all(v_allowed)) then
    raise exception 'نمط ترميز غير معروف';
  end if;

  update public.schools
    set section_styles = p_styles
    where id = v_school;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.smart_recommendations()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
 v_school uuid; v_recs jsonb := '[]'::jsonb;
 v_overdue_cnt int; v_overdue_amt numeric;
 v_nofee_cnt int; v_unlinked_cnt int;
 v_partial_cnt int; v_partial_amt numeric;
begin
 v_school := my_school_id();
 if v_school is null or my_role() not in ('owner','admin','accountant') then
   return jsonb_build_object('ok', false, 'reason', 'unauthorized');
 end if;
 select count(distinct sf.student_id), coalesce(sum(sf.total - sf.paid), 0)
   into v_overdue_cnt, v_overdue_amt
 from public.student_fees sf
 join public.students s on s.id = sf.student_id and s.deleted_at is null
 where sf.school_id = v_school and sf.due_date < current_date
   and (sf.total - sf.paid) > 0.005;
 if v_overdue_cnt > 0 then
   v_recs := v_recs || jsonb_build_object(
     'type','overdue_reminder','priority',1,
     'title','أرسل تذكير سداد لـ ' || v_overdue_cnt || ' ولي أمر متأخّر',
     'reason','لديهم فواتير تجاوزت موعد استحقاقها بمبلغ إجمالي ' || round(v_overdue_amt,3) || ' — التذكير المبكّر يرفع التحصيل.',
     'action_label','إرسال تذكير جماعي','action','send_overdue_reminders',
     'target_count',v_overdue_cnt,'expected_amount',round(v_overdue_amt,3));
 end if;
 select count(*), coalesce(sum(total - paid), 0) into v_partial_cnt, v_partial_amt
 from public.student_fees
 where school_id = v_school and paid > 0 and (total - paid) > 0.005
   and due_date >= current_date;
 if v_partial_cnt > 0 then
   v_recs := v_recs || jsonb_build_object(
     'type','partial_followup','priority',2,
     'title','تابع ' || v_partial_cnt || ' دفعة جزئية لم تكتمل',
     'reason','بدأ أولياء الأمور السداد ولم يكملوا — متبقٍّ ' || round(v_partial_amt,3) || '. متابعتهم أسهل من البدء من الصفر.',
     'action_label','عرض المدفوعات الجزئية','action','view_partial',
     'target_count',v_partial_cnt,'expected_amount',round(v_partial_amt,3));
 end if;
 select count(*) into v_nofee_cnt
 from public.students s
 where s.school_id = v_school and s.deleted_at is null
   and not exists (select 1 from public.student_fees f where f.student_id = s.id);
 if v_nofee_cnt > 0 then
   v_recs := v_recs || jsonb_build_object(
     'type','missing_fees','priority',3,
     'title',v_nofee_cnt || ' طالب بلا رسوم مسجّلة',
     'reason','هؤلاء الطلاب لا فواتير لهم — قد يكون دخلاً غير محصّل أو بيانات ناقصة.',
     'action_label','مراجعة الطلاب','action','view_nofee',
     'target_count',v_nofee_cnt,'expected_amount',null);
 end if;
 select count(distinct s.guardian_phone) into v_unlinked_cnt
 from public.students s
 where s.school_id = v_school and s.deleted_at is null
   and s.guardian_phone is not null
   and not exists (select 1 from public.parent_students ps where ps.student_id = s.id);
 if v_unlinked_cnt > 0 then
   v_recs := v_recs || jsonb_build_object(
     'type','unlinked_parents','priority',4,
     'title','ادعُ ' || v_unlinked_cnt || ' ولي أمر لتفعيل حسابهم',
     'reason','أولياء أمور لم يُفعّلوا حساباتهم بعد — تفعيلهم يقلّل المتابعة اليدوية ويسرّع السداد الذاتي.',
     'action_label','دعوة أولياء الأمور','action','invite_parents',
     'target_count',v_unlinked_cnt,'expected_amount',null);
 end if;
 return jsonb_build_object('ok',true,'generated_at',now(),
   'count',jsonb_array_length(v_recs),'recommendations',v_recs);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.soft_delete(p_table text, p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_school uuid;
begin
  if public.my_role() not in ('owner','admin') then
    raise exception 'غير مصرّح بالحذف';
  end if;
  if p_table not in ('students','student_fees','payments','employees','journal_entries','certificates') then
    raise exception 'جدول غير مدعوم للحذف الناعم';
  end if;
  -- تنفيذ ديناميكي آمن (القائمة البيضاء أعلاه تمنع الحقن)
  execute format(
    'update public.%I set deleted_at = now() where id = $1 and school_id = public.my_school_id()',
    p_table
  ) using p_id;

  insert into public.audit_log(school_id, actor_id, action, details)
  values (public.my_school_id(), auth.uid(), 'حذف ناعم: ' || p_table, p_id::text);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.start_impersonation(p_school_id uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_real_role user_role;
begin
  select role into v_real_role from public.profiles where id = auth.uid();
  if v_real_role <> 'platform_admin' then
    raise exception 'غير مصرّح: الدخول لمدير المنصة فقط';
  end if;
  if coalesce(trim(p_reason),'') = '' then
    raise exception 'يجب ذكر سبب الدخول (للتدقيق)';
  end if;
  if not exists (select 1 from public.schools where id = p_school_id) then
    raise exception 'المدرسة غير موجودة';
  end if;

  update public.profiles
  set impersonating_school_id = p_school_id, impersonation_reason = trim(p_reason)
  where id = auth.uid();

  insert into public.audit_log (school_id, actor_id, action, details)
  values (p_school_id, auth.uid(), '🔧 دخول دعم فني من المنصة', 'السبب: ' || p_reason);
end $function$
;

CREATE OR REPLACE FUNCTION public.stop_impersonation()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_school uuid;
begin
  select impersonating_school_id into v_school
  from public.profiles where id = auth.uid();

  update public.profiles
  set impersonating_school_id = null, impersonation_reason = null
  where id = auth.uid();

  if v_school is not null then
    insert into public.audit_log (school_id, actor_id, action, details)
    values (v_school, auth.uid(), '🔧 إنهاء دخول الدعم الفني', 'انتهت الجلسة');
  end if;
end $function$
;

CREATE OR REPLACE FUNCTION public.student_certificates(p_student_id uuid)
 RETURNS TABLE(id uuid, kind text, title text, serial text, body text, file_path text, file_name text, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select id, kind, title, serial, body, file_path, file_name, created_at
  from public.certificates
  where student_id = p_student_id and school_id = public.my_school_id()
  order by created_at desc;
$function$
;

CREATE OR REPLACE FUNCTION public.student_parents(p_student_id uuid)
 RETURNS TABLE(parent_id uuid, parent_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select ps.parent_id, p.full_name
  from public.parent_students ps
  join public.profiles p on p.id = ps.parent_id
  where ps.student_id = p_student_id and ps.school_id = public.my_school_id();
$function$
;

CREATE OR REPLACE FUNCTION public.students_without_meal()
 RETURNS TABLE(id uuid, full_name text, guardian_name text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح';
  end if;
  return query
  select s.id, s.full_name, s.guardian_name
  from public.students s
  where s.school_id = public.my_school_id()
    and not exists (
      select 1 from public.meal_subscriptions ms
      where ms.student_id = s.id and ms.school_id = s.school_id
    )
  order by s.full_name;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.submit_feedback(p_kind text, p_priority text, p_body text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_school uuid;
  v_name   text;
  v_id     uuid;
begin
  v_school := public.my_school_id();
  if v_school is null then
    raise exception 'لا توجد مدرسة مرتبطة بالحساب';
  end if;
  if public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح بإرسال الشكاوى';
  end if;
  if coalesce(trim(p_body),'') = '' then
    raise exception 'نص الشكوى مطلوب';
  end if;

  select full_name into v_name from public.profiles where id = auth.uid();

  insert into public.feedback(school_id, author_id, author_name, kind, priority, body)
  values (
    v_school, auth.uid(), v_name,
    coalesce(nullif(p_kind,''), 'complaint'),
    coalesce(nullif(p_priority,''), 'normal'),
    p_body
  )
  returning id into v_id;

  return v_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.submit_payment(p_fee_id uuid, p_amount numeric, p_method text, p_bank_ref text DEFAULT NULL::text, p_receipt_url text DEFAULT NULL::text)
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
  -- مصدر السياق الموحّد
  v_my_school := public.my_school_id();
  v_my_role   := public.my_role()::text;
  if v_my_school is null then
    raise exception 'لا مدرسة مرتبطة بحسابك';
  end if;

  select f.*, s.full_name as student_name, s.guardian_name
  into v_fee
  from public.student_fees f
  join public.students s on s.id = f.student_id
  where f.id = p_fee_id
    and f.school_id = v_my_school;

  if v_fee is null then
    raise exception 'الفاتورة غير موجودة في مدرستك';
  end if;

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
  if p_method = 'bank' and coalesce(trim(p_bank_ref),'') = '' and p_receipt_url is null then
    raise exception 'يلزم إرفاق إيصال التحويل';
  end if;

  insert into public.pending_payments(school_id, fee_id, guardian_id, amount, method, bank_ref, receipt_url)
  values (v_school, p_fee_id, auth.uid(), p_amount, p_method, p_bank_ref, p_receipt_url)
  returning id into v_id;

  return v_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.subscribe_bus(p_student uuid, p_bus uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_school uuid;
begin
  v_school := public.my_school_id();
  if v_school is null or public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح';
  end if;
  if not exists (select 1 from public.students where id = p_student and school_id = v_school) then
    raise exception 'الطالب غير موجود في مدرستك';
  end if;
  if not exists (select 1 from public.buses where id = p_bus and school_id = v_school) then
    raise exception 'الباص غير موجود في مدرستك';
  end if;
  insert into public.bus_subscriptions(school_id, student_id, bus_id)
  values (v_school, p_student, p_bus)
  on conflict (student_id) do update set bus_id = excluded.bus_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.subscribe_meal(p_student uuid, p_plan uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_school uuid;
  v_existing_annual boolean;
  v_new_type text;
  v_new_fee numeric;
  v_new_name text;
  v_month text := to_char(now(), 'YYYY-MM');
begin
  v_school := public.my_school_id();
  if v_school is null or public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح';
  end if;
  if not exists (select 1 from public.students where id = p_student and school_id = v_school) then
    raise exception 'الطالب غير موجود في مدرستك';
  end if;

  select plan_type, fee, name into v_new_type, v_new_fee, v_new_name
  from public.meal_plans where id = p_plan and school_id = v_school;
  if v_new_type is null then raise exception 'الباقة غير موجودة في مدرستك'; end if;

  -- هل عند الطالب أي اشتراك سنوي حالياً؟ (بغضّ النظر عن الخطة) — لا يجوز
  -- خلط سنوي مع شهري لنفس الطالب مهما تعدّدت الخطط
  select exists(
    select 1 from public.meal_subscriptions ms
    join public.meal_plans mp on mp.id = ms.plan_id
    where ms.student_id = p_student and ms.school_id = v_school and mp.plan_type = 'annual'
  ) into v_existing_annual;

  if v_existing_annual and v_new_type <> 'annual' then
    raise exception 'الطالب مقيد في باقة سنوية — لا يمكن دمجها مع باقة شهرية';
  end if;
  if (not v_existing_annual) and v_new_type = 'annual' and exists(
    select 1 from public.meal_subscriptions where student_id = p_student and school_id = v_school
  ) then
    raise exception 'الطالب مشترك بباقات شهرية حالياً — أزلها أولاً قبل إضافة باقة سنوية';
  end if;

  -- ⚠️ الإصلاح الجوهري: ON CONFLICT (student_id, plan_id) يطابق الفهرس
  -- الفريد uq_meal_subs_student_plan فعلياً، ويسمح بخطة ثانية مختلفة لنفس
  -- الطالب (فطور + غداء مثلاً) بدل استبدال الخطة الوحيدة المسموحة سابقاً
  insert into public.meal_subscriptions(school_id, student_id, plan_id, last_billed_month)
  values (v_school, p_student, p_plan, null)
  on conflict (student_id, plan_id) do update set last_billed_month = null;

  perform public.ensure_cafeteria_account();

  if v_new_type = 'annual' then
    insert into public.student_fees(school_id, student_id, description, total, paid, due_date)
    values (v_school, p_student, 'تغذية مدرسية سنوية — ' || v_new_name, v_new_fee, 0, current_date);
    update public.meal_subscriptions set last_billed_month = 'ANNUAL'
    where student_id = p_student and school_id = v_school and plan_id = p_plan;
  else
    insert into public.student_fees(school_id, student_id, description, total, paid, due_date)
    values (v_school, p_student, 'تغذية مدرسية شهرية — ' || v_new_name || ' (' || v_month || ')', v_new_fee, 0, (v_month || '-01')::date);
    update public.meal_subscriptions set last_billed_month = v_month
    where student_id = p_student and school_id = v_school and plan_id = p_plan;
  end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_pasi_flag()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if new.nationality = 'NON_OM' then
    new.subject_to_pasi := false;
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.system_health()
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select json_build_object(
    'queue_pending',  (select count(*) from public.notification_queue where status in ('queued','failed')),
    'queue_dead',     (select count(*) from public.notification_queue where status = 'dead'),
    'errors_24h',     (select count(*) from public.error_log where created_at > now() - interval '24 hours'),
    'critical_open',  (select count(*) from public.error_log where severity = 'critical' and resolved = false),
    'payments_stuck', (select count(*) from public.pending_payments where txn_state = 'processing' and state_updated_at < now() - interval '30 minutes')
  )
  where public.is_platform_admin();
$function$
;

CREATE OR REPLACE FUNCTION public.touch_assistant_conversation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  update public.assistant_conversations set updated_at = now() where id = new.conversation_id;
  return new;
end; $function$
;

CREATE OR REPLACE FUNCTION public.touch_help_articles()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  new.updated_at := now();
  return new;
end; $function$
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

  -- التحقق من التفويض: عضو فعلي بنفس مدرسة الدفعة، وبدور إداري/محاسبي
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and school_id = v_school
      and role in ('owner','admin','accountant')
  ) then
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

CREATE OR REPLACE FUNCTION public.transport_buses()
 RETURNS TABLE(id uuid, routes text[], routes_label text, driver text, supervisor text, capacity integer, fee numeric, pay_to text, subscribers bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح';
  end if;
  return query
  select b.id, b.routes, array_to_string(b.routes, '، '), b.driver, b.supervisor,
    b.capacity, b.fee, b.pay_to,
    (select count(*) from public.bus_subscriptions bs
       join public.students s on s.id = bs.student_id
       where bs.bus_id = b.id and s.status = 'active') as subscribers
  from public.buses b
  where b.school_id = public.my_school_id()
  order by b.created_at;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.transport_roster()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_school uuid;
  v_result jsonb;
begin
  v_school := my_school_id();
  if v_school is null or my_role() not in ('owner','admin','accountant') then
    return jsonb_build_object('ok', false, 'reason', 'unauthorized');
  end if;

  select jsonb_build_object(
    'ok', true,
    'generated_at', now(),
    'buses', coalesce(jsonb_agg(bus_data order by bus_data->>'routes_label'), '[]'::jsonb)
  ) into v_result
  from (
    select jsonb_build_object(
      'bus_id', b.id,
      'routes', to_jsonb(b.routes),
      'routes_label', array_to_string(b.routes, '، '),
      'driver', b.driver,
      'supervisor', b.supervisor,
      'capacity', b.capacity,
      'fee', b.fee,
      'students', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'student_id', s.id,
          'full_name', s.full_name,
          'grade', s.grade,
          'section', s.section,
          'guardian_name', s.guardian_name,
          'guardian_phone', s.guardian_phone
        ) order by s.grade, s.full_name), '[]'::jsonb)
        from public.bus_subscriptions bs
        join public.students s on s.id = bs.student_id and s.status = 'active'
        where bs.bus_id = b.id
      ),
      'student_count', (
        select count(*)
        from public.bus_subscriptions bs
        join public.students s on s.id = bs.student_id and s.status = 'active'
        where bs.bus_id = b.id
      )
    ) as bus_data
    from public.buses b
    where b.school_id = v_school
  ) sub;

  return v_result;
exception when others then
  return jsonb_build_object('ok', false, 'reason', 'error', 'detail', sqlerrm);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.transport_subscribers()
 RETURNS TABLE(id uuid, full_name text, guardian_name text, routes_label text, driver text, supervisor text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح';
  end if;
  return query
  select s.id, s.full_name, s.guardian_name, array_to_string(b.routes, '، '), b.driver, b.supervisor
  from public.bus_subscriptions bs
  join public.students s on s.id = bs.student_id
  join public.buses b on b.id = bs.bus_id
  where bs.school_id = public.my_school_id() and s.status = 'active'
  order by s.full_name;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.trial_balance_period(p_from date, p_to date)
 RETURNS TABLE(account_id uuid, code text, name text, type text, debit numeric, credit numeric, balance numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    a.id, a.code, a.name, a.type,
    coalesce(round(sum(l.debit), 3), 0)  as debit,
    coalesce(round(sum(l.credit), 3), 0) as credit,
    coalesce(round(sum(l.debit - l.credit), 3), 0) as balance
  from public.accounts a
  left join public.journal_lines l on l.account_id = a.id
  left join public.journal_entries e on e.id = l.entry_id
    and e.entry_date >= p_from and e.entry_date <= p_to
  where a.school_id = public.my_school_id()
  group by a.id, a.code, a.name, a.type
  order by a.code;
$function$
;

CREATE OR REPLACE FUNCTION public.unlinked_guardians()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_school uuid;
  v_rows   jsonb;
begin
  v_school := my_school_id();
  if v_school is null or my_role() not in ('owner','admin','accountant') then
    return jsonb_build_object('ok', false, 'reason', 'unauthorized');
  end if;

  select coalesce(jsonb_agg(t order by t->>'guardian_name'), '[]'::jsonb)
  into v_rows
  from (
    select jsonb_build_object(
      'phone',          s.guardian_phone,
      'guardian_name',  coalesce(max(s.guardian_name), 'ولي الأمر'),
      'children_count', count(*),
      'children',       string_agg(s.full_name, '، ' order by s.full_name),
      'invited_at',      max(gi.invited_at)
    ) as t
    from public.students s
    left join public.guardian_invites gi
      on gi.school_id = s.school_id and gi.phone = s.guardian_phone
    where s.school_id = v_school
      and s.deleted_at is null
      and s.status = 'active'
      and s.guardian_phone is not null
      and not exists (
        select 1 from public.profiles p
        where p.role = 'parent' and p.phone = s.guardian_phone
      )
    group by s.guardian_phone
  ) sub;

  return jsonb_build_object(
    'ok', true,
    'count', jsonb_array_length(v_rows),
    'guardians', v_rows
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.unrecord_meal_taken(p_student_id uuid, p_plan_id uuid, p_date date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_school uuid;
begin
  v_school := public.my_school_id();
  if v_school is null or public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح';
  end if;
  delete from public.meal_orders
  where school_id = v_school and student_id = p_student_id and plan_id = p_plan_id and meal_date = p_date;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.unsubscribe_bus(p_student uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح';
  end if;
  delete from public.bus_subscriptions
  where student_id = p_student and school_id = public.my_school_id();
end;
$function$
;

CREATE OR REPLACE FUNCTION public.unsubscribe_meal(p_student uuid, p_plan uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح';
  end if;

  delete from public.meal_subscriptions
  where student_id = p_student
    and school_id = public.my_school_id()
    and (p_plan is null or plan_id = p_plan);
end $function$
;

CREATE OR REPLACE FUNCTION public.update_bus(p_id uuid, p_routes text[], p_driver text, p_supervisor text, p_capacity integer, p_fee numeric, p_pay_to text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_school uuid; v_routes text[];
begin
  v_school := public.my_school_id();
  if v_school is null or public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح بإدارة الباصات';
  end if;

  select array_agg(nullif(trim(x),'')) filter (where nullif(trim(x),'') is not null)
    into v_routes from unnest(coalesce(p_routes, '{}')) x;

  if v_routes is null or array_length(v_routes,1) is null then
    raise exception 'مسار واحد على الأقل مطلوب';
  end if;
  if coalesce(trim(p_driver),'') = '' then
    raise exception 'اسم السائق مطلوب';
  end if;
  if coalesce(p_fee,0) <= 0 then raise exception 'الرسم الشهري يجب أن يكون أكبر من صفر'; end if;
  if coalesce(p_pay_to,'school') not in ('school','driver','private') then
    raise exception 'جهة الدفع غير صحيحة';
  end if;

  update public.buses set
    route = array_to_string(v_routes,' / '), routes = v_routes, driver = trim(p_driver),
    supervisor = nullif(trim(p_supervisor),''), capacity = coalesce(p_capacity,30),
    fee = p_fee, pay_to = coalesce(p_pay_to,'school')
  where id = p_id and school_id = v_school;

  if not found then raise exception 'الباص غير موجود في مدرستك'; end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.update_employee(p_id uuid, p_full_name text, p_job_title text DEFAULT NULL::text, p_nationality text DEFAULT NULL::text, p_basic numeric DEFAULT NULL::numeric, p_allowance numeric DEFAULT NULL::numeric, p_iban text DEFAULT NULL::text, p_id_type text DEFAULT NULL::text, p_id_number text DEFAULT NULL::text, p_bank_name text DEFAULT NULL::text, p_bank_account_no text DEFAULT NULL::text, p_subject_to_pasi boolean DEFAULT NULL::boolean, p_department text DEFAULT NULL::text, p_org_level integer DEFAULT NULL::integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_school_id uuid;
  v_role user_role;
  v_nat text;
begin
  -- مصدر السياق الموحّد (بدل القراءة المباشرة من profiles)
  v_school_id := public.my_school_id();
  v_role      := public.my_role();

  if v_role not in ('owner','admin') then
    raise exception 'غير مصرّح: تعديل الموظفين للمدير أو الإداري فقط';
  end if;

  if not exists (select 1 from public.employees
                 where id = p_id and school_id = v_school_id) then
    raise exception 'الموظف غير موجود';
  end if;

  v_nat := case
    when p_nationality is null then null
    when lower(trim(p_nationality)) in ('om','omani','عماني') then 'OM'
    else 'NON_OM' end;

  if p_org_level = 1 then
    update public.employees
      set org_level = 2
      where school_id = v_school_id and org_level = 1 and id <> p_id;
  end if;

  update public.employees set
    full_name       = coalesce(nullif(trim(p_full_name),''), full_name),
    job_title       = coalesce(p_job_title, job_title),
    nationality     = coalesce(v_nat, nationality),
    basic_salary    = coalesce(p_basic, basic_salary),
    other_allowance = coalesce(p_allowance, other_allowance),
    iban            = coalesce(p_iban, iban),
    id_type         = coalesce(p_id_type, id_type),
    id_number       = coalesce(p_id_number, id_number),
    bank_name       = coalesce(p_bank_name, bank_name),
    bank_account_no = coalesce(p_bank_account_no, bank_account_no),
    department      = coalesce(p_department, department),
    org_level       = coalesce(p_org_level, org_level),
    subject_to_pasi = case
      when v_nat = 'NON_OM' then false
      else coalesce(p_subject_to_pasi, subject_to_pasi) end
  where id = p_id and school_id = v_school_id;

  insert into public.audit_log(school_id, actor_id, action, details)
  values (v_school_id, auth.uid(), 'تعديل موظف', p_id::text);
end $function$
;

CREATE OR REPLACE FUNCTION public.update_insurance_rates(p_emp_rate numeric, p_er_rate numeric, p_cap numeric, p_expat_exempt boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_school uuid;
begin
  if public.my_role() <> 'owner' then
    raise exception 'غير مصرّح: ضبط نسب التأمينات لمدير المدرسة فقط';
  end if;
  -- تحقّق منطقي من النسب (بين 0 و 1)
  if p_emp_rate < 0 or p_emp_rate > 1 or p_er_rate < 0 or p_er_rate > 1 then
    raise exception 'النسب يجب أن تكون بين 0 و 100%%';
  end if;
  if p_cap is not null and p_cap < 0 then
    raise exception 'الحد الأقصى يجب أن يكون موجباً';
  end if;

  v_school := public.my_school_id();
  update public.schools set
    ins_emp_rate = p_emp_rate,
    ins_er_rate = p_er_rate,
    ins_cap = p_cap,
    ins_expat_exempt = coalesce(p_expat_exempt, true),
    ins_configured = true
  where id = v_school;

  insert into public.audit_log(school_id, actor_id, action, details)
  values(v_school, auth.uid(), 'تحديث نسب التأمينات',
         'موظف ' || round(p_emp_rate*100,2) || '% · صاحب عمل ' || round(p_er_rate*100,2) || '%');
end; $function$
;

CREATE OR REPLACE FUNCTION public.update_school_bank(p_bank_name text, p_bank_account text, p_bank_iban text, p_bank_holder text, p_enabled boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_school uuid;
begin
  -- التحقق من الدور: المدير فقط يدير الحساب البنكي
  if public.my_role() <> 'owner' then
    raise exception 'غير مصرّح: إدارة الحساب البنكي لمدير المدرسة فقط';
  end if;

  v_school := public.my_school_id();
  if v_school is null then
    raise exception 'لا توجد مدرسة مرتبطة بالحساب';
  end if;

  -- لا يمكن تفعيل الدفع بلا رقم حساب
  if p_enabled and (p_bank_account is null or length(trim(p_bank_account)) = 0) then
    raise exception 'لا يمكن تفعيل الدفع بلا رقم حساب بنكي';
  end if;

  update public.schools set
    bank_name    = nullif(trim(p_bank_name), ''),
    bank_account = nullif(trim(p_bank_account), ''),
    bank_iban    = nullif(trim(p_bank_iban), ''),
    bank_holder  = nullif(trim(p_bank_holder), ''),
    bank_enabled = coalesce(p_enabled, false)
  where id = v_school;

  insert into public.audit_log(school_id, actor_id, action, details)
  values(v_school, auth.uid(), 'تحديث الحساب البنكي للمدرسة',
         case when p_enabled then 'مُفعّل للدفع' else 'غير مُفعّل' end);
end; $function$
;

CREATE OR REPLACE FUNCTION public.update_school_branding(p_logo_url text, p_color text, p_accent_color text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_school uuid;
begin
  if public.my_role() <> 'owner' then
    raise exception 'غير مصرّح: تخصيص هوية المدرسة لمدير المدرسة فقط';
  end if;

  v_school := public.my_school_id();
  if v_school is null then
    raise exception 'لا توجد مدرسة مرتبطة بالحساب';
  end if;

  -- تحقّق بسيط: رابط الشعار يجب أن يكون https (أو فارغاً لإزالته)
  if p_logo_url is not null and length(trim(p_logo_url)) > 0
     and p_logo_url not like 'https://%' then
    raise exception 'رابط الشعار يجب أن يبدأ بـ https://';
  end if;

  -- تحقّق: اللون الأساسي صيغة hex صحيحة (أو فارغ)
  if p_color is not null and length(trim(p_color)) > 0
     and p_color !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'اللون يجب أن يكون بصيغة hex مثل ‎#0F9D74';
  end if;

  -- تحقّق: اللون الثانوي (accent) نفس الصيغة — يُتجاهل تحديثه لو NULL
  -- (يفرّق عن فارغ '' اللي معناه "امسح القيمة")
  if p_accent_color is not null and length(trim(p_accent_color)) > 0
     and p_accent_color !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'اللون الثانوي يجب أن يكون بصيغة hex مثل ‎#B08D2E';
  end if;

  update public.schools set
    logo_url = nullif(trim(p_logo_url), ''),
    color    = nullif(trim(p_color), ''),
    card_accent_color = case
      when p_accent_color is null then card_accent_color   -- لم يُرسَل: أبقِ القيمة الحالية
      else nullif(trim(p_accent_color), '')
    end
  where id = v_school;

  insert into public.audit_log(school_id, actor_id, action, details)
  values (v_school, auth.uid(), 'update_branding', 'تحديث شعار/ألوان المدرسة');
end;
$function$
;

CREATE OR REPLACE FUNCTION public.update_student(p_student_id uuid, p_full_name text, p_grade text, p_section text DEFAULT NULL::text, p_guardian_name text DEFAULT NULL::text, p_guardian_phone text DEFAULT NULL::text, p_guardian_email text DEFAULT NULL::text, p_birth_date date DEFAULT NULL::date, p_gender text DEFAULT NULL::text, p_code text DEFAULT NULL::text, p_annual_fee numeric DEFAULT NULL::numeric, p_discount_pct numeric DEFAULT NULL::numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_school_id uuid;
  v_role      user_role;
  v_old_name  text;
  v_phone     text;
  v_code      text;
begin
  -- مصدر السياق الموحّد (بدل القراءة المباشرة من profiles)
  v_school_id := public.my_school_id();
  v_role      := public.my_role();

  if v_school_id is null then
    raise exception 'لا مدرسة مرتبطة بحسابك';
  end if;

  if v_role not in ('owner', 'admin') then
    raise exception 'غير مصرّح: تعديل الطلاب للمدير أو الإداري فقط';
  end if;

  -- عزل: الطالب يجب أن يكون في مدرسة المستخدم
  select full_name into v_old_name from public.students
  where id = p_student_id and school_id = v_school_id;

  if v_old_name is null then
    raise exception 'الطالب غير موجود في مدرستك';
  end if;

  if coalesce(trim(p_full_name), '') = '' then
    raise exception 'اسم الطالب مطلوب';
  end if;
  if coalesce(trim(p_grade), '') = '' then
    raise exception 'الصف/المرحلة مطلوب';
  end if;
  if coalesce(trim(p_section), '') = '' then
    raise exception 'الشعبة مطلوبة';
  end if;
  if p_annual_fee is null or p_annual_fee <= 0 then
    raise exception 'الرسوم السنوية مطلوبة ويجب أن تكون أكبر من صفر';
  end if;
  if p_discount_pct is not null and (p_discount_pct < 0 or p_discount_pct > 100) then
    raise exception 'نسبة التخفيض يجب أن تكون بين 0 و 100';
  end if;

  v_phone := public.normalize_phone(p_guardian_phone, '968');
  if v_phone is null then
    raise exception 'رقم ولي الأمر مطلوب لتمكينه من متابعة أبنائه';
  end if;
  if not public.is_valid_gulf_phone(v_phone) then
    raise exception 'رقم ولي الأمر غير صالح: يجب أن يكون رقماً عُمانياً صحيحاً (8 خانات تبدأ بـ 7 أو 9)';
  end if;

  if coalesce(trim(p_code), '') <> '' then
    v_code := trim(p_code);
    if exists (
      select 1 from public.students
      where school_id = v_school_id and code = v_code and id <> p_student_id
    ) then
      raise exception 'الرقم المدرسي % مستخدم بالفعل', v_code;
    end if;
  end if;

  update public.students set
    full_name      = trim(p_full_name),
    grade          = trim(p_grade),
    section        = nullif(trim(p_section), ''),
    guardian_name  = nullif(trim(p_guardian_name), ''),
    guardian_phone = v_phone,
    guardian_email = nullif(trim(p_guardian_email), ''),
    birth_date     = p_birth_date,
    gender         = nullif(trim(p_gender), ''),
    code           = coalesce(v_code, code),
    annual_fee     = p_annual_fee,
    discount_pct   = coalesce(p_discount_pct, discount_pct)
  where id = p_student_id and school_id = v_school_id;

  insert into public.audit_log (school_id, actor_id, action, details)
  values (v_school_id, auth.uid(), 'تعديل بيانات طالب', v_old_name || ' ← ' || trim(p_full_name));
end;
$function$
;

CREATE OR REPLACE FUNCTION public.update_student_family_info(p_student_id uuid, p_father_phone text, p_mother_phone text, p_address text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح بتعديل بيانات الطالب';
  end if;

  update public.students
  set father_phone = nullif(trim(p_father_phone), ''),
      mother_phone = nullif(trim(p_mother_phone), ''),
      address      = nullif(trim(p_address), '')
  where id = p_student_id
    and school_id = public.my_school_id();

  if not found then
    raise exception 'الطالب غير موجود أو لا يخص مدرستك';
  end if;
end $function$
;

CREATE OR REPLACE FUNCTION public.validate_wps_run(p_run_id uuid)
 RETURNS TABLE(employee_name text, issue text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select i.employee_name, x.issue
  from public.payroll_items i
  cross join lateral (
    values
      (case when coalesce(i.id_number,'') = '' then 'رقم الهوية مفقود' end),
      (case when coalesce(i.bank_account_no,'') = '' then 'رقم الحساب مفقود' end),
      (case when i.bank_account_no is not null
             and i.bank_account_no !~ '^OM[0-9]{21}$'
            then 'صيغة الآيبان غير صحيحة' end),
      (case when i.net_salary <= 0 then 'الصافي صفر أو سالب' end)
  ) as x(issue)
  where x.issue is not null
    and i.run_id = p_run_id;
$function$
;

CREATE OR REPLACE FUNCTION public.vat_report_period(p_from date, p_to date)
 RETURNS TABLE(applies boolean, vat_rate numeric, revenue_total numeric, vat_amount numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with setting as (select * from public.my_vat_setting()),
  rev as (
    select coalesce(round(sum(l.credit - l.debit), 3), 0) as total
    from public.accounts a
    join public.journal_lines l on l.account_id = a.id
    join public.journal_entries e on e.id = l.entry_id
    where a.school_id = public.my_school_id()
      and a.type = 'revenue'
      and e.entry_date >= p_from and e.entry_date <= p_to
  )
  select
    s.applies, s.vat_rate,
    rev.total,
    case when s.applies then round(rev.total * s.vat_rate / 100, 3) else 0 end
  from setting s, rev;
$function$
;
