DROP FUNCTION IF EXISTS public.inventory_list();

-- إضافة الفئة والنوع الفرعي للمخرجات + معامل فلترة اختياري بالفئة (NULL = عرض الكل)
CREATE FUNCTION public.inventory_list(p_category text DEFAULT NULL)
RETURNS TABLE(
  id uuid, name text, qty integer, cost numeric, price numeric, vat_rate numeric,
  stock_value numeric, category text, subtype text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  select id, name, qty, cost, price, vat_rate, round(qty * cost, 3) as stock_value, category, subtype
  from public.inventory_items
  where school_id = public.my_school_id()
    and (p_category is null or category = p_category)
  order by category, created_at;
$function$;

REVOKE ALL ON FUNCTION public.inventory_list(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.inventory_list(text) TO authenticated;