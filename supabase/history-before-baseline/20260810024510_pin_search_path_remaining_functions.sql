-- search_path غير مثبّت = ثغرة انتحال دوال (Search Path Hijacking) —
-- نثبّته لكل الدوال المتبقية اللي كانت بدونه
alter function public.next_grade(text) set search_path = public;
alter function public.sync_pasi_flag() set search_path = public;
alter function public.block_approved_payroll_items() set search_path = public;
