
-- Supporting index for the new date-bounded dashboard_summary() query
-- (join journal_lines -> journal_entries, filtered by school + entry_date).
create index if not exists idx_journal_entries_school_date on public.journal_entries(school_id, entry_date);

-- Supporting index for the new date-bounded student_fees aggregates
-- (school + created_at range).
create index if not exists idx_fees_school_created on public.student_fees(school_id, created_at) where deleted_at is null;
