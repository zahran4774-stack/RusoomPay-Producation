
-- Part 3 finding: profiles.phone and students.guardian_phone are looked up
-- directly (enqueue_notification, _confirm_thawani_payment_core,
-- parent_signup_by_phone) with no supporting index. Harmless at current
-- data volume (hundreds of rows) but becomes a full table scan across the
-- whole platform as it grows — pure performance fix, zero behavior change.
create index if not exists idx_profiles_phone on public.profiles(phone) where phone is not null;
create index if not exists idx_students_guardian_phone on public.students(guardian_phone) where guardian_phone is not null;
