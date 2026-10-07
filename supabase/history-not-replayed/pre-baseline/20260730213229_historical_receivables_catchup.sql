-- قيد استحقاق تاريخي شامل: لكل فاتورة قديمة (سابقة لتفعيل التريغر) لها رصيد غير مسدَّد،
-- يُثبَت هذا الرصيد كذمّة على ولي الأمر مقابل حساب الإيراد الصحيح للفاتورة.
-- المبلغ = total - paid فقط (الجزء المحصَّل سابقاً مسجَّل بالفعل كإيراد ولا يُكرَّر).
DO $$
DECLARE
  v_fee record;
  v_outstanding numeric;
  v_entry uuid;
  v_acc_receivable uuid;
  v_acc_revenue uuid;
BEGIN
  FOR v_fee IN
    SELECT id, school_id, description, total, paid, revenue_account_code
    FROM public.student_fees
    WHERE total > paid AND deleted_at IS NULL
  LOOP
    v_outstanding := round(v_fee.total - v_fee.paid, 3);
    IF v_outstanding <= 0 THEN CONTINUE; END IF;

    SELECT id INTO v_acc_receivable FROM public.accounts WHERE school_id = v_fee.school_id AND code = '1210';
    SELECT id INTO v_acc_revenue FROM public.accounts WHERE school_id = v_fee.school_id AND code = coalesce(v_fee.revenue_account_code, '4100');

    IF v_acc_receivable IS NOT NULL AND v_acc_revenue IS NOT NULL THEN
      INSERT INTO public.journal_entries (school_id, description, reference, fee_id)
      VALUES (
        v_fee.school_id,
        'استحقاق تاريخي (لحاق): ' || coalesce(v_fee.description, '') || ' — رصيد غير مسدَّد وقت تفعيل نظام الذمم',
        'ACCR-HIST-' || left(v_fee.id::text, 8),
        v_fee.id
      )
      RETURNING id INTO v_entry;

      INSERT INTO public.journal_lines (school_id, entry_id, account_id, debit, credit) VALUES
        (v_fee.school_id, v_entry, v_acc_receivable, v_outstanding, 0),
        (v_fee.school_id, v_entry, v_acc_revenue, 0, v_outstanding);
    END IF;
  END LOOP;
END $$;