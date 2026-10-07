-- إضافة رقم هاتف ولي الأمر (وبيانات إضافية) لقائمة الدفعات المعلّقة
-- عشان تُستخدم لإرسال رسالة شكر واتساب فور الاعتماد — بدون تغيير أي عمود موجود
DROP FUNCTION IF EXISTS public.pending_payments_list();

CREATE FUNCTION public.pending_payments_list()
RETURNS TABLE(
  id uuid, guardian text, student text, amount numeric, method text,
  bank_ref text, created_at timestamptz, guardian_phone text, school_name text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  select pp.id,
    coalesce(g.full_name,'ولي أمر'), s.full_name,
    pp.amount, pp.method, pp.bank_ref, pp.created_at,
    coalesce(g.phone, s.guardian_phone),
    sch.name
  from public.pending_payments pp
  join public.student_fees f on f.id = pp.fee_id
  join public.students s on s.id = f.student_id
  left join public.profiles g on g.id = pp.guardian_id
  left join public.schools sch on sch.id = pp.school_id
  where pp.school_id = public.my_school_id() and pp.status = 'pending'
  order by pp.created_at;
$function$;

REVOKE ALL ON FUNCTION public.pending_payments_list() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pending_payments_list() TO authenticated;