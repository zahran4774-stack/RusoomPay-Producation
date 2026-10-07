
DO $$
DECLARE
  v_ids uuid[];
  v_profile_ids uuid[];
BEGIN
  SELECT array_agg(s.id) INTO v_ids
  FROM schools s
  WHERE (s.name LIKE 'TEST_%' OR s.name LIKE 'ARCHIVED_TEST_%')
    AND NOT EXISTS (SELECT 1 FROM journal_entries je WHERE je.school_id = s.id);

  SELECT array_agg(id) INTO v_profile_ids FROM profiles WHERE school_id = ANY(v_ids);

  DELETE FROM notifications WHERE guardian_id = ANY(v_profile_ids);
  DELETE FROM payments WHERE school_id = ANY(v_ids);
  DELETE FROM pending_payments WHERE school_id = ANY(v_ids);
  DELETE FROM student_fees WHERE school_id = ANY(v_ids);
  DELETE FROM students WHERE school_id = ANY(v_ids);
  DELETE FROM accounts WHERE school_id = ANY(v_ids);
  DELETE FROM profiles WHERE id = ANY(v_profile_ids);
  DELETE FROM schools WHERE id = ANY(v_ids);
END $$;
