-- قيد تصحيحي: ينقل أثر إيراد النقل (المسجَّل خطأً في 4100 قبل تفعيل التصنيف الديناميكي) إلى 4210
DO $$
DECLARE
  v_school   uuid;
  v_total    numeric;
  v_acc_4100 uuid;
  v_acc_4210 uuid;
  v_entry    uuid;
BEGIN
  SELECT jl.school_id, sum(jl.credit), a.id
    INTO v_school, v_total, v_acc_4100
  FROM public.journal_lines jl
  JOIN public.journal_entries je ON je.id = jl.entry_id
  JOIN public.accounts a ON a.id = jl.account_id
  WHERE je.reference = 'INV-0860ca37' AND a.code = '4100'
  GROUP BY jl.school_id, a.id;

  IF v_school IS NOT NULL THEN
    SELECT id INTO v_acc_4210 FROM public.accounts WHERE school_id = v_school AND code = '4210';

    INSERT INTO public.journal_entries (school_id, description, reference, created_by)
    VALUES (
      v_school,
      'تصحيح تبويب حساب: نقل أثر إيراد النقل المدرسي (نزوى) من إيرادات الرسوم الدراسية إلى إيرادات النقل المدرسي',
      'FIX-4100-4210', NULL
    )
    RETURNING id INTO v_entry;

    INSERT INTO public.journal_lines (school_id, entry_id, account_id, debit, credit)
    VALUES (v_school, v_entry, v_acc_4100, v_total, 0);

    INSERT INTO public.journal_lines (school_id, entry_id, account_id, debit, credit)
    VALUES (v_school, v_entry, v_acc_4210, 0, v_total);
  END IF;
END $$;