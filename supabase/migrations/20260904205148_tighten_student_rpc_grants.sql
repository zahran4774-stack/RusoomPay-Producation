
REVOKE ALL ON FUNCTION public.add_student(text, text, text, text, text, text, date, text, text, numeric, text, text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_student(text, text, text, text, text, text, date, text, text, numeric, text, text, numeric) TO authenticated;

REVOKE ALL ON FUNCTION public.update_student(uuid, text, text, text, text, text, text, date, text, text, numeric, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_student(uuid, text, text, text, text, text, text, date, text, text, numeric, numeric) TO authenticated;
