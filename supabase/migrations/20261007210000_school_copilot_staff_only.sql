-- school_copilot() كان بلا فحص دور: أي ولي أمر مسجّل يقرأ أرقام المدرسة كلها (التحصيل، المستحقات،
-- الإيرادات، المصروفات، أعداد الطلاب/الموظفين) مباشرة أو عبر المساعد الذكي (assistant_context).
-- الإصلاح: غلاف بفحص دور (طاقم فقط) حول الدالة الأصلية المُعاد تسميتها، وassistant_context لا يستدعيها لغير الطاقم.

DO $mig$
BEGIN
  IF to_regprocedure('public._school_copilot_core()') IS NULL THEN
    ALTER FUNCTION public.school_copilot() RENAME TO _school_copilot_core;
  END IF;
END
$mig$;

REVOKE ALL ON FUNCTION public._school_copilot_core() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._school_copilot_core() TO service_role;

CREATE OR REPLACE FUNCTION public.school_copilot()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $fn$
begin
  if coalesce(public.my_role()::text, '') not in ('owner', 'admin', 'accountant', 'platform_admin') then
    raise exception 'غير مصرّح' using errcode = '42501';
  end if;
  return public._school_copilot_core();
end;
$fn$;

REVOKE ALL ON FUNCTION public.school_copilot() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_copilot() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.assistant_context()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $fn$
declare
  v_school uuid; v_role text; v_copilot jsonb := null; v_school_name text;
begin
  v_school := public.my_school_id();
  v_role := public.my_role()::text;
  if v_school is null then
    return jsonb_build_object('ok', false, 'error', 'no_school');
  end if;
  select name into v_school_name from public.schools where id = v_school;
  if coalesce(v_role, '') in ('owner', 'admin', 'accountant', 'platform_admin') then
    v_copilot := public.school_copilot();
  end if;
  return jsonb_build_object('ok', true, 'role', v_role, 'school_name', v_school_name, 'data', v_copilot);
end;
$fn$;

REVOKE ALL ON FUNCTION public.assistant_context() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assistant_context() TO authenticated, service_role;
