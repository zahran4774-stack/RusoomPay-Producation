-- Phase 5A Fix H: دالة ذرّية لتحديد المعدّل — تحل مشكلتين معاً:
-- 1) صلاحيات authenticated المفقودة على rate_limits (السبب الجذري لتعطّل الفحص بالكامل)
-- 2) فجوة السباق التزامني (SELECT ثم UPDATE منفصلين في الكود الحالي)
-- الذرّية مضمونة عبر INSERT...ON CONFLICT DO UPDATE مع شرط داخل نفس العبارة (لا SELECT منفصل قبلها).
CREATE OR REPLACE FUNCTION public.check_and_increment_rate_limit(
  p_key text, p_limit int, p_window_minutes int
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_new_count int;
begin
  insert into public.rate_limits (key, count, window_start)
  values (p_key, 1, now())
  on conflict (key) do update
    set count = case
          -- نافذة منتهية: نبدأ من جديد
          when public.rate_limits.window_start < now() - (p_window_minutes || ' minutes')::interval
            then 1
          -- لسه ضمن النافذة: زيادة تصاعدية
          else public.rate_limits.count + 1
        end,
        window_start = case
          when public.rate_limits.window_start < now() - (p_window_minutes || ' minutes')::interval
            then now()
          else public.rate_limits.window_start
        end
  returning count into v_new_count;

  return v_new_count <= p_limit;
end;
$function$;

REVOKE ALL ON FUNCTION public.check_and_increment_rate_limit(text, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_and_increment_rate_limit(text, int, int) TO authenticated;