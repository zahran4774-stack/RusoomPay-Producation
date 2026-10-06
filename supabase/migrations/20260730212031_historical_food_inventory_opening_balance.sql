DO $$
DECLARE
  v_school        uuid := '643e432c-023b-4451-a9e8-a04e25ead030';
  v_actual_value  numeric;
  v_booked_value  numeric;
  v_gap           numeric;
  v_entry         uuid;
  v_acc_1320      uuid;
  v_acc_3100      uuid;
BEGIN
  SELECT coalesce(sum(qty * cost), 0) INTO v_actual_value
  FROM public.food_inventory WHERE school_id = v_school;

  SELECT coalesce(sum(jl.debit),0) - coalesce(sum(jl.credit),0) INTO v_booked_value
  FROM public.journal_lines jl
  JOIN public.accounts a ON a.id = jl.account_id
  WHERE a.school_id = v_school AND a.code = '1320';

  v_gap := round(v_actual_value - v_booked_value, 3);

  SELECT id INTO v_acc_1320 FROM public.accounts WHERE school_id = v_school AND code = '1320';
  SELECT id INTO v_acc_3100 FROM public.accounts WHERE school_id = v_school AND code = '3100';

  IF v_gap <> 0 THEN
    INSERT INTO public.journal_entries (school_id, description, reference, created_by)
    VALUES (
      v_school,
      'رصيد افتتاحي تاريخي لمخزون التغذية — تصحيح فجوة أصناف أُدخلت قبل تفعيل القيد الافتتاحي التلقائي',
      'OPEN-HIST-1320', NULL
    )
    RETURNING id INTO v_entry;

    INSERT INTO public.journal_lines (school_id, entry_id, account_id, debit, credit) VALUES
      (v_school, v_entry, v_acc_1320, v_gap, 0),
      (v_school, v_entry, v_acc_3100, 0, v_gap);
  END IF;
END $$;