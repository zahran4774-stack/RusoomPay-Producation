-- link_parent_by_student كانت تقارن الأرقام حرفياً (phone = v_phone) بدل استخدام
-- دالة normalize_phone() الجاهزة أصلاً — فيفشل الربط لو الرقمين نفس الشخص لكن
-- بصيغة مختلفة (وجود/غياب رمز الدولة 968).
create or replace function public.link_parent_by_student(p_student_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
 v_school uuid;
 v_phone  text;
 v_parent uuid;
begin
 v_school := public.my_school_id();
 if public.my_role() not in ('owner','admin','accountant') then
   raise exception 'غير مصرّح بربط أولياء الأمور';
 end if;
 select guardian_phone into v_phone
 from public.students
 where id = p_student_id and school_id = v_school and deleted_at is null;
 if v_phone is null then
   return jsonb_build_object('ok', false, 'reason', 'student_not_found_or_no_phone');
 end if;
 -- 🔧 المقارنة الآن عبر normalize_phone() بدل التطابق الحرفي
 select id into v_parent
 from public.profiles
 where role = 'parent' and public.normalize_phone(phone) = public.normalize_phone(v_phone)
 limit 1;
 if v_parent is null then
   return jsonb_build_object('ok', false, 'reason', 'no_parent_account',
     'phone', v_phone);
 end if;
 insert into public.parent_students(school_id, parent_id, student_id)
 values (v_school, v_parent, p_student_id)
 on conflict do nothing;
 return jsonb_build_object('ok', true);
end;
$function$
