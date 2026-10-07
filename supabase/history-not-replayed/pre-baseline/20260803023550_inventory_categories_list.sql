-- قائمة الفئات المتاحة للمدرسة — الأساسية دائماً + أي فئة مخصَّصة أضافها المستخدم فعلياً
CREATE OR REPLACE FUNCTION public.inventory_categories()
RETURNS TABLE(category text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  select unnest(array['كتب','زي مدرسي','قرطاسية','أخرى']) as category
  union
  select distinct category from public.inventory_items where school_id = public.my_school_id()
  order by category;
$function$;

REVOKE ALL ON FUNCTION public.inventory_categories() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.inventory_categories() TO authenticated;