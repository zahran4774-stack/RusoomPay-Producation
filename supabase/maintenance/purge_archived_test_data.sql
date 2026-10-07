-- حذف بيانات الاختبار المتروكة في الإنتاج: مدارس ARCHIVED_TEST_* (is_test=true) ومستخدمو @test.rusoompay.invalid.
-- ليس migration (لا يعمل مع supabase start/db push)؛ يُشغَّل يدوياً مرة واحدة في SQL Editor.
-- كل شيء في معاملة واحدة: أي حارس يفشل = لا يُحذف شيء. القيود المحاسبية محميّة بـ triggers؛ نعطّل
-- trigger الحذف (no_delete_lines / no_delete_journal) داخل المعاملة فقط ثم نعيده ونتحقق أنه عاد.
-- حُوكي هذا السكربت في CI على قاعدة مؤقتة مطابقة للحالة (مدارس ARCHIVED_TEST + قيود + مستخدمو اختبار)
-- مع مدرسة "حقيقية" للتأكد أنها لا تتأثر، قبل تسليمه.
BEGIN;

CREATE TEMP TABLE _cfg (expect_schools int, expect_users int) ON COMMIT DROP;
INSERT INTO _cfg VALUES (15, 212);   -- القيم المتوقعة (تحقّقتُ منها بقراءة فقط من الإنتاج)

CREATE TEMP TABLE _ts ON COMMIT DROP AS
  SELECT id FROM public.schools WHERE name LIKE 'ARCHIVED\_TEST\_%' ESCAPE '\' AND is_test IS TRUE;
CREATE TEMP TABLE _tu ON COMMIT DROP AS
  SELECT id FROM auth.users WHERE email LIKE '%@test.rusoompay.invalid';

-- لقطة قبل: بيانات كل ما ليس اختباراً يجب أن تبقى كما هي
CREATE TEMP TABLE _before ON COMMIT DROP AS
  SELECT 'schools' t, count(*) n FROM public.schools WHERE id NOT IN (SELECT id FROM _ts)
  UNION ALL SELECT 'journal_entries', count(*) FROM public.journal_entries WHERE school_id NOT IN (SELECT id FROM _ts)
  UNION ALL SELECT 'journal_lines',   count(*) FROM public.journal_lines   WHERE school_id NOT IN (SELECT id FROM _ts)
  UNION ALL SELECT 'payments',        count(*) FROM public.payments        WHERE school_id NOT IN (SELECT id FROM _ts)
  UNION ALL SELECT 'students',        count(*) FROM public.students        WHERE school_id NOT IN (SELECT id FROM _ts)
  UNION ALL SELECT 'student_fees',    count(*) FROM public.student_fees    WHERE school_id NOT IN (SELECT id FROM _ts)
  UNION ALL SELECT 'accounts',        count(*) FROM public.accounts        WHERE school_id NOT IN (SELECT id FROM _ts)
  UNION ALL SELECT 'audit_log',       count(*) FROM public.audit_log       WHERE school_id NOT IN (SELECT id FROM _ts)
  UNION ALL SELECT 'profiles',        count(*) FROM public.profiles        WHERE id NOT IN (SELECT id FROM _tu)
  UNION ALL SELECT 'auth_users',      count(*) FROM auth.users             WHERE id NOT IN (SELECT id FROM _tu);

-- حراس المعاملة
DO $$
DECLARE c _cfg%ROWTYPE;
BEGIN
  SELECT * INTO c FROM _cfg;
  IF (SELECT count(*) FROM _ts) <> c.expect_schools THEN
    RAISE EXCEPTION 'عدد مدارس الاختبار % ≠ المتوقع %', (SELECT count(*) FROM _ts), c.expect_schools;
  END IF;
  IF (SELECT count(*) FROM _tu) <> c.expect_users THEN
    RAISE EXCEPTION 'عدد مستخدمي الاختبار % ≠ المتوقع %', (SELECT count(*) FROM _tu), c.expect_users;
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles p JOIN _tu u ON u.id = p.id WHERE p.school_id NOT IN (SELECT id FROM _ts)) THEN
    RAISE EXCEPTION 'مستخدم اختبار مرتبط بمدرسة غير اختبارية — توقّف';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles p WHERE p.school_id IN (SELECT id FROM _ts) AND p.id NOT IN (SELECT id FROM _tu)) THEN
    RAISE EXCEPTION 'ملف شخصي حقيقي داخل مدرسة اختبار — توقّف';
  END IF;
  IF EXISTS (SELECT 1 FROM public.payments WHERE school_id IN (SELECT id FROM _ts)) THEN
    RAISE EXCEPTION 'مدفوعات داخل مدارس الاختبار — غير متوقع، توقّف';
  END IF;
END $$;

-- حذف المدارس (cascade لكل جداولها) مع تعطيل حارس حذف القيود داخل المعاملة فقط
ALTER TABLE public.journal_lines   DISABLE TRIGGER no_delete_lines;
ALTER TABLE public.journal_entries DISABLE TRIGGER no_delete_journal;
-- جداول مرتبطة بالمدرسة بلا cascade (NO ACTION): نفرّغ صفوف مدارس الاختبار فقط
DELETE FROM public.school_invoice_counters WHERE school_id IN (SELECT id FROM _ts);
DELETE FROM public.user_permissions        WHERE school_id IN (SELECT id FROM _ts);
DELETE FROM public.certificate_requests    WHERE school_id IN (SELECT id FROM _ts);
DELETE FROM public.meal_orders             WHERE school_id IN (SELECT id FROM _ts);
UPDATE public.profiles SET impersonating_school_id = NULL WHERE impersonating_school_id IN (SELECT id FROM _ts);
DELETE FROM public.schools WHERE id IN (SELECT id FROM _ts);
ALTER TABLE public.journal_entries ENABLE TRIGGER no_delete_journal;
ALTER TABLE public.journal_lines   ENABLE TRIGGER no_delete_lines;

-- حذف مستخدمي الاختبار (ومنهم 197 يتيماً بلا ملف شخصي)
DELETE FROM auth.users WHERE id IN (SELECT id FROM _tu);

-- تحقق نهائي (أي فشل = تراجع كامل)
DO $$
DECLARE r record; a bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM public.schools WHERE name LIKE 'ARCHIVED\_TEST\_%' ESCAPE '\') THEN RAISE EXCEPTION 'بقيت مدارس اختبار'; END IF;
  IF EXISTS (SELECT 1 FROM auth.users WHERE email LIKE '%@test.rusoompay.invalid') THEN RAISE EXCEPTION 'بقي مستخدمو اختبار'; END IF;
  FOR r IN SELECT t, n FROM _before LOOP
    a := CASE r.t
      WHEN 'schools' THEN (SELECT count(*) FROM public.schools)
      WHEN 'journal_entries' THEN (SELECT count(*) FROM public.journal_entries)
      WHEN 'journal_lines' THEN (SELECT count(*) FROM public.journal_lines)
      WHEN 'payments' THEN (SELECT count(*) FROM public.payments)
      WHEN 'students' THEN (SELECT count(*) FROM public.students)
      WHEN 'student_fees' THEN (SELECT count(*) FROM public.student_fees)
      WHEN 'accounts' THEN (SELECT count(*) FROM public.accounts)
      WHEN 'audit_log' THEN (SELECT count(*) FROM public.audit_log)
      WHEN 'profiles' THEN (SELECT count(*) FROM public.profiles)
      WHEN 'auth_users' THEN (SELECT count(*) FROM auth.users)
    END;
    IF a <> r.n THEN RAISE EXCEPTION 'تغيّر عدد % من % إلى % — تراجع', r.t, r.n, a; END IF;
  END LOOP;
  IF (SELECT count(*) FROM pg_trigger WHERE tgname IN ('no_delete_journal','no_delete_lines') AND tgenabled = 'O') <> 2 THEN
    RAISE EXCEPTION 'حارس حذف القيود لم يُعَد تفعيله — تراجع';
  END IF;
  RAISE NOTICE 'PURGE OK';
END $$;

COMMIT;
