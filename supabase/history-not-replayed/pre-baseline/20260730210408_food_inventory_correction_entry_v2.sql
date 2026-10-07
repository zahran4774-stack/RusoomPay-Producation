-- قيد تصحيحي: ينقل أثر صرف التغذية القديم (الذي أُثبت خطأً على 1310) إلى حسابه الصحيح 1320
-- دون لمس القيد الأصلي — يحافظ على مبدأ عدم تعديل القيود المرحّلة
DO $$
DECLARE
  v_school     uuid;
  v_old_debit  numeric;
  v_old_credit numeric;
  v_acc_1310   uuid;
  v_acc_1320   uuid;
  v_entry      uuid;
BEGIN
  SELECT jl.school_id, jl.debit, jl.credit, a.id
    INTO v_school, v_old_debit, v_old_credit, v_acc_1310
  FROM public.journal_lines jl
  JOIN public.journal_entries je ON je.id = jl.entry_id
  JOIN public.accounts a ON a.id = jl.account_id
  WHERE je.reference = 'FDISP-01336e93' AND a.code = '1310';

  IF v_school IS NOT NULL THEN
    SELECT id INTO v_acc_1320 FROM public.accounts WHERE school_id = v_school AND code = '1320';

    INSERT INTO public.journal_entries (school_id, description, reference, created_by)
    VALUES (
      v_school,
      'تصحيح تبويب حساب: نقل أثر صرف تغذية (عصير) من مخزون الكتب والزي إلى مخزون التغذية',
      'FIX-1310-1320', NULL
    )
    RETURNING id INTO v_entry;

    -- عكس القيد الخاطئ على 1310 (كان دائناً بـ 0.750 → نمدينه بنفس القيمة لإلغاء أثره)
    INSERT INTO public.journal_lines (school_id, entry_id, account_id, debit, credit)
    VALUES (v_school, v_entry, v_acc_1310, v_old_credit, v_old_debit);

    -- إثباته الصحيح على 1320 (دائن بنفس القيمة الأصلية)
    INSERT INTO public.journal_lines (school_id, entry_id, account_id, debit, credit)
    VALUES (v_school, v_entry, v_acc_1320, v_old_debit, v_old_credit);
  END IF;
END $$;