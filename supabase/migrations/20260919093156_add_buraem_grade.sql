-- إضافة مرحلة «براعم» كأول مرحلة (قبل الروضة)
alter table public.students drop constraint if exists students_grade_valid;
alter table public.students add constraint students_grade_valid check (
  grade = any (array[
    'براعم','روضة','تمهيدي','تجهيزي','الأول','الثاني','الثالث','الرابع','الخامس',
    'السادس','السابع','الثامن','التاسع','العاشر','الحادي عشر','الثاني عشر'
  ]::text[])
);

create or replace function public.next_grade(p_grade text)
returns text
language plpgsql
immutable
set search_path to 'public'
as $function$
declare
  grades text[] := array[
    'براعم','روضة','تمهيدي','تجهيزي','الأول','الثاني','الثالث','الرابع','الخامس',
    'السادس','السابع','الثامن','التاسع','العاشر','الحادي عشر','الثاني عشر'
  ];
  i int;
begin
  i := array_position(grades, trim(p_grade));
  if i is null then return null; end if;              -- صف غير معروف
  if i >= array_length(grades, 1) then return null; end if;  -- الصف الأخير → تخرّج
  return grades[i + 1];
end;
$function$;