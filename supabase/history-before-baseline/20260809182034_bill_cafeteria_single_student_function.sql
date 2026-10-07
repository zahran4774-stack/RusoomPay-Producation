-- دالة جديدة: فوترة طالب واحد فقط لشهر معيّن — تُستخدم لمن ينضم للتغذية
-- بعد ما الشهر كامل يكون انفوتر أصلاً. لا تتأثر بقفل cafeteria_billing
-- (ذاك القفل خاص بالفوترة الجماعية فقط)، وتتحقق إنه ما يتكرر لنفس الطالب/الشهر.
create or replace function public.bill_cafeteria_student(p_student_id uuid, p_month text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_school uuid;
  r record;
  v_count int := 0;
begin
  v_school := public.my_school_id();
  if v_school is null or public.my_role() not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح بفوترة التغذية';
  end if;
  if p_month is null or p_month !~ '^\d{4}-\d{2}$' then
    raise exception 'صيغة الشهر غير صحيحة (YYYY-MM)';
  end if;

  perform public.ensure_cafeteria_account();

  for r in
    select ms.student_id, mp.name as plan_name, mp.fee
    from public.meal_subscriptions ms
    join public.meal_plans mp on mp.id = ms.plan_id
    join public.students st on st.id = ms.student_id
    where ms.school_id = v_school and st.status = 'active' and ms.student_id = p_student_id
  loop
    -- تفادي التكرار: لا ننشئ فاتورة لو موجودة أصلاً بنفس الوصف لنفس الطالب/الشهر
    if exists (
      select 1 from public.student_fees
      where student_id = r.student_id
        and description = 'تغذية مدرسية شهرية — ' || r.plan_name || ' (' || p_month || ')'
    ) then
      continue;
    end if;

    insert into public.student_fees(school_id, student_id, description, total, paid, due_date)
    values (v_school, r.student_id,
            'تغذية مدرسية شهرية — ' || r.plan_name || ' (' || p_month || ')',
            r.fee, 0, (p_month || '-01')::date);
    v_count := v_count + 1;
  end loop;

  return jsonb_build_object('ok', true, 'invoices_created', v_count);
end;
$$;

revoke all on function public.bill_cafeteria_student(uuid, text) from public, anon;
grant execute on function public.bill_cafeteria_student(uuid, text) to authenticated;
