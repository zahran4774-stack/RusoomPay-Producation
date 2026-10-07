CREATE OR REPLACE FUNCTION public.update_student(
  p_student_id uuid, p_full_name text, p_grade text,
  p_section text DEFAULT NULL::text, p_guardian_name text DEFAULT NULL::text,
  p_guardian_phone text DEFAULT NULL::text, p_guardian_email text DEFAULT NULL::text,
  p_birth_date date DEFAULT NULL::date, p_gender text DEFAULT NULL::text,
  p_code text DEFAULT NULL::text, p_annual_fee numeric DEFAULT NULL::numeric,
  p_discount_amount numeric DEFAULT NULL::numeric, p_is_exempt boolean DEFAULT false,
  p_special_case_reason text DEFAULT NULL::text, p_status text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_sch uuid; v_rl user_role; v_prevname text; v_ph text; v_cd text;
  v_discount_pct numeric;
  v_old_fee numeric; v_old_disc numeric; v_new_fee numeric; v_new_disc numeric;
  v_delta numeric;
  v_fee_id uuid; v_fee_total numeric; v_fee_paid numeric; v_fee_rev text; v_new_total numeric;
  v_acc_recv uuid; v_acc_rev uuid; v_entry uuid;
begin
  v_sch := public.my_school_id();
  v_rl  := public.my_role();

  if v_sch is null then raise exception 'لا مدرسة مرتبطة بحسابك'; end if;
  if v_rl not in ('owner', 'admin') then raise exception 'غير مصرّح: تعديل الطلاب للمدير أو الإداري فقط'; end if;

  select full_name, coalesce(annual_fee, 0), coalesce(discount_amount, 0)
    into v_prevname, v_old_fee, v_old_disc
  from public.students
  where id = p_student_id and school_id = v_sch
  for update;
  if v_prevname is null then raise exception 'الطالب غير موجود في مدرستك'; end if;

  if coalesce(trim(p_full_name), '') = '' then raise exception 'اسم الطالب مطلوب'; end if;
  if coalesce(trim(p_grade), '')     = '' then raise exception 'الصف/المرحلة مطلوب'; end if;
  if coalesce(trim(p_section), '')   = '' then raise exception 'الشعبة مطلوبة'; end if;

  if not coalesce(p_is_exempt, false) then
    if p_annual_fee is null or p_annual_fee <= 0 then
      raise exception 'الرسوم السنوية مطلوبة ويجب أن تكون أكبر من صفر';
    end if;
  end if;

  if coalesce(p_discount_amount, 0) < 0 then
    raise exception 'مبلغ التخفيض لا يمكن أن يكون سالباً';
  end if;
  if coalesce(p_discount_amount, 0) > coalesce(p_annual_fee, 0) then
    raise exception 'مبلغ التخفيض لا يمكن أن يتجاوز الرسوم السنوية';
  end if;

  if coalesce(trim(p_special_case_reason), '') <> '' and coalesce(p_discount_amount, 0) <= 0 then
    raise exception 'حدد مبلغ التخفيض المرتبط بالحالة الخاصة';
  end if;

  if p_status is not null and p_status not in ('active','transferred','graduated','withdrawn') then
    raise exception 'حالة غير معروفة';
  end if;

  v_ph := public.normalize_phone(p_guardian_phone, '968');
  if v_ph is null then raise exception 'رقم ولي الأمر مطلوب لتمكينه من متابعة أبنائه'; end if;
  if not public.is_valid_gulf_phone(v_ph) then
    raise exception 'رقم ولي الأمر غير صالح: يجب أن يكون رقماً عُمانياً صحيحاً (8 خانات تبدأ بـ 7 أو 9)';
  end if;

  if coalesce(trim(p_code), '') <> '' then
    v_cd := trim(p_code);
    if exists (select 1 from public.students where school_id = v_sch and code = v_cd and id <> p_student_id) then
      raise exception 'الرقم المدرسي % مستخدم بالفعل', v_cd;
    end if;
  end if;

  v_new_fee  := coalesce(p_annual_fee, v_old_fee);
  v_new_disc := coalesce(p_discount_amount, v_old_disc, 0);

  -- نسبة التخفيض للعرض = المبلغ ÷ الرسوم الأساسية × 100
  v_discount_pct := case
    when v_new_fee > 0 and v_new_disc > 0
    then least(round(v_new_disc / v_new_fee * 100, 3), 100)
    else 0 end;

  update public.students set
    full_name           = trim(p_full_name),
    grade               = trim(p_grade),
    section             = nullif(trim(p_section), ''),
    guardian_name       = nullif(trim(p_guardian_name), ''),
    guardian_phone      = v_ph,
    guardian_email      = nullif(trim(p_guardian_email), ''),
    birth_date          = p_birth_date,
    gender              = nullif(trim(p_gender), ''),
    code                = coalesce(v_cd, code),
    annual_fee          = v_new_fee,
    discount_pct        = v_discount_pct,
    discount_amount     = v_new_disc,
    is_exempt           = coalesce(p_is_exempt, false),
    special_case_reason = nullif(trim(p_special_case_reason), ''),
    status              = coalesce(p_status::student_status, status)
  where id = p_student_id and school_id = v_sch;

  -- مزامنة فاتورة الرسوم الدراسية مع تغيّر الرسوم/التخفيض (بالفرق، فتبقى رسوم النقل/التغذية المدمجة سليمة)
  v_delta := (v_new_fee - v_old_fee) - (v_new_disc - v_old_disc);

  if not coalesce(p_is_exempt, false) and v_delta <> 0 then
    select id, total, paid, revenue_account_code
      into v_fee_id, v_fee_total, v_fee_paid, v_fee_rev
    from public.student_fees
    where student_id = p_student_id and school_id = v_sch and deleted_at is null
      and description like 'الرسوم الدراسية السنوية%'
    order by created_at desc
    limit 1
    for update;

    if v_fee_id is not null then
      v_new_total := round(v_fee_total + v_delta, 3);

      if v_new_total < v_fee_paid then
        raise exception 'لا يمكن تطبيق التعديل: المبلغ المدفوع (%) أكبر من صافي الرسوم الجديد (%). عالج الاسترداد أو الرصيد أولاً', v_fee_paid, v_new_total;
      end if;

      update public.student_fees set
        total = v_new_total,
        description = regexp_replace(description, '\s*\(بعد تخفيض[^)]*\)', '', 'g')
          || case when v_new_disc > 0
                  then ' (بعد تخفيض ' || trim_scale(v_new_disc)::text || ' ر.ع)'
                  else '' end
      where id = v_fee_id;

      -- إن كان للفاتورة قيد استحقاق، نسجّل قيد تسوية بالفرق (القيود غير قابلة للتعديل)
      if exists (select 1 from public.journal_entries
                 where fee_id = v_fee_id and reference like 'ACCR-%' and deleted_at is null) then
        select id into v_acc_recv from public.accounts where school_id = v_sch and code = '1210';
        select id into v_acc_rev  from public.accounts where school_id = v_sch and code = coalesce(v_fee_rev, '4100');

        if v_acc_recv is not null and v_acc_rev is not null then
          insert into public.journal_entries (school_id, description, reference, fee_id, created_by)
          values (v_sch, 'تسوية استحقاق بعد تعديل رسوم/تخفيض الطالب: ' || trim(p_full_name),
                  'ADJ-' || left(v_fee_id::text, 8), v_fee_id, auth.uid())
          returning id into v_entry;

          if v_delta < 0 then
            insert into public.journal_lines (school_id, entry_id, account_id, debit, credit) values
              (v_sch, v_entry, v_acc_rev,  abs(v_delta), 0),
              (v_sch, v_entry, v_acc_recv, 0, abs(v_delta));
          else
            insert into public.journal_lines (school_id, entry_id, account_id, debit, credit) values
              (v_sch, v_entry, v_acc_recv, v_delta, 0),
              (v_sch, v_entry, v_acc_rev,  0, v_delta);
          end if;
        end if;
      end if;

      insert into public.audit_log (school_id, actor_id, action, details)
      values (v_sch, auth.uid(), 'تعديل فاتورة الرسوم تلقائياً',
              trim(p_full_name) || ': ' || v_fee_total::text || ' ← ' || v_new_total::text);
    end if;
  end if;

  insert into public.audit_log (school_id, actor_id, action, details)
  values (v_sch, auth.uid(), 'تعديل بيانات طالب', v_prevname || ' ← ' || trim(p_full_name));
end;
$function$;

REVOKE ALL ON FUNCTION public.update_student(uuid,text,text,text,text,text,text,date,text,text,numeric,numeric,boolean,text,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.update_student(uuid,text,text,text,text,text,text,date,text,text,numeric,numeric,boolean,text,text) TO authenticated;

-- تصحيح الفواتير الحالية المتأثرة (بدون مدفوعات/قيود استحقاق تتعارض)
with fix as (
  update public.student_fees f set
    total = v.new_total,
    description = regexp_replace(f.description, '\s*\(بعد تخفيض[^)]*\)', '', 'g') || ' (بعد تخفيض ' || v.disc_txt || ' ر.ع)'
  from (values
    ('aa631210-51d6-4d7d-9c3e-c34761eb44cd'::uuid, 700::numeric, 650::numeric,    '50'),
    ('2a9a3f12-a647-475b-a3d7-8b8bdcb696ad'::uuid, 800::numeric, 640::numeric,    '160'),
    ('c02b274d-854b-48e5-b366-be0771dc57f1'::uuid, 697::numeric, 650.250::numeric,'114.75')
  ) as v(fee_id, old_total, new_total, disc_txt)
  where f.id = v.fee_id and f.total = v.old_total and f.paid <= v.new_total and f.deleted_at is null
  returning f.school_id, f.student_id, v.old_total, v.new_total
)
insert into public.audit_log (school_id, actor_id, action, details)
select fix.school_id, null, 'تصحيح فاتورة (مزامنة التخفيض)',
       s.full_name || ': ' || fix.old_total::text || ' ← ' || fix.new_total::text
from fix join public.students s on s.id = fix.student_id;