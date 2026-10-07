-- التخفيض بمبلغ معين بدلاً من نسبة — add_student و update_student
-- discount_pct يُحسب تلقائياً (discount_amount ÷ annual_fee × 100) ويُخزَّن للعرض فقط
-- net_fee = annual_fee - discount_amount (في سجل الرسوم)

-- ═══ add_student ═══
drop function if exists public.add_student(text, text, text, text, text, text, date, text, text, numeric, text, text, numeric, boolean, text, uuid, uuid, numeric, text);

create function public.add_student(
  p_full_name text, p_grade text, p_section text default null,
  p_guardian_name text default null, p_guardian_phone text default null,
  p_guardian_email text default null, p_birth_date date default null,
  p_gender text default null, p_code text default null,
  p_annual_fee numeric default 0, p_country_code text default '968',
  p_transport_type text default 'none',
  p_discount_amount numeric default 0,
  p_is_exempt boolean default false, p_special_case_reason text default null,
  p_bundle_meal_plan_id uuid default null, p_bundle_bus_id uuid default null,
  p_registration_fee numeric default 0, p_registration_recurrence text default null
) returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_sch uuid; v_role user_role; v_code text;
  v_student_id uuid; v_seq int; v_phone text; v_net_fee numeric;
  v_bundle_enabled boolean;
  v_meal_fee numeric := 0;
  v_bus_fee  numeric := 0;
  v_gross_fee numeric;
  v_discount_pct numeric;
begin
  v_sch  := public.my_school_id();
  v_role := public.my_role();

  if v_sch is null then raise exception 'لا مدرسة مرتبطة بحسابك'; end if;
  if v_role not in ('owner','admin') then
    raise exception 'غير مصرّح: إضافة الطلاب للمدير أو الإداري فقط'; end if;

  if not public.school_pricing_complete() then
    raise exception 'أكمل تسعير كل المراحل الدراسية من الإعدادات أولاً قبل إضافة الطلاب';
  end if;

  if coalesce(trim(p_full_name),'') = '' then raise exception 'اسم الطالب مطلوب'; end if;
  if coalesce(trim(p_grade),'')     = '' then raise exception 'الصف/المرحلة مطلوب'; end if;
  if coalesce(trim(p_section),'')   = '' then raise exception 'الشعبة مطلوبة'; end if;

  if p_registration_fee is not null and p_registration_fee > 0
     and p_registration_recurrence not in ('once','yearly') then
    raise exception 'حدد نوع تكرار رسوم التسجيل (لمرة واحدة أو سنوياً)';
  end if;

  if coalesce(p_discount_amount, 0) < 0 then
    raise exception 'مبلغ التخفيض لا يمكن أن يكون سالباً';
  end if;

  select bundle_transport_meals into v_bundle_enabled from public.schools where id = v_sch;
  v_bundle_enabled := coalesce(v_bundle_enabled, false);

  if v_bundle_enabled and p_bundle_meal_plan_id is not null then
    select fee into v_meal_fee from public.meal_plans
    where id = p_bundle_meal_plan_id and school_id = v_sch;
    if v_meal_fee is null then raise exception 'باقة التغذية غير موجودة في مدرستك'; end if;
  end if;

  if v_bundle_enabled and p_bundle_bus_id is not null then
    select fee into v_bus_fee from public.buses
    where id = p_bundle_bus_id and school_id = v_sch;
    if v_bus_fee is null then raise exception 'مسار الباص غير موجود في مدرستك'; end if;
  end if;

  if not coalesce(p_is_exempt, false) then
    if coalesce(p_annual_fee,0) <= 0 and coalesce(v_meal_fee,0) <= 0 and coalesce(v_bus_fee,0) <= 0 then
      raise exception 'الرسوم السنوية مطلوبة ويجب أن تكون أكبر من صفر';
    end if;
  end if;

  if coalesce(p_discount_amount, 0) > coalesce(p_annual_fee, 0) + coalesce(v_meal_fee, 0) + coalesce(v_bus_fee, 0) then
    raise exception 'مبلغ التخفيض لا يمكن أن يتجاوز إجمالي الرسوم';
  end if;

  if coalesce(trim(p_special_case_reason), '') <> '' and coalesce(p_discount_amount, 0) <= 0 then
    raise exception 'حدد مبلغ التخفيض المرتبط بالحالة الخاصة';
  end if;

  v_phone := public.normalize_phone(p_guardian_phone, coalesce(p_country_code,'968'));
  if v_phone is null then
    raise exception 'رقم ولي الأمر مطلوب لتمكينه من متابعة أبنائه'; end if;
  if not public.is_valid_gulf_phone(v_phone) then
    raise exception 'رقم ولي الأمر غير صالح: يجب أن يكون رقماً عُمانياً صحيحاً (8 خانات تبدأ بـ 7 أو 9)'; end if;

  if coalesce(trim(p_code),'') = '' then
    select count(*) + 1 into v_seq from public.students where school_id = v_sch;
    v_code := 'STU-' || lpad(v_seq::text, 3, '0');
    while exists (select 1 from public.students where school_id = v_sch and code = v_code) loop
      v_seq := v_seq + 1;
      v_code := 'STU-' || lpad(v_seq::text, 3, '0');
    end loop;
  else
    v_code := trim(p_code);
    if exists (select 1 from public.students where school_id = v_sch and code = v_code) then
      raise exception 'الرقم المدرسي % مستخدم بالفعل', v_code; end if;
  end if;

  -- نسبة التخفيض للعرض = المبلغ ÷ الرسوم الأساسية × 100
  v_discount_pct := case
    when coalesce(p_annual_fee, 0) > 0 and coalesce(p_discount_amount, 0) > 0
    then least(round(p_discount_amount / p_annual_fee * 100, 3), 100)
    else 0 end;

  insert into public.students (
    school_id, code, full_name, grade, section,
    guardian_name, guardian_phone, guardian_email,
    birth_date, gender, annual_fee, transport_type,
    discount_pct, discount_amount,
    is_exempt, special_case_reason, registration_fee_recurrence
  ) values (
    v_sch, v_code, trim(p_full_name), trim(p_grade), nullif(trim(p_section),''),
    nullif(trim(p_guardian_name),''), v_phone, nullif(trim(p_guardian_email),''),
    p_birth_date, nullif(trim(p_gender),''), coalesce(p_annual_fee, 0),
    coalesce(nullif(trim(p_transport_type),''), 'none'),
    v_discount_pct, coalesce(p_discount_amount, 0),
    coalesce(p_is_exempt, false), nullif(trim(p_special_case_reason), ''),
    case when coalesce(p_registration_fee,0) > 0 then p_registration_recurrence else null end
  ) returning id into v_student_id;

  if not coalesce(p_is_exempt, false) then
    v_gross_fee := coalesce(p_annual_fee,0) + coalesce(v_meal_fee,0) + coalesce(v_bus_fee,0);
    if v_gross_fee > 0 then
      v_net_fee := round(v_gross_fee - coalesce(p_discount_amount, 0), 3);
      insert into public.student_fees (school_id, student_id, description, total, paid, due_date)
      values (v_sch, v_student_id,
              'الرسوم الدراسية السنوية' ||
                case when coalesce(p_transport_type,'none') = 'school' and not v_bundle_enabled
                     then ' (شاملة النقل)' else '' end ||
                case when coalesce(p_discount_amount,0) > 0
                     then ' (بعد تخفيض ' || p_discount_amount::text || ' ر.ع)' else '' end,
              v_net_fee, 0, current_date + interval '30 days');
    end if;

    if coalesce(p_registration_fee,0) > 0 then
      insert into public.student_fees (school_id, student_id, description, total, paid, due_date)
      values (v_sch, v_student_id,
              'رسوم التسجيل' || case when p_registration_recurrence = 'yearly' then ' (سنوية)' else ' (لمرة واحدة)' end,
              p_registration_fee, 0, current_date + interval '30 days');
    end if;
  end if;

  if v_bundle_enabled and p_bundle_meal_plan_id is not null and not coalesce(p_is_exempt,false) then
    insert into public.meal_subscriptions(school_id, student_id, plan_id, billing)
    values (v_sch, v_student_id, p_bundle_meal_plan_id, 'annual')
    on conflict do nothing;
  end if;

  if v_bundle_enabled and p_bundle_bus_id is not null and not coalesce(p_is_exempt,false) then
    insert into public.bus_subscriptions(school_id, student_id, bus_id)
    values (v_sch, v_student_id, p_bundle_bus_id)
    on conflict (student_id) do update set bus_id = excluded.bus_id;
  end if;

  insert into public.audit_log (school_id, actor_id, action, details)
  values (v_sch, auth.uid(), 'إضافة طالب', trim(p_full_name) || ' (' || v_code || ')' ||
          case when coalesce(p_is_exempt,false) then ' — معفى بالكامل' else '' end);

  return v_student_id;
end;
$function$;

revoke all on function public.add_student(text, text, text, text, text, text, date, text, text, numeric, text, text, numeric, boolean, text, uuid, uuid, numeric, text) from public, anon;
grant execute on function public.add_student(text, text, text, text, text, text, date, text, text, numeric, text, text, numeric, boolean, text, uuid, uuid, numeric, text) to authenticated;

-- ═══ update_student ═══
drop function if exists public.update_student(uuid, text, text, text, text, text, text, date, text, text, numeric, numeric, boolean, text, text);

create function public.update_student(
  p_student_id uuid, p_full_name text, p_grade text, p_section text default null,
  p_guardian_name text default null, p_guardian_phone text default null,
  p_guardian_email text default null, p_birth_date date default null,
  p_gender text default null, p_code text default null,
  p_annual_fee numeric default null, p_discount_amount numeric default null,
  p_is_exempt boolean default false, p_special_case_reason text default null,
  p_status text default null
) returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_sch uuid; v_rl  user_role; v_prevname text; v_ph text; v_cd text;
  v_discount_pct numeric;
begin
  v_sch := public.my_school_id();
  v_rl  := public.my_role();

  if v_sch is null then raise exception 'لا مدرسة مرتبطة بحسابك'; end if;
  if v_rl not in ('owner', 'admin') then raise exception 'غير مصرّح: تعديل الطلاب للمدير أو الإداري فقط'; end if;

  select full_name into v_prevname from public.students
  where id = p_student_id and school_id = v_sch;
  if v_prevname is null then raise exception 'الطالب غير موجود في مدرستك'; end if;

  if coalesce(trim(p_full_name), '') = '' then raise exception 'اسم الطالب مطلوب'; end if;
  if coalesce(trim(p_grade), '')     = '' then raise exception 'الصف/المرحلة مطلوب'; end if;
  if coalesce(trim(p_section), '')   = '' then raise exception 'الشعبة مطلوبة'; end if;

  if not coalesce(p_is_exempt, false) then
    if p_annual_fee is null or p_annual_fee <= 0 then
      raise exception 'الرسوم السنوية مطلوبة ويجب أن تكون أكبر من صفر';
    end if;
  end if;

  if coalesce(p_discount_amount, 0) < 0 then
    raise exception 'مبلغ التخفيض لا يمكن أن يكون سالباً';
  end if;
  if coalesce(p_discount_amount, 0) > coalesce(p_annual_fee, 0) then
    raise exception 'مبلغ التخفيض لا يمكن أن يتجاوز الرسوم السنوية';
  end if;

  if coalesce(trim(p_special_case_reason), '') <> '' and coalesce(p_discount_amount, 0) <= 0 then
    raise exception 'حدد مبلغ التخفيض المرتبط بالحالة الخاصة';
  end if;

  if p_status is not null and p_status not in ('active','transferred','graduated','withdrawn') then
    raise exception 'حالة غير معروفة';
  end if;

  v_ph := public.normalize_phone(p_guardian_phone, '968');
  if v_ph is null then raise exception 'رقم ولي الأمر مطلوب لتمكينه من متابعة أبنائه'; end if;
  if not public.is_valid_gulf_phone(v_ph) then
    raise exception 'رقم ولي الأمر غير صالح: يجب أن يكون رقماً عُمانياً صحيحاً (8 خانات تبدأ بـ 7 أو 9)';
  end if;

  if coalesce(trim(p_code), '') <> '' then
    v_cd := trim(p_code);
    if exists (select 1 from public.students where school_id = v_sch and code = v_cd and id <> p_student_id) then
      raise exception 'الرقم المدرسي % مستخدم بالفعل', v_cd;
    end if;
  end if;

  -- نسبة التخفيض للعرض = المبلغ ÷ الرسوم الأساسية × 100
  v_discount_pct := case
    when coalesce(p_annual_fee, 0) > 0 and coalesce(p_discount_amount, 0) > 0
    then least(round(p_discount_amount / p_annual_fee * 100, 3), 100)
    else 0 end;

  update public.students set
    full_name           = trim(p_full_name),
    grade               = trim(p_grade),
    section             = nullif(trim(p_section), ''),
    guardian_name       = nullif(trim(p_guardian_name), ''),
    guardian_phone      = v_ph,
    guardian_email      = nullif(trim(p_guardian_email), ''),
    birth_date          = p_birth_date,
    gender              = nullif(trim(p_gender), ''),
    code                = coalesce(v_cd, code),
    annual_fee          = coalesce(p_annual_fee, annual_fee),
    discount_pct        = v_discount_pct,
    discount_amount     = coalesce(p_discount_amount, discount_amount, 0),
    is_exempt           = coalesce(p_is_exempt, false),
    special_case_reason = nullif(trim(p_special_case_reason), ''),
    status              = coalesce(p_status::student_status, status)
  where id = p_student_id and school_id = v_sch;

  insert into public.audit_log (school_id, actor_id, action, details)
  values (v_sch, auth.uid(), 'تعديل بيانات طالب', v_prevname || ' ← ' || trim(p_full_name));
end;
$function$;

revoke all on function public.update_student(uuid, text, text, text, text, text, text, date, text, text, numeric, numeric, boolean, text, text) from public, anon;
grant execute on function public.update_student(uuid, text, text, text, text, text, text, date, text, text, numeric, numeric, boolean, text, text) to authenticated;