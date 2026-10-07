
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
$function$;

REVOKE ALL ON FUNCTION public.grade_fees_list() FROM public;
GRANT EXECUTE ON FUNCTION public.grade_fees_list() TO authenticated;

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
$function$;

REVOKE ALL ON FUNCTION public.save_grade_fee(text, numeric) FROM public;
GRANT EXECUTE ON FUNCTION public.save_grade_fee(text, numeric) TO authenticated;
