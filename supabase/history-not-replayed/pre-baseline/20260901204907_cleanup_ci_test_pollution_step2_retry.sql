
DO $$
DECLARE
  v_ids uuid[];
  v_profile_ids uuid[];
BEGIN
  SELECT array_agg(id) INTO v_ids FROM schools WHERE is_test = true;
  SELECT array_agg(id) INTO v_profile_ids FROM profiles WHERE school_id = ANY(v_ids);

  DELETE FROM notifications WHERE guardian_id = ANY(v_profile_ids);
  DELETE FROM payments WHERE school_id = ANY(v_ids);
  DELETE FROM pending_payments WHERE school_id = ANY(v_ids);
  DELETE FROM student_fees sf WHERE sf.school_id = ANY(v_ids)
    AND NOT EXISTS (SELECT 1 FROM journal_entries je WHERE je.fee_id = sf.id);
  DELETE FROM students st WHERE st.school_id = ANY(v_ids)
    AND NOT EXISTS (SELECT 1 FROM student_fees sf WHERE sf.student_id = st.id);
  DELETE FROM accounts a WHERE a.school_id = ANY(v_ids)
    AND NOT EXISTS (SELECT 1 FROM journal_lines jl WHERE jl.account_id = a.id);
  DELETE FROM profiles WHERE id = ANY(v_profile_ids);
END $$;
