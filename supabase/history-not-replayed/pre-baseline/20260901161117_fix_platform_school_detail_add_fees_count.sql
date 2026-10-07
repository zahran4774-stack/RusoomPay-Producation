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
end $function$;