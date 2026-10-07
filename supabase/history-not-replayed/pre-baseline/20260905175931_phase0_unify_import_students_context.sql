
-- Phase 0 — توحيد مصدر السياق (7/7)
-- نطاق هذا التعديل: مصدر السياق فقط. لم تُضَف أي تحققات جديدة عمداً —
-- فجوة التحقق في مسار الاستيراد (لا شعبة، لا رسوم، لا تحقق من رقم ولي الأمر)
-- قرار منفصل يُتخذ صراحةً، لا يُدَس داخل مرحلة التوحيد.
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
$function$;
