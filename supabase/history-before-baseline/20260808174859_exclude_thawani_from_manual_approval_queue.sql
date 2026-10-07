-- دفعات ثواني تتأكد تلقائياً (عبر confirm_gateway_payment) ولا تحتاج اعتماد يدوي من المحاسب.
-- نستثنيها من قائمة "بانتظار الاعتماد" إلا لو فشل التحقق التلقائي (txn_state = 'failed')
-- عندها تحتاج فعلاً مراجعة يدوية.
create or replace function public.pending_payments_list(p_page integer DEFAULT 1, p_page_size integer DEFAULT 20)
 RETURNS TABLE(id uuid, guardian text, student text, amount numeric, method text, bank_ref text, created_at timestamp with time zone, guardian_phone text, school_name text, total_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select pp.id,
    coalesce(g.full_name,'ولي أمر'), s.full_name,
    pp.amount, pp.method, pp.bank_ref, pp.created_at,
    coalesce(g.phone, s.guardian_phone),
    sch.name,
    count(*) over() as total_count
  from public.pending_payments pp
  join public.student_fees f on f.id = pp.fee_id
  join public.students s on s.id = f.student_id
  left join public.profiles g on g.id = pp.guardian_id
  left join public.schools sch on sch.id = pp.school_id
  where pp.school_id = public.my_school_id() and pp.status = 'pending'
    and (pp.method <> 'thawani' or pp.txn_state = 'failed')
  order by pp.created_at
  limit greatest(1, least(coalesce(p_page_size, 20), 100))
  offset greatest(0, (coalesce(p_page, 1) - 1) * greatest(1, least(coalesce(p_page_size, 20), 100)));
$function$
