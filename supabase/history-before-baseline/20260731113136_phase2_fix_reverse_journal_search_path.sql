-- Phase 2 — إصلاح ثغرة أمنية: reverse_journal_entry كانت الدالة الوحيدة من ~150 دالة SECURITY DEFINER
-- بدون SET search_path مثبّت، مما يعرّضها نظرياً لهجوم schema hijacking.
-- لا تغيير في المنطق أو الصلاحيات — فقط إضافة الحماية الوقائية القياسية المستخدمة في كل دالة أخرى بالنظام.
CREATE OR REPLACE FUNCTION public.reverse_journal_entry(p_entry_id uuid, p_reason text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_school   uuid;
  v_orig     record;
  v_new_id   uuid;
  v_line     record;
  v_paid_amount numeric;
begin
  if public.my_role() not in ('owner','accountant') then
    raise exception 'غير مصرّح: عكس القيود لمدير المدرسة أو المحاسب فقط';
  end if;
  if coalesce(trim(p_reason),'') = '' then
    raise exception 'يجب ذكر سبب التصحيح (للتدقيق)';
  end if;

  v_school := public.my_school_id();
  select * into v_orig from public.journal_entries
    where id = p_entry_id and school_id = v_school;
  if not found then raise exception 'القيد غير موجود'; end if;
  if v_orig.reversed_by_entry is not null then
    raise exception 'هذا القيد سبق عكسه — لا يمكن عكسه مرّتين';
  end if;
  if v_orig.reverses_entry is not null then
    raise exception 'لا يمكن عكس قيدٍ هو نفسه قيدٌ عكسي';
  end if;

  insert into public.journal_entries(school_id, entry_date, description, reference, reverses_entry, created_by)
  values(
    v_school, current_date,
    'قيد عكسي (تصحيح) — ' || coalesce(v_orig.description,'') || ' | السبب: ' || p_reason,
    'REV-' || coalesce(v_orig.reference, substr(p_entry_id::text,1,8)),
    p_entry_id, auth.uid()
  )
  returning id into v_new_id;

  for v_line in select account_id, debit, credit from public.journal_lines where entry_id = p_entry_id loop
    insert into public.journal_lines(school_id, entry_id, account_id, debit, credit)
    values(v_school, v_new_id, v_line.account_id, v_line.credit, v_line.debit);
  end loop;

  perform set_config('rusoom.allow_journal_flag', 'on', true);
  update public.journal_entries set reversed_by_entry = v_new_id where id = p_entry_id;
  perform set_config('rusoom.allow_journal_flag', 'off', true);

  if v_orig.fee_id is not null then
    select coalesce(sum(jl.debit),0) into v_paid_amount
    from public.journal_lines jl
    join public.accounts a on a.id = jl.account_id
    where jl.entry_id = p_entry_id and a.code in ('1110','1120');

    if v_paid_amount > 0 then
      update public.student_fees
      set paid = greatest(0, paid - v_paid_amount)
      where id = v_orig.fee_id and school_id = v_school;
    end if;
  end if;

  insert into public.audit_log(school_id, actor_id, action, details)
  values(v_school, auth.uid(), 'عكس قيد محاسبي',
    'القيد ' || p_entry_id::text || ' — السبب: ' || p_reason ||
    case when v_orig.fee_id is not null and coalesce(v_paid_amount,0) > 0
         then ' — خُفّض من رصيد الفاتورة: ' || v_paid_amount::text
         else '' end);

  return v_new_id;
end $function$;