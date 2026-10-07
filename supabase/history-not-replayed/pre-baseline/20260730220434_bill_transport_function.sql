-- فوترة النقل المدرسي الشهرية — على غرار bill_cafeteria تماماً
-- تُنشئ فاتورة لكل طالب مشترك في bus_subscriptions (نشط)، بحساب إيراد النقل الصحيح (4210).
-- بما أن revenue_account_code = '4210'، سيُنشئ تريغر accrue_student_fee قيد الاستحقاق تلقائياً
-- (ذمم مدين / إيرادات نقل دائن) فور إدراج الفاتورة — دون أي كود إضافي هنا.
CREATE OR REPLACE FUNCTION public.bill_transport(p_month text)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  v_school uuid;
  v_count int := 0;
  r record;
begin
  v_school := public.my_school_id();
  if v_school is null or public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح بفوترة النقل';
  end if;
  if p_month is null or p_month !~ '^\d{4}-\d{2}$' then
    raise exception 'صيغة الشهر غير صحيحة (YYYY-MM)';
  end if;
  if exists (select 1 from public.transport_billing where school_id = v_school and month = p_month) then
    raise exception 'تمت فوترة هذا الشهر مسبقاً';
  end if;

  perform public.ensure_transport_account();

  for r in
    select bs.student_id, b.route, b.fee
    from public.bus_subscriptions bs
    join public.buses b on b.id = bs.bus_id
    join public.students st on st.id = bs.student_id
    where bs.school_id = v_school and st.status = 'active'
  loop
    insert into public.student_fees(school_id, student_id, description, total, paid, due_date, revenue_account_code)
    values (v_school, r.student_id,
            'نقل مدرسي شهري — ' || r.route || ' (' || p_month || ')',
            r.fee, 0, (p_month || '-01')::date, '4210');
    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    raise exception 'لا يوجد مشتركون في النقل';
  end if;

  insert into public.transport_billing(school_id, month) values (v_school, p_month);
  return v_count;
end;
$function$;

REVOKE ALL ON FUNCTION public.bill_transport(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bill_transport(text) TO authenticated;