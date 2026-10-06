# Migrations

`2026MMDDhhmmss_*.sql` files are the production migration history exported
byte-for-byte from `supabase_migrations.schema_migrations` (project
`hmskpglpltaeiznvxvcb`). Versions and names match the DB, so the repo history
and the DB history line up. Verified by md5 of `array_to_string(statements, E'\n')`
for all 148 entries from `20260718025514` to `20261004160210`.

`00000000000001..06` are earlier hand-written baselines. Baseline 1 is kept as is
(it is more accurate than the DB history entry because of generated columns, so
it intentionally differs from the corresponding DB record).

## Migrations that touch data (not only schema)

Be careful replaying these against anything other than a scratch database:

- `cleanup_ci_test_pollution_*` — deletes test schools/users and related rows
- `attach_accrual_trigger_and_backfill_accruals_baraem_nazwa` — inserts journal
  entries for one specific school id
- `fix_update_student_sync_fee_invoice_with_discount` — also updates three
  specific `student_fees` rows by id
- `discount_pct_to_amount` — backfills `students.discount_amount`
- `historical_*` and `correct_*_classification` — data corrections
- `rusoompay_control_init_schema` — initial schema of the control project

## Not yet verified

A clean rebuild (`supabase start` / `supabase db reset`) from this folder has
not been run yet; ordering and idempotency of the baselines vs. the exported
history are unproven until that CI check exists.
