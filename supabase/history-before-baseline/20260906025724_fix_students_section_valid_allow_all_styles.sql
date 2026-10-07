
-- القيد كان يسمح بالحروف العربية فقط، بينما ميزة "أنماط ترميز الشُّعب"
-- (schools.section_styles) تولّد أيضاً أرقاماً عربية وحروفاً وأرقاماً لاتينية.
-- توسيع القيد ليطابق ما تولّده buildSectionOptions فعلياً في lib/academic.ts.
alter table public.students drop constraint students_section_valid;

alter table public.students add constraint students_section_valid check (
  section is null or section = any (array[
    -- حروف عربية
    'أ','ب','ج','د','هـ','و','ز','ح','ط','ي',
    -- أرقام عربية
    '١','٢','٣','٤','٥','٦','٧','٨','٩','١٠',
    -- حروف لاتينية
    'A','B','C','D','E','F','G','H','I','J',
    -- أرقام لاتينية
    '1','2','3','4','5','6','7','8','9','10'
  ])
);
