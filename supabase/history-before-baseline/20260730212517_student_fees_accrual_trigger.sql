-- تريغر أساس الاستحقاق الكامل: عند إصدار أي فاتورة رسوم (INSERT في student_fees)
-- يُنشأ تلقائياً قيد: ذمم أولياء الأمور (1210) مدين / حساب الإيراد المناسب دائن
-- يعمل بغض النظر عن مصدر الفاتورة (add_student بأي نسخة، import_students، bill_cafeteria، inventory_sell...)
-- لا يتكرر مع قيد COGS الخاص بالمخزون (COGS منفصل تماماً: 5520/1310، لا علاقة له بالإيراد).
CREATE OR REPLACE FUNCTION public.accrue_student_fee()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_entry uuid;
  v_acc_receivable uuid;
  v_acc_revenue uuid;
BEGIN
  IF coalesce(NEW.total, 0) <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_acc_receivable FROM public.accounts WHERE school_id = NEW.school_id AND code = '1210';
  SELECT id INTO v_acc_revenue FROM public.accounts WHERE school_id = NEW.school_id AND code = coalesce(NEW.revenue_account_code, '4100');

  IF v_acc_receivable IS NOT NULL AND v_acc_revenue IS NOT NULL THEN
    INSERT INTO public.journal_entries (school_id, description, reference, fee_id, created_by)
    VALUES (
      NEW.school_id,
      'استحقاق فاتورة: ' || coalesce(NEW.description, ''),
      'ACCR-' || left(NEW.id::text, 8),
      NEW.id,
      auth.uid()
    )
    RETURNING id INTO v_entry;

    INSERT INTO public.journal_lines (school_id, entry_id, account_id, debit, credit) VALUES
      (NEW.school_id, v_entry, v_acc_receivable, NEW.total, 0),
      (NEW.school_id, v_entry, v_acc_revenue, 0, NEW.total);
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_accrue_student_fee
  AFTER INSERT ON public.student_fees
  FOR EACH ROW
  EXECUTE FUNCTION public.accrue_student_fee();