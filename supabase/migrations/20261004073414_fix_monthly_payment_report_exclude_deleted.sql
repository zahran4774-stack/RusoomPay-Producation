-- إصلاح: تقرير الدفع الشهري كان يحتسب الدفعات المحذوفة (deleted_at) — الآن يستثنيها
-- في قسمي "دفعوا" و"لم يدفعوا"، متّسقاً مع student_payments_in_range.
CREATE OR REPLACE FUNCTION public.monthly_payment_report(p_month text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_sch uuid;
  v_month text;
  v_month_start date;
  v_month_end date;
  v_paid jsonb;
  v_unpaid jsonb;
begin
  v_sch := public.my_school_id();
  if v_sch is null or public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح';
  end if;

  v_month := coalesce(p_month, to_char(current_date, 'YYYY-MM'));
  v_month_start := (v_month || '-01')::date;
  v_month_end := (v_month_start + interval '1 month' - interval '1 day')::date;

  -- الطلاب الذين لديهم دفعة معتمدة (غير محذوفة) واحدة على الأقل خلال هذا الشهر
  select coalesce(jsonb_agg(jsonb_build_object(
    'student_id', s.id, 'full_name', s.full_name, 'code', s.code,
    'grade', s.grade, 'section', s.section,
    'amount_paid', t.total_paid, 'last_payment_date', t.last_date
  ) order by s.grade, s.section, s.full_name), '[]'::jsonb)
  into v_paid
  from public.students s
  join (
    select f.student_id, sum(p.amount) as total_paid, max(p.paid_at) as last_date
    from public.payments p
    join public.student_fees f on f.id = p.fee_id
    where f.school_id = v_sch
      and p.deleted_at is null
      and p.paid_at between v_month_start and v_month_end
    group by f.student_id
  ) t on t.student_id = s.id
  where s.school_id = v_sch and s.status = 'active' and s.deleted_at is null;

  -- الطلاب النشطون الذين لا توجد لهم أي دفعة معتمدة (غير محذوفة) خلال هذا الشهر
  select coalesce(jsonb_agg(jsonb_build_object(
    'student_id', s.id, 'full_name', s.full_name, 'code', s.code,
    'grade', s.grade, 'section', s.section,
    'guardian_phone', s.guardian_phone
  ) order by s.grade, s.section, s.full_name), '[]'::jsonb)
  into v_unpaid
  from public.students s
  where s.school_id = v_sch and s.status = 'active' and s.deleted_at is null
    and not exists (
      select 1 from public.payments p
      join public.student_fees f on f.id = p.fee_id
      where f.student_id = s.id and f.school_id = v_sch
        and p.deleted_at is null
        and p.paid_at between v_month_start and v_month_end
    );

  return jsonb_build_object(
    'ok', true, 'month', v_month,
    'month_label', to_char(v_month_start, 'Mon YYYY'),
    'paid', v_paid, 'unpaid', v_unpaid
  );
end;
$function$;