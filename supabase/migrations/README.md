# Migrations

This folder rebuilds the production database (project `hmskpglpltaeiznvxvcb`)
from scratch. It is checked by CI on every push (`.github/workflows/db-rebuild.yml`):
`supabase start` applies every file here, in version order, to a throwaway
Postgres, and the resulting schema is fingerprinted and compared with the recorded
production snapshot (`supabase/tests/expected_fingerprint.txt`).

## What is in here

| Files | What they are |
|---|---|
| `00000000000001..06_baseline_*.sql` | A snapshot of the production catalog taken between `20260906062736` and `20260914151906` (types/tables, constraints, indexes, functions, RLS + policies, triggers). Production's history table also lists these six first. |
| `20260914151906_*` … `20261004160210_*` (15 files) | Production's recorded incremental history **after** the snapshot, byte-for-byte from `supabase_migrations.schema_migrations`. |
| `20261004160211_catchup_prod_schema_drift.sql` | **Not in production's history.** Idempotent catch-up generated from the production catalog (see below). |

Everything recorded **before** the snapshot is already contained in the baseline,
so replaying it fails ("already exists"). Those files are kept, byte-exact, in
`supabase/history-not-replayed/pre-baseline/` (132 files) so history is not lost.
One recorded migration (`20261003191034_attach_accrual_trigger_and_backfill_accruals_baraem_nazwa`)
backfills accounting rows for one specific production school id and cannot run on a
clean database; it is in `supabase/history-not-replayed/prod-data-only/`.
132 + 1 + 15 = 148 recorded entries, all accounted for.

## Why the catch-up migration exists (drift finding)

Production contains schema that was never recorded as a migration (changed
directly, e.g. in the dashboard). A rebuild from the recorded history alone was
missing, compared with production:

- 5 tables: `financial_years`, `organizations`, `school_invoice_counters`,
  `school_memberships`, `user_permissions` (+ their RLS, policies, indexes, constraints)
- 10 columns on existing tables, a `student_status` enum value (`withdrawn`)
- 55 function definitions that differ or are missing, and the `EXECUTE` grants of the functions
- 57 RLS / storage policies, 2 triggers, 5 storage buckets
- objects present in the recorded history but already removed in production
  (5 old function overloads, `students_section_valid` check)

`20261004160211_catchup_prod_schema_drift.sql` closes that gap. It is written so
that applying it to production is a no-op; do **not** run it there — mark it applied:

```
supabase migration repair --status applied 20261004160211
```

With it, a clean rebuild matches production on all nine fingerprint kinds
(columns, constraints, enums, functions incl. grants, indexes, policies incl.
storage, RLS flags, triggers, buckets). Verified in CI.

## What this does and does not prove

- Proves: the schema (not the data) can be rebuilt from this repo and equals
  production as of the recorded snapshot.
- Does not cover: table data, `auth` / `storage` internals, extensions' versions,
  column order, ownership, comments, sequences/identity, and storage object contents.
- The fingerprint check is a **warning**, not a failure: a new migration
  legitimately changes the fingerprint. After applying a migration to production,
  refresh `supabase/tests/expected_fingerprint.txt` by running
  `supabase/tests/schema_objects.sql` against production (read-only) and then
  re-running the fingerprint query shown in the workflow.
- Going forward, schema changes should be made through migration files, not the
  dashboard, otherwise this drift returns.

## Migrations that touch data (not only schema)

Be careful replaying these against anything other than a scratch database:

- `cleanup_ci_test_pollution_*` — deletes test schools/users and related rows
  (archived in `history-not-replayed/pre-baseline/`)
- `fix_update_student_sync_fee_invoice_with_discount` — also updates three
  specific `student_fees` rows by id
- `discount_pct_to_amount` — backfills `students.discount_amount`
- `20261003191034_attach_accrual_trigger_and_backfill_accruals_baraem_nazwa` —
  inserts journal entries for one specific school id (archived, not replayed)

## Known security observations (from the production catalog; not changed here)

The catch-up reproduces production as-is. Notes found while generating it:

- (Fixed 2026-10-07, see below.) 65 of 232 `public` functions were executable by `PUBLIC` (hence by `anon`),
  including money-moving `SECURITY DEFINER` RPCs such as `record_payment`,
  `approve_payment`, `reject_payment`, `edit_payment_within_window`,
  `delete_payment_within_window`, `food_purchase`. Most check `my_role()`
  internally, but the grant itself is broader than necessary.
- `test_dummy_function()` exists in production.

## Tenant-isolation tests and the policy fix (NOT applied to production)

`supabase/tests/tenant_isolation.sql` (CI step "Tenant isolation & authorization tests")
seeds two schools and acts as owner / parent / anon with real JWT claims.
It found that in production `students_staff_read`, `employees_staff_read`,
`student_fees_school_rw` and `journal_lines_rw` had no role check, so a parent
attached to a school could read all its students, fees and employees and write
`student_fees` / `journal_lines`.
`20261007090000_tighten_role_less_policies.sql` restricts them to owner/admin/accountant
and gives parents read-only access to their own children via `parent_students`.
It is verified in CI only; applying it to production is a separate, deliberate step
(applied to production on 2026-10-07).

## Production hardening applied 2026-10-07

Both migrations below were applied to production (via the SQL editor) and
`expected_fingerprint.txt` was refreshed from production afterwards; a clean rebuild
matches it on all nine kinds.

- `20261007090000_tighten_role_less_policies.sql` - see above.
- `20261007120000_revoke_public_execute_on_rpcs.sql` - anon keeps EXECUTE on 14 pre-login/helper
  functions only (was 65); everything else is authenticated + service_role; trigger functions and
  `test_dummy_function` have no API role. Also closes `next_invoice_number` / `next_expense_code`,
  which accepted any school id from anon without checking the caller.

Register them (and the catch-up) in production's history without re-running them:
```
supabase migration repair --status applied 20261004160211 20261007090000 20261007120000
```
