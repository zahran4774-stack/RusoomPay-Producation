DROP FUNCTION IF EXISTS public.parent_children();

CREATE FUNCTION public.parent_children()
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
$function$;

GRANT EXECUTE ON FUNCTION public.parent_children() TO authenticated;