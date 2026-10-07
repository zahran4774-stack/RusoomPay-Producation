
DELETE FROM auth.users u
WHERE u.email LIKE '%@test.rusoompay.invalid'
  AND NOT EXISTS (SELECT 1 FROM journal_entries je WHERE je.created_by = u.id);
