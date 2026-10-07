
-- Part 3 cleanup, evidence-based via pg_stat_user_indexes (2 months of real
-- production usage since stats_reset 2026-06-30):
--
-- students table: idx_students_school (1982 scans) AND idx_students_active
-- (1026 scans) are BOTH actively used by different query paths — NOT
-- redundant in practice. Left untouched.
--
-- student_fees table: idx_fees_active has 0 scans in 2 months, while
-- idx_fees_school (near-identical, unfiltered) has 6668 scans — the planner
-- never chose the partial index even once. Genuinely dead weight; every
-- index costs write overhead on every insert/update with no read benefit.
drop index if exists public.idx_fees_active;
