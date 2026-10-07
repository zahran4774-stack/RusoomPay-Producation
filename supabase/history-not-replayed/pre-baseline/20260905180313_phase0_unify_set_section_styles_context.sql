
-- Phase 0 — دفعة 4
CREATE OR REPLACE FUNCTION public.set_section_styles(p_styles text[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_school uuid := public.my_school_id();
  v_role   text := public.my_role()::text;
  v_allowed text[] := array['ar_letters','numbers','en_letters','en_numbers'];
begin
  if v_school is null then
    raise exception 'لا توجد مدرسة مرتبطة بالحساب';
  end if;
  if v_role <> 'owner' then
    raise exception 'غير مصرّح — المدير فقط يمكنه تغيير ترميز الشُّعب';
  end if;
  if p_styles is null or array_length(p_styles, 1) is null then
    raise exception 'اختر نمطاً واحداً على الأقل';
  end if;
  -- رفض أي قيمة خارج القائمة المسموحة
  if exists (select 1 from unnest(p_styles) s where s <> all(v_allowed)) then
    raise exception 'نمط ترميز غير معروف';
  end if;

  update public.schools
    set section_styles = p_styles
    where id = v_school;
end;
$function$;
