-- سجل عمليات الصرف الداخلي — لعرضها كتقرير للمتابعة (اسم الصنف، الكمية، التكلفة، السبب، من قام بها)
CREATE OR REPLACE FUNCTION public.inventory_dispenses_list(p_limit int DEFAULT 50)
RETURNS TABLE(
  id uuid, item_name text, qty integer, cost numeric, reason text,
  dispensed_by_name text, dispensed_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  select d.id, i.name, d.qty, d.cost, d.reason,
    coalesce(pr.full_name, 'موظف'), d.dispensed_at
  from public.inventory_dispenses d
  join public.inventory_items i on i.id = d.item_id
  left join public.profiles pr on pr.id = d.dispensed_by
  where d.school_id = public.my_school_id()
  order by d.dispensed_at desc
  limit greatest(1, least(p_limit, 500));
$function$;

REVOKE ALL ON FUNCTION public.inventory_dispenses_list(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.inventory_dispenses_list(int) TO authenticated;