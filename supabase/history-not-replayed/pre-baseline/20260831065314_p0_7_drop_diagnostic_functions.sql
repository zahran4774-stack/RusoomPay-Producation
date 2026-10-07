
-- P0-7: exec_sql_diagnostic / exec_sql_diagnostic_v2 have no application
-- callers (verified via full repo search), are granted to PUBLIC + anon
-- (callable by anyone, unauthenticated), leak internal session/role info
-- (current_user, JWT role claim, RLS-bypass status), and exec_sql_diagnostic
-- is SECURITY DEFINER with NO search_path set at all (the one function in the
-- whole schema missing this hardening). Pure debug leftovers — dropping.
drop function if exists public.exec_sql_diagnostic();
drop function if exists public.exec_sql_diagnostic_v2();
