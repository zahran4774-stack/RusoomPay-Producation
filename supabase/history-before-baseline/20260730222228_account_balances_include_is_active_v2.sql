DROP FUNCTION IF EXISTS public.account_balances();

CREATE FUNCTION public.account_balances()
RETURNS TABLE(account_id uuid, code text, name text, type text, balance numeric, is_active boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  select
    a.id,
    a.code,
    a.name,
    a.type,
    coalesce(round(sum(l.debit - l.credit), 3), 0) as balance,
    a.is_active
  from public.accounts a
  left join public.journal_lines l
    on l.account_id = a.id and l.school_id = a.school_id
  where a.school_id = public.my_school_id()
  group by a.id, a.code, a.name, a.type, a.is_active
  order by a.code;
$function$;

REVOKE ALL ON FUNCTION public.account_balances() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.account_balances() TO authenticated;