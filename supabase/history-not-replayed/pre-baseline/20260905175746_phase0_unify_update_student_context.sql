
-- Phase 0 — توحيد مصدر السياق (2/7)
CREATE OR REPLACE FUNCTION public.update_student(
  p_student_id uuid, p_full_name text, p_grade text, p_section text DEFAULT NULL::text,
  p_guardian_name text DEFAULT NULL::text, p_guardian_phone text DEFAULT NULL::text,
  p_guardian_email text DEFAULT NULL::text, p_birth_date date DEFAULT NULL::date,
  p_gender text DEFAULT NULL::text, p_code text DEFAULT NULL::text,
  p_annual_fee numeric DEFAULT NULL::numeric, p_discount_pct numeric DEFAULT NULL::numeric
)
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
$function$;
