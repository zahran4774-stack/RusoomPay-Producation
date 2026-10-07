-- ============================================================================
-- Close the PUBLIC / anon EXECUTE exposure on public-schema functions.
--
-- In production 65 functions were executable by PUBLIC (hence by the anonymous
-- API key), including money-moving SECURITY DEFINER RPCs (record_payment,
-- approve_payment, reject_payment, food_purchase, ...). Most check my_role()
-- internally, but a few take a school id and do NOT check the caller
-- (next_invoice_number, next_expense_code), and trigger/test functions never
-- need to be callable through the API at all.
--
-- Rule after this migration:
--   * anon keeps EXECUTE only on the pre-login / helper functions in KEEP_ANON.
--   * Everything else: authenticated + service_role only.
--   * Trigger functions and test_dummy_function: no API role at all.
-- Overloads are handled by looping over pg_proc.
--
-- NOT applied to production. Review, then apply deliberately.
-- ============================================================================
DO $$
DECLARE
  r record;
  keep_anon text[] := ARRAY[
    'enabled_countries','public_schools','available_plans','register_school',
    'parent_signup_by_phone','log_error','is_valid_gulf_phone','normalize_phone','next_grade',
    -- called inside RLS policies / by the client; return NULL/false for anon
    'my_role','my_school_id','has_permission','my_permissions','my_subscription_status'
  ];
  no_api text[] := ARRAY[
    'block_approved_payroll_items','block_journal_mutation','check_financial_year_open',
    'check_journal_balanced','sync_pasi_flag','test_dummy_function'
  ];
BEGIN
  FOR r IN
    SELECT p.oid, p.proname, p.oid::regprocedure AS sig
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace AND p.prokind = 'f'
      AND (has_function_privilege('anon', p.oid, 'EXECUTE')
           OR p.proname = ANY (no_api))
  LOOP
    IF r.proname = ANY (keep_anon) THEN
      CONTINUE;
    ELSIF r.proname = ANY (no_api) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    ELSE
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', r.sig);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.sig);
    END IF;
  END LOOP;
END $$;
