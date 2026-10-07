-- ============================================================================
-- Staff-only guards for report / data RPCs + service-only grants.
--
-- Found by supabase/tests/parent_rpc_probe.sql (a parent account with a school_id
-- running every SECURITY DEFINER RPC): these functions only scoped by
-- my_school_id() and never checked the caller's role, so ANY signed-in user of a
-- school (e.g. a parent) could read its trial balance, journal, P&L, VAT,
-- cash-flow, dashboard, risk list with guardian phones, overdue guardian phones,
-- payroll summary, inventory, suppliers, feedback, and the parent list of any
-- student. validate_wps_run took a payroll run id without checking the school.
--
-- 1) Guard: owner / admin / accountant (platform_admin kept: it is school-scoped
--    through impersonation, and my_role() maps impersonation to 'owner').
--    plpgsql bodies get the guard right after the first BEGIN; LANGUAGE sql bodies
--    are converted to plpgsql with the same query wrapped in RETURN QUERY.
--    (#variable_conflict use_column avoids OUT-column / column-name ambiguity.)
-- 2) validate_wps_run additionally requires the run to belong to the caller's school.
-- 3) claim_queue_batch, mark_queue_result, cleanup_rate_limits, next_invoice_number,
--    next_expense_code: service_role only (the queue worker uses the service client;
--    the invoice/expense counters are reached only through SECURITY DEFINER callers).
--
-- NOT applied to production. Review, then apply deliberately.
-- ============================================================================
DO $mig$
DECLARE
  r      record;
  def    text;
  body   text;
  guard  constant text :=
    $g$ if coalesce(public.my_role()::text, '') not in ('owner','admin','accountant','platform_admin') then raise exception 'غير مصرّح' using errcode = '42501'; end if; $g$;
  names  constant text[] := ARRAY[
    'account_balances','balance_sheet_asof','journal_period','trial_balance_period','financial_summary',
    'income_statement_period','vat_report_period','cashflow_forecast','collection_analytics','dashboard_summary',
    'risk_scores','copilot_gated','org_overview','overdue_reminders','payroll_yearly_summary','meal_cost_report',
    'meal_purchases_list','meal_suppliers','inventory_category_report','inventory_dispenses_list','inventory_list',
    'inventory_purchases_summary','food_inventory_list','my_school_feedback','student_parents','student_certificates',
    'ensure_cafeteria_account','ensure_inventory_accounts','ensure_meal_cost_accounts','ensure_transport_account'
  ];
  n int := 0;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname, l.lanname, p.proretset
    FROM pg_proc p JOIN pg_language l ON l.oid = p.prolang
    WHERE p.pronamespace = 'public'::regnamespace AND p.prokind = 'f' AND p.proname = ANY (names)
  LOOP
    def := pg_get_functiondef(r.oid);
    IF def ~ 'my_role\(\)::text, ''''\) not in \(''owner'',''admin'',''accountant'',''platform_admin''\)' THEN
      CONTINUE;  -- already guarded (idempotent)
    END IF;

    IF r.lanname = 'plpgsql' THEN
      def := regexp_replace(def, '\$function\$([\s\S]*?\mbegin\M)',
                            E'$function$\n#variable_conflict use_column\n\\1 ' || guard, 'i');
    ELSIF r.lanname = 'sql' THEN
      IF NOT r.proretset THEN
        RAISE EXCEPTION 'sql function % is not set-returning; handle manually', r.proname;
      END IF;
      body := substring(def FROM '\$function\$([\s\S]*)\$function\$');
      IF r.proname = 'inventory_category_report' THEN
        -- plpgsql RETURN QUERY is strict about types: sum(integer) is bigint, the column is numeric
        body := replace(body, 'coalesce(sum(qty),0) as total_qty', 'coalesce(sum(qty),0)::numeric as total_qty');
      END IF;
      def  := substring(def FROM '^([\s\S]*?)\$function\$') || E'$function$\n#variable_conflict use_column\nbegin\n' || guard || E'\nreturn query\n' || body || E'\nend;\n$function$\n';
      def  := regexp_replace(def, 'LANGUAGE sql', 'LANGUAGE plpgsql');
    ELSE
      RAISE EXCEPTION 'unexpected language % for %', r.lanname, r.proname;
    END IF;

    EXECUTE def;
    n := n + 1;
  END LOOP;
  IF n = 0 AND NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'account_balances') THEN
    RAISE EXCEPTION 'no target functions found';
  END IF;
END
$mig$;

-- validate_wps_run: also require that the payroll run belongs to the caller's school.
DROP FUNCTION IF EXISTS public.validate_wps_run(uuid);
CREATE FUNCTION public.validate_wps_run(p_run_id uuid)
 RETURNS TABLE(employee_name text, issue text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
begin
  if coalesce(public.my_role()::text, '') not in ('owner','admin','accountant','platform_admin') then
    raise exception 'غير مصرّح' using errcode = '42501';
  end if;
  return query
  select i.employee_name, x.issue
  from public.payroll_items i
  join public.payroll_runs pr on pr.id = i.run_id and pr.school_id = public.my_school_id()
  cross join lateral (
    values
      (case when coalesce(i.id_number,'') = '' then 'رقم الهوية مفقود' end),
      (case when coalesce(i.bank_account_no,'') = '' then 'رقم الحساب مفقود' end),
      (case when i.bank_account_no is not null
             and i.bank_account_no !~ '^OM[0-9]{21}$'
            then 'صيغة الآيبان غير صحيحة' end),
      (case when i.net_salary <= 0 then 'الصافي صفر أو سالب' end)
  ) as x(issue)
  where x.issue is not null
    and i.run_id = p_run_id;
end;
$function$;
REVOKE ALL ON FUNCTION public.validate_wps_run(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_wps_run(uuid) TO authenticated, service_role;

-- service-role only
REVOKE ALL ON FUNCTION public.claim_queue_batch(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_queue_result(uuid, boolean, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_rate_limits() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.next_invoice_number(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.next_expense_code(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_queue_batch(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_queue_result(uuid, boolean, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_rate_limits() TO service_role;
GRANT EXECUTE ON FUNCTION public.next_invoice_number(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.next_expense_code(uuid) TO service_role;
