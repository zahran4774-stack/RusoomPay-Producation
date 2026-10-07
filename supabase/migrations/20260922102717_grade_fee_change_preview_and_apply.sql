-- ═══ 1) معاينة تأثير تغيير سعر المرحلة (تُستدعى قبل الحفظ لعرض نافذة التأكيد) ═══
create function public.grade_fee_change_preview(p_grade text, p_new_fee numeric)
returns json
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_sch    uuid;
  v_role   user_role;
  v_old    numeric;
  v_diff   numeric;
begin
  v_sch  := public.my_school_id();
  v_role := public.my_role();
  if v_sch is null or v_role not in ('owner','admin') then
    raise exception 'غير مصرّح';
  end if;
  if coalesce(p_new_fee,0) <= 0 then raise exception 'الرسوم يجب أن تكون أكبر من صفر'; end if;

  select annual_fee into v_old from public.grade_fees
  where school_id = v_sch and grade = trim(p_grade);

  v_old  := coalesce(v_old, 0);
  v_diff := p_new_fee - v_old;

  return (
    select json_build_object(
      'grade',        trim(p_grade),
      'old_fee',      v_old,
      'new_fee',      p_new_fee,
      'diff',         v_diff,
      'total_students',
        count(*) filter (where not s.is_exempt and s.discount_amount = 0),
      'unpaid_students',
        count(*) filter (where not s.is_exempt and s.discount_amount = 0 and sf.paid = 0 and sf.id is not null),
      'partial_students',
        count(*) filter (where not s.is_exempt and s.discount_amount = 0 and sf.paid > 0 and sf.paid < sf.total),
      'fully_paid_students',
        count(*) filter (where not s.is_exempt and s.discount_amount = 0 and sf.paid >= sf.total and sf.id is not null),
      'discounted_students',
        count(*) filter (where s.discount_amount > 0),
      'exempt_students',
        count(*) filter (where s.is_exempt)
    )
    from public.students s
    left join public.student_fees sf
      on  sf.student_id = s.id
      and sf.description ilike '%الرسوم الدراسية%'
      and sf.deleted_at is null
    where s.school_id = v_sch
      and s.grade = trim(p_grade)
      and s.status = 'active'
  );
end;
$function$;

revoke all on function public.grade_fee_change_preview(text, numeric) from public, anon;
grant execute on function public.grade_fee_change_preview(text, numeric) to authenticated;

-- ═══ 2) تطبيق تغيير السعر على الطلاب الحاليين ═══
-- unpaid  → يُحدَّث إجمالي الفاتورة مباشرة (لم يُدفع شيء)
-- partial → تُنشأ فاتورة إضافية بفرق السعر فقط
-- fully_paid → لا يُمَس (اكتملت الدفعة)
-- discounted / exempt → لا يُمَسّان أبداً
create function public.apply_grade_fee_change(
  p_grade    text,
  p_new_fee  numeric
) returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_sch      uuid;
  v_role     user_role;
  v_old      numeric;
  v_diff     numeric;
  v_updated  integer := 0;
  v_created  integer := 0;
  v_skipped  integer := 0;
  rec        record;
begin
  v_sch  := public.my_school_id();
  v_role := public.my_role();
  if v_sch is null or v_role not in ('owner','admin') then
    raise exception 'غير مصرّح';
  end if;
  if coalesce(p_new_fee,0) <= 0 then raise exception 'الرسوم يجب أن تكون أكبر من صفر'; end if;

  -- جلب السعر القديم
  select annual_fee into v_old from public.grade_fees
  where school_id = v_sch and grade = trim(p_grade);
  v_old  := coalesce(v_old, 0);
  v_diff := p_new_fee - v_old;

  -- حفظ السعر الجديد في الإعدادات
  insert into public.grade_fees(school_id, grade, annual_fee)
  values (v_sch, trim(p_grade), p_new_fee)
  on conflict (school_id, grade) do update
    set annual_fee = excluded.annual_fee, updated_at = now();

  -- تحديث annual_fee في سجل الطالب لمن بلا تخفيض وبلا إعفاء
  update public.students
  set annual_fee = p_new_fee
  where school_id = v_sch
    and grade = trim(p_grade)
    and status = 'active'
    and not is_exempt
    and discount_amount = 0;

  -- لا تغيير في السعر — لا حاجة لمس الفواتير
  if v_diff = 0 then
    insert into public.audit_log(school_id, actor_id, action, details)
    values (v_sch, auth.uid(), 'تحديث تسعير مرحلة', trim(p_grade) || ' → ' || p_new_fee || ' (بدون تغيير)');
    return json_build_object('updated',0,'created',0,'skipped',0,'diff',0);
  end if;

  -- معالجة كل طالب على حدة
  for rec in
    select s.id as sid,
           sf.id as fee_id, sf.total as fee_total, sf.paid as fee_paid
    from public.students s
    left join public.student_fees sf
      on  sf.student_id = s.id
      and sf.description ilike '%الرسوم الدراسية%'
      and sf.deleted_at is null
    where s.school_id = v_sch
      and s.grade = trim(p_grade)
      and s.status = 'active'
      and not s.is_exempt
      and s.discount_amount = 0
  loop
    -- لا توجد فاتورة أصلاً → تجاوز
    if rec.fee_id is null then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    -- سُدِّدت بالكامل → لا تُمَس
    if rec.fee_paid >= rec.fee_total then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    -- لم يُدفع شيء → حدّث الفاتورة مباشرة
    if rec.fee_paid = 0 then
      update public.student_fees
      set total = p_new_fee
      where id = rec.fee_id;
      v_updated := v_updated + 1;

    -- دفع جزئي → أنشئ فاتورة إضافية بالفرق
    else
      insert into public.student_fees(school_id, student_id, description, total, paid, due_date)
      values (
        v_sch, rec.sid,
        case when v_diff > 0
             then 'فرق الرسوم الدراسية (تعديل من ' || v_old || ' إلى ' || p_new_fee || ')'
             else 'خصم تعديل الرسوم الدراسية (من ' || v_old || ' إلى ' || p_new_fee || ')'
        end,
        abs(v_diff), 0, current_date + interval '30 days'
      );
      v_created := v_created + 1;
    end if;
  end loop;

  insert into public.audit_log(school_id, actor_id, action, details)
  values (v_sch, auth.uid(), 'تطبيق تغيير سعر مرحلة',
          trim(p_grade) || ': ' || v_old || ' → ' || p_new_fee ||
          ' | حُدِّث: ' || v_updated || ' | فاتورة فرق: ' || v_created || ' | تجاوز: ' || v_skipped);

  return json_build_object(
    'updated', v_updated, 'created', v_created, 'skipped', v_skipped, 'diff', v_diff
  );
end;
$function$;

revoke all on function public.apply_grade_fee_change(text, numeric) from public, anon;
grant execute on function public.apply_grade_fee_change(text, numeric) to authenticated;