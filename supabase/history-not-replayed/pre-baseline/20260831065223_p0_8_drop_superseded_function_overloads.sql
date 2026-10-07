
-- P0-8: these three functions were evolved by adding a parameter via
-- CREATE OR REPLACE FUNCTION with a NEW signature. Postgres treats a changed
-- signature as a new overload rather than a replacement, so the OLD
-- signature was never dropped and remained fully callable (register_school's
-- old signature even by `anon`, since school signup is public). App code
-- only ever calls the new signatures (verified via full repo search) — the
-- old ones are dead, exploitable-by-nobody-legitimate surface. Removing them.

drop function if exists public.register_school(
  text, text, text, text, text, text, text, text, text, text, text
);

drop function if exists public.save_bus(
  text, text, integer, numeric, text
);

drop function if exists public.save_inventory_item(
  text, integer, numeric, numeric, numeric
);
