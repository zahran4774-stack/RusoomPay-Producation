-- تقرير المخزون مجمَّعاً حسب الفئة — لعرض ملخّص سريع (عدد الأصناف، إجمالي الكمية، قيمة المخزون لكل فئة)
CREATE OR REPLACE FUNCTION public.inventory_category_report()
RETURNS TABLE(category text, items_count bigint, total_qty numeric, total_value numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  select category, count(*) as items_count, coalesce(sum(qty),0) as total_qty, coalesce(sum(qty*cost),0) as total_value
  from public.inventory_items
  where school_id = public.my_school_id()
  group by category
  order by total_value desc;
$function$;

REVOKE ALL ON FUNCTION public.inventory_category_report() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.inventory_category_report() TO authenticated;