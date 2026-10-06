-- مجموع الدفعات المعتمدة لكل طالب ضمن فترة (من/إلى) — لفلتر "دفعوا / لم يدفعوا" في صفحة الرسوم.
-- SECURITY DEFINER لأن جدول payments لا يملك سياسة قراءة للطاقم؛ العزل عبر my_school_id().
create or replace function public.student_payments_in_range(p_from date default null, p_to date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_sch uuid;
begin
  v_sch := public.my_school_id();
  if v_sch is null or public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'student_id', t.student_id, 'amount', t.total, 'last_date', t.last_date
    ))
    from (
      select f.student_id, sum(p.amount) as total, max(p.paid_at) as last_date
      from public.payments p
      join public.student_fees f on f.id = p.fee_id
      where f.school_id = v_sch
        and p.school_id = v_sch
        and p.deleted_at is null
        and (p_from is null or p.paid_at >= p_from)
        and (p_to is null or p.paid_at <= p_to)
      group by f.student_id
    ) t
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.student_payments_in_range(date, date) from public, anon;
grant execute on function public.student_payments_in_range(date, date) to authenticated;