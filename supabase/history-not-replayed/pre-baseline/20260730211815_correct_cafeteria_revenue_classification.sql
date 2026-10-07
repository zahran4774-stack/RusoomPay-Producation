-- قيد تصحيحي: ينقل أثر إيراد التغذية (المسجَّل خطأً في 4100) إلى حسابه الصحيح 4220
-- دون لمس القيود الأصلية للتحصيل — يحافظ على مبدأ عدم تعديل القيود المرحّلة
DO $$
DECLARE
  v_school   uuid;
  v_total    numeric;
  v_acc_4100 uuid;
  v_acc_4220 uuid;
  v_entry    uuid;
BEGIN
  SELECT jl.school_id, sum(jl.credit), a.id
    INTO v_school, v_total, v_acc_4100
  FROM public.journal_lines jl
  JOIN public.journal_entries je ON je.id = jl.entry_id
  JOIN public.accounts a ON a.id = jl.account_id
  WHERE je.reference IN ('INV-2bb954e3', 'INV-0679517b') AND a.code = '4100'
  GROUP BY jl.school_id, a.id;

  IF v_school IS NOT NULL THEN
    SELECT id INTO v_acc_4220 FROM public.accounts WHERE school_id = v_school AND code = '4220';

    INSERT INTO public.journal_entries (school_id, description, reference, created_by)
    VALUES (
      v_school,
      'تصحيح تبويب حساب: نقل أثر إيراد تغذية (فاتورتا إفطار/غداء يوليو) من إيرادات الرسوم الدراسية إلى إيرادات التغذية',
      'FIX-4100-4220', NULL
    )
    RETURNING id INTO v_entry;

    -- عكس القيد الخاطئ على 4100 (كان دائناً بالمجموع → نمدينه بنفس القيمة لإلغاء أثره)
    INSERT INTO public.journal_lines (school_id, entry_id, account_id, debit, credit)
    VALUES (v_school, v_entry, v_acc_4100, v_total, 0);

    -- إثباته الصحيح على 4220 (دائن بنفس القيمة الأصلية)
    INSERT INTO public.journal_lines (school_id, entry_id, account_id, debit, credit)
    VALUES (v_school, v_entry, v_acc_4220, 0, v_total);
  END IF;
END $$;