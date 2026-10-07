
-- Phase 0 — دفعة 4: باقي الدوال غير المحاسبية التي تقرأ السياق من profiles
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
$function$;

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
$function$;

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
$function$;

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
$function$;
