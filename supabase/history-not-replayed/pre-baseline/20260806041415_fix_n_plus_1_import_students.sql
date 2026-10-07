-- إصلاح N+1: كانت الدالة تفحص تصادم رقم الطالب (STU-XXX) بـ SELECT منفصل داخل حلقة while
-- لكل طالب مستورَد. الحل: جلب كل الأرقام الحالية دفعة واحدة في مصفوفة أول الدالة،
-- والتحقق من التصادم بالذاكرة (عبر عضوية المصفوفة) بدل استعلام قاعدة بيانات في كل مرة.
-- لا تغيير في المنطق أو النتيجة النهائية.
CREATE OR REPLACE FUNCTION public.import_students(p_rows jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  v_school_id uuid;
  v_role      user_role;
  r           jsonb;
  v_code      text;
  v_seq       int;
  v_sid       uuid;
  v_fee       numeric;
  v_ok        int := 0;
  v_fail      int := 0;
  v_errors    jsonb := '[]'::jsonb;
  v_rownum    int := 0;
  v_existing_codes text[];
begin
  select school_id, role into v_school_id, v_role
  from public.profiles where id = auth.uid();

  if v_school_id is null then
    raise exception 'لا مدرسة مرتبطة بحسابك';
  end if;
  if v_role not in ('owner', 'admin') then
    raise exception 'غير مصرّح: الاستيراد للمدير أو الإداري فقط';
  end if;

  select count(*) into v_seq from public.students where school_id = v_school_id;

  -- جلب كل الأرقام الحالية دفعة واحدة (بدل فحص كل رقم مرشَّح بـ SELECT منفصل)
  select coalesce(array_agg(code), array[]::text[]) into v_existing_codes
  from public.students where school_id = v_school_id;

  for r in select * from jsonb_array_elements(p_rows) loop
    v_rownum := v_rownum + 1;
    begin
      if coalesce(trim(r->>'full_name'), '') = '' then
        raise exception 'اسم الطالب فارغ';
      end if;
      if coalesce(trim(r->>'grade'), '') = '' then
        raise exception 'الصف فارغ';
      end if;

      -- رقم مدرسي تلقائي — التحقق من التصادم بالذاكرة عبر المصفوفة، بدون استعلام
      v_seq := v_seq + 1;
      v_code := 'STU-' || lpad(v_seq::text, 3, '0');
      while v_code = any(v_existing_codes) loop
        v_seq := v_seq + 1;
        v_code := 'STU-' || lpad(v_seq::text, 3, '0');
      end loop;
      -- أضف الرقم الجديد للمصفوفة فوراً كي لا يتكرر لطالب لاحق بنفس الدفعة
      v_existing_codes := v_existing_codes || v_code;

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
$function$;