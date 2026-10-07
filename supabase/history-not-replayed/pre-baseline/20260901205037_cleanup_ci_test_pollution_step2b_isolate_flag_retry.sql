
UPDATE schools
SET is_test = true, active = false
WHERE name LIKE 'TEST_%' OR name LIKE 'ARCHIVED_TEST_%';
