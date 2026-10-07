
CREATE OR REPLACE FUNCTION public.add_student(
  p_full_name text, p_grade text, p_section text DEFAULT NULL::text,
  p_guardian_name text DEFAULT NULL::text, p_guardian_phone text DEFAULT NULL::text,
  p_guardian_email text DEFAULT NULL::text, p_birth_date date DEFAULT NULL::date,
  p_gender text DEFAULT NULL::text, p_code text DEFAULT NULL::text,
  p_annual_fee numeric DEFAULT 0, p_country_code text DEFAULT '968'::text,
  p_transport_type text DEFAULT 'none'::text, p_discount_pct numeric DEFAULT 0
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_school_id uuid; v_role user_role; v_code text;
  v_student_id uuid; v_seq int; v_phone text;
begin
  select school_id, role into v_school_id, v_role
  from public.profiles where id = auth.uid();

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
end $function$;
