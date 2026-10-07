-- 1) إعادة ربط مشغّل الاستحقاق (موجود في baseline لكنه غير موجود في الإنتاج)
DROP TRIGGER IF EXISTS trg_accrue_student_fee ON public.student_fees;
CREATE TRIGGER trg_accrue_student_fee
  AFTER INSERT ON public.student_fees
  FOR EACH ROW EXECUTE FUNCTION public.accrue_student_fee();

-- 2) قيود استحقاق استدراكية لفواتير براعم نزوى القائمة فقط (Dr ذمم 1210 / Cr إيراد 4100)
--    التاريخ = تاريخ إنشاء الفاتورة (بتوقيت مسقط)، والمبلغ = إجمالي الفاتورة الحالي.
WITH src AS (
  SELECT f.id AS fee_id, f.school_id, f.total, f.description,
         (f.created_at AT TIME ZONE 'Asia/Muscat')::date AS d,
         COALESCE(f.revenue_account_code, '4100') AS rc
  FROM public.student_fees f
  WHERE f.school_id = 'a9125148-4628-4803-b187-5ade209e89bb'
    AND f.deleted_at IS NULL
    AND COALESCE(f.total, 0) > 0
    AND NOT EXISTS (
      SELECT 1 FROM public.journal_entries je
      WHERE je.fee_id = f.id AND je.reference LIKE 'ACCR-%' AND je.deleted_at IS NULL)
),
ins AS (
  INSERT INTO public.journal_entries (school_id, entry_date, description, reference, fee_id, created_by)
  SELECT s.school_id, s.d,
         'استحقاق فاتورة: ' || COALESCE(s.description, '') || ' (استدراك)',
         'ACCR-' || left(s.fee_id::text, 8), s.fee_id, NULL
  FROM src s
  RETURNING id, fee_id, school_id
)
INSERT INTO public.journal_lines (school_id, entry_id, account_id, debit, credit)
SELECT i.school_id, i.id, ar.id, s.total, 0
FROM ins i JOIN src s ON s.fee_id = i.fee_id
JOIN public.accounts ar ON ar.school_id = i.school_id AND ar.code = '1210'
UNION ALL
SELECT i.school_id, i.id, rv.id, 0, s.total
FROM ins i JOIN src s ON s.fee_id = i.fee_id
JOIN public.accounts rv ON rv.school_id = i.school_id AND rv.code = s.rc;

INSERT INTO public.audit_log (school_id, actor_id, action, details)
VALUES ('a9125148-4628-4803-b187-5ade209e89bb', NULL, 'قيود استحقاق استدراكية',
        'تسجيل قيود استحقاق (ACCR) لفواتير الرسوم القائمة بعد إعادة ربط المشغّل');