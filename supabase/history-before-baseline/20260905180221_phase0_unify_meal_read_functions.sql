
-- Phase 0 — دفعة 4: دوال قراءة التغذية
CREATE OR REPLACE FUNCTION public.meal_suppliers()
 RETURNS SETOF suppliers
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select * from public.suppliers
  where school_id = public.my_school_id()
  order by active desc, name;
$function$;

CREATE OR REPLACE FUNCTION public.meal_purchases_list(p_period text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, supplier_id uuid, supplier_name text, purchase_date date, purchase_type text, meals_count integer, unit_cost numeric, total_cost numeric, period text, paid boolean, notes text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select mp.id, mp.supplier_id, s.name, mp.purchase_date, mp.purchase_type,
         mp.meals_count, mp.unit_cost, mp.total_cost, mp.period, mp.paid, mp.notes
  from public.meal_purchases mp
  left join public.suppliers s on s.id = mp.supplier_id
  where mp.school_id = public.my_school_id()
    and (p_period is null or mp.period = p_period)
  order by mp.purchase_date desc, mp.created_at desc;
$function$;
