-- التخفيض بمبلغ (ر.ع) بدل النسبة المئوية
-- 1) عمود جديد + ترحيل القيم القديمة بمقدار ما خُصم فعلياً من الرسوم السنوية
alter table public.students add column if not exists discount_amount numeric not null default 0;
alter table public.students drop constraint if exists students_discount_amount_nonneg;
alter table public.students add constraint students_discount_amount_nonneg check (discount_amount >= 0);
update public.students
   set discount_amount = round(annual_fee * discount_pct / 100.0, 3)
 where discount_pct > 0 and discount_amount = 0;
comment on column public.students.discount_pct is 'مهجور — استُبدل بـ discount_amount (مبلغ بالريال). يُحذف لاحقاً.';

-- 2) حذف النسخ القديمة (بالنسبة) من الدوال
drop function if exists public.add_student(text,text,text,text,text,text,date,text,text,numeric,text,text,numeric);
drop function if exists public.add_student(text,text,text,text,text,text,date,text,text,numeric,text,text,numeric,boolean,text);
drop function if exists public.add_student(text,text,text,text,text,text,date,text,text,numeric,text,text,numeric,boolean,text,uuid,uuid);
drop function if exists public.add_student(text,text,text,text,text,text,date,text,text,numeric,text,text,numeric,boolean,text,uuid,uuid,numeric,text);
drop function if exists public.update_student(uuid,text,text,text,text,text,text,date,text,text,numeric,numeric);
drop function if exists public.update_student(uuid,text,text,text,text,text,text,date,text,text,numeric,numeric,boolean,text);
drop function if exists public.update_student(uuid,text,text,text,text,text,text,date,text,text,numeric,numeric,boolean,text,text);

-- 3) add_student — التخفيض مبلغ يُخصم من إجمالي (رسوم + نقل + تغذية)
create function public.add_student(
  p_full_name text, p_grade text, p_section text default null, p_guardian_name text default null,
  p_guardian_phone text default null, p_guardian_email text default null, p_birth_date date default null,
  p_gender text default null, p_code text default null, p_annual_fee numeric default 0,
  p_country_code text default '968', p_transport_type text default 'none',
  p_discount_amount numeric default 0, p_is_exempt boolean default false,
  p_special_case_reason text default null, p_bundle_meal_plan_id uuid default null,
  p_bundle_bus_id uuid default null, p_registration_fee numeric default 0,
  p_registration_recurrence text default null)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_sch uuid; v_role user_role; v_code text;
  v_student_id uuid; v_seq int; v_phone text; v_net_fee numeric;
  v_bundle_enabled boolean;
  v_meal_fee numeric := 0;
  v_bus_fee numeric := 0;
  v_gross_fee numeric;
  v_discount numeric;
begin
  v_sch := public.my_school_id();
  v_role      := public.my_role();

  if v_sch is null then raise exception 'لا مدرسة مرتبطة بحسابك'; end if;
  if v_role not in ('owner','admin') then
    raise exception 'غير مصرّح: إضافة الطلاب للمدير أو الإداري فقط'; end if;
  if coalesce(trim(p_full_name),'') = '' then raise exception 'اسم الطالب مطلوب'; end if;
  if coalesce(trim(p_grade),'') = '' then raise exception 'الصف/المرحلة مطلوب'; end if;
  if coalesce(trim(p_section),'') = '' then raise exception 'الشعبة مطلوبة'; end if;

  if p_registration_fee is not null and p_registration_fee > 0
     and p_registration_recurrence not in ('once','yearly') then
    raise exception 'حدد نوع تكرار رسوم التسجيل (لمرة واحدة أو سنوياً)';
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

  v_discount := case when coalesce(p_is_exempt,false) then 0 else coalesce(p_discount_amount,0) end;
  v_gross_fee := coalesce(p_annual_fee,0) + coalesce(v_meal_fee,0) + coalesce(v_bus_fee,0);

  if v_discount < 0 then raise exception 'مبلغ التخفيض لا يمكن أن يكون سالباً'; end if;
  if v_discount > v_gross_fee then
    raise exception 'مبلغ التخفيض (%) أكبر من إجمالي الرسوم (%)', v_discount, v_gross_fee;
  end if;

  if coalesce(trim(p_special_case_reason), '') <> '' and v_discount <= 0 then
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

  insert into public.students (
    school_id, code, full_name, grade, section,
    guardian_name, guardian_phone, guardian_email,
    birth_date, gender, annual_fee, transport_type, discount_amount,
    is_exempt, special_case_reason, registration_fee_recurrence
  ) values (
    v_sch, v_code, trim(p_full_name), trim(p_grade), nullif(trim(p_section),''),
    nullif(trim(p_guardian_name),''), v_phone, nullif(trim(p_guardian_email),''),
    p_birth_date, nullif(trim(p_gender),''), coalesce(p_annual_fee,0),
    coalesce(nullif(trim(p_transport_type),''), 'none'), v_discount,
    coalesce(p_is_exempt, false), nullif(trim(p_special_case_reason), ''),
    case when coalesce(p_registration_fee,0) > 0 then p_registration_recurrence else null end
  ) returning id into v_student_id;

  if not coalesce(p_is_exempt, false) then
    if v_gross_fee > 0 then
      v_net_fee := round(greatest(v_gross_fee - v_discount, 0), 3);
      insert into public.student_fees (school_id, student_id, description, total, paid, due_date)
      values (v_sch, v_student_id,
              'الرسوم الدراسية السنوية' ||
                case when coalesce(p_transport_type,'none') = 'school' and not v_bundle_enabled
                     then ' (شاملة النقل)' else '' end ||
                case when v_discount > 0
                     then ' (بعد تخفيض ' || v_discount::text || ' ر.ع)' else '' end,
              v_net_fee, 0, current_date + interval '30 days');
    end if;

    -- رسوم التسجيل — مبلغ ثابت، بلا أي تخفيض
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
end $function$;

-- 4) update_student — نفس التوقيع مع p_discount_amount
create function public.update_student(
  p_student_id uuid, p_full_name text, p_grade text, p_section text default null,
  p_guardian_name text default null, p_guardian_phone text default null,
  p_guardian_email text default null, p_birth_date date default null, p_gender text default null,
  p_code text default null, p_annual_fee numeric default null, p_discount_amount numeric default null,
  p_is_exempt boolean default false, p_special_case_reason text default null, p_status text default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_sch uuid;
  v_rl  user_role;
  v_prevname text;
  v_ph  text;
  v_cd  text;
begin
  v_sch := public.my_school_id();
  v_rl  := public.my_role();

  if v_sch is null then raise exception 'لا مدرسة مرتبطة بحسابك'; end if;
  if v_rl not in ('owner', 'admin') then raise exception 'غير مصرّح: تعديل الطلاب للمدير أو الإداري فقط'; end if;

  select full_name into v_prevname from public.students
  where id = p_student_id and school_id = v_sch;
  if v_prevname is null then raise exception 'الطالب غير موجود في مدرستك'; end if;

  if coalesce(trim(p_full_name), '') = '' then raise exception 'اسم الطالب مطلوب'; end if;
  if coalesce(trim(p_grade), '') = '' then raise exception 'الصف/المرحلة مطلوب'; end if;
  if coalesce(trim(p_section), '') = '' then raise exception 'الشعبة مطلوبة'; end if;

  if not coalesce(p_is_exempt, false) then
    if p_annual_fee is null or p_annual_fee <= 0 then
      raise exception 'الرسوم السنوية مطلوبة ويجب أن تكون أكبر من صفر';
    end if;
  end if;

  if p_discount_amount is not null and p_discount_amount < 0 then
    raise exception 'مبلغ التخفيض لا يمكن أن يكون سالباً';
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

  update public.students set
    full_name            = trim(p_full_name),
    grade                = trim(p_grade),
    section              = nullif(trim(p_section), ''),
    guardian_name        = nullif(trim(p_guardian_name), ''),
    guardian_phone       = v_ph,
    guardian_email       = nullif(trim(p_guardian_email), ''),
    birth_date           = p_birth_date,
    gender               = nullif(trim(p_gender), ''),
    code                 = coalesce(v_cd, code),
    annual_fee           = coalesce(p_annual_fee, annual_fee),
    discount_amount      = coalesce(p_discount_amount, discount_amount),
    is_exempt            = coalesce(p_is_exempt, false),
    special_case_reason  = nullif(trim(p_special_case_reason), ''),
    status               = coalesce(p_status::student_status, status)
  where id = p_student_id and school_id = v_sch;

  insert into public.audit_log (school_id, actor_id, action, details)
  values (v_sch, auth.uid(), 'تعديل بيانات طالب', v_prevname || ' ← ' || trim(p_full_name));
end;
$function$;

-- 5) import_students — عمود discount_amount بالريال
create or replace function public.import_students(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_school_id uuid;
  v_role      user_role;
  v_row       jsonb;
  v_code      text;
  v_counter   int;
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
  if v_school_id is null then raise exception 'لا مدرسة مرتبطة بحسابك'; end if;
  if v_role not in ('owner', 'admin') then raise exception 'غير مصرّح'; end if;
  select count(*) into v_counter from public.students where school_id = v_school_id;
  for v_row in select * from jsonb_array_elements(p_rows) loop
    v_rownum := v_rownum + 1;
    begin
      if coalesce(trim(v_row->>'full_name'), '') = '' then raise exception 'اسم الطالب فارغ'; end if;
      if coalesce(trim(v_row->>'grade'), '') = '' then raise exception 'الصف فارغ'; end if;
      v_counter := v_counter + 1;
      v_code := 'STU-' || lpad(v_counter::text, 3, '0');
      while exists (select 1 from public.students where school_id = v_school_id and code = v_code) loop
        v_counter := v_counter + 1;
        v_code := 'STU-' || lpad(v_counter::text, 3, '0');
      end loop;
      v_is_exempt := lower(trim(coalesce(v_row->>'is_exempt', ''))) in ('نعم', 'yes', 'true', '1');
      v_special_reason := nullif(trim(v_row->>'special_case_reason'), '');
      -- قالب قديم بعمود النسبة: نرفضه بدل أن نفسّره خطأً كمبلغ
      if not (v_row ? 'discount_amount') and coalesce(nullif(trim(v_row->>'discount_pct'), '')::numeric, 0) > 0 then
        raise exception 'التخفيض صار بمبلغ (ر.ع) لا نسبة — استخدم القالب الجديد';
      end if;
      v_discount := coalesce(nullif(trim(v_row->>'discount_amount'), '')::numeric, 0);
      v_fee := coalesce(nullif(trim(v_row->>'annual_fee'), '')::numeric, 0);
      if v_is_exempt then v_discount := 0; end if;
      if not v_is_exempt and v_fee <= 0 then raise exception 'الرسوم السنوية مطلوبة'; end if;
      if v_discount < 0 then raise exception 'مبلغ التخفيض لا يمكن أن يكون سالباً'; end if;
      if v_discount > v_fee and not v_is_exempt then raise exception 'مبلغ التخفيض أكبر من الرسوم السنوية'; end if;
      insert into public.students (school_id, code, full_name, grade, section, guardian_name, guardian_phone, guardian_email, birth_date, gender, annual_fee, discount_amount, is_exempt, special_case_reason)
      values (v_school_id, v_code, trim(v_row->>'full_name'), trim(v_row->>'grade'), nullif(trim(v_row->>'section'), ''), nullif(trim(v_row->>'guardian_name'), ''), nullif(trim(v_row->>'guardian_phone'), ''), nullif(trim(v_row->>'guardian_email'), ''), nullif(trim(v_row->>'birth_date'), '')::date, nullif(trim(v_row->>'gender'), ''), v_fee, v_discount, v_is_exempt, v_special_reason)
      returning id into v_sid;
      if not v_is_exempt and v_fee > 0 then
        insert into public.student_fees (school_id, student_id, description, total, paid, due_date)
        values (v_school_id, v_sid,
                'الرسوم الدراسية السنوية' || case when v_discount > 0 then ' (بعد تخفيض ' || v_discount::text || ' ر.ع)' else '' end,
                round(v_fee - v_discount, 3), 0, current_date + interval '30 days');
      end if;
      v_ok := v_ok + 1;
    exception when others then
      v_fail := v_fail + 1;
      v_errors := v_errors || jsonb_build_object('row', v_rownum, 'name', coalesce(v_row->>'full_name', '—'), 'error', SQLERRM);
    end;
  end loop;
  insert into public.audit_log (school_id, actor_id, action, details)
  values (v_school_id, auth.uid(), 'استيراد طلاب', 'نجح: ' || v_ok || ' · فشل: ' || v_fail);
  return jsonb_build_object('ok', v_ok, 'failed', v_fail, 'errors', v_errors);
end;
$function$;

-- 6) الصلاحيات: للمستخدمين المسجّلين فقط
revoke all on function public.add_student(text,text,text,text,text,text,date,text,text,numeric,text,text,numeric,boolean,text,uuid,uuid,numeric,text) from public, anon;
grant execute on function public.add_student(text,text,text,text,text,text,date,text,text,numeric,text,text,numeric,boolean,text,uuid,uuid,numeric,text) to authenticated;
revoke all on function public.update_student(uuid,text,text,text,text,text,text,date,text,text,numeric,numeric,boolean,text,text) from public, anon;
grant execute on function public.update_student(uuid,text,text,text,text,text,text,date,text,text,numeric,numeric,boolean,text,text) to authenticated;