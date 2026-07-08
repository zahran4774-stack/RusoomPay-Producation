-- ============================================================================
-- RusoomPay — نزاهة القيود المحاسبية (منع التلاعب + التصحيح بالعكس)
-- المبدأ المحاسبي: القيد المرحّل لا يُعدّل ولا يُحذف — بل يُعكَس بقيد مضادّ.
--   • قفل صارم: لا تعديل/حذف للقيود عبر RLS
--   • التصحيح الوحيد المسموح: reverse_journal_entry (قيد عكسي)
--   • المخوّل: المحاسب والمدير فقط، مع تسجيل تدقيق كامل
-- ينفّذ بعد 01..29
-- ============================================================================

-- 1) أعمدة تتبّع حالة القيد (هل عُكِس؟ ومتى؟)
alter table public.journal_entries
  add column if not exists reversed_by_entry uuid references public.journal_entries(id) on delete set null,
  add column if not exists reverses_entry    uuid references public.journal_entries(id) on delete set null,
  add column if not exists is_locked         boolean not null default true;

-- 2) قفل RLS الصارم: القيود للقراءة والإنشاء فقط — لا تعديل ولا حذف
--    (نستبدل السياسة المرنة القديمة for all بسياسات محدّدة)
drop policy if exists journals_staff on public.journal_entries;
drop policy if exists lines_staff    on public.journal_lines;

-- قراءة: المدير والمحاسب
create policy journals_read on public.journal_entries
  for select using (school_id = public.my_school_id()
    and public.my_role() in ('owner','accountant'));
-- إنشاء: المدير والمحاسب (الإدراج فقط)
create policy journals_insert on public.journal_entries
  for insert with check (school_id = public.my_school_id()
    and public.my_role() in ('owner','accountant'));
-- ⚠️ لا سياسة UPDATE ولا DELETE → القيود غير قابلة للتعديل/الحذف نهائياً

create policy lines_read on public.journal_lines
  for select using (school_id = public.my_school_id()
    and public.my_role() in ('owner','accountant'));
create policy lines_insert on public.journal_lines
  for insert with check (school_id = public.my_school_id()
    and public.my_role() in ('owner','accountant'));
-- ⚠️ لا تعديل/حذف لسطور القيد أيضاً

-- 3) حاجز إضافي على مستوى قاعدة البيانات (trigger) — يمنع أي تعديل/حذف
--    حتى عبر دوال security definer، دفاع بعمق
create or replace function public.block_journal_mutation()
returns trigger language plpgsql as $$
begin
  -- يُسمح بالتحديث فقط حين تضبط دالة العكس علم الجلسة (وسم reversed_by_entry)
  if tg_op = 'UPDATE' and current_setting('rusoom.allow_journal_flag', true) = 'on' then
    return new;
  end if;
  raise exception 'القيود المحاسبية لا تُعدّل ولا تُحذف — استخدم القيد العكسي للتصحيح';
end; $$;

drop trigger if exists no_update_journal on public.journal_entries;
drop trigger if exists no_delete_journal on public.journal_entries;
create trigger no_update_journal before update on public.journal_entries
  for each row execute function public.block_journal_mutation();
create trigger no_delete_journal before delete on public.journal_entries
  for each row execute function public.block_journal_mutation();

drop trigger if exists no_update_lines on public.journal_lines;
drop trigger if exists no_delete_lines on public.journal_lines;
create trigger no_update_lines before update on public.journal_lines
  for each row execute function public.block_journal_mutation();
create trigger no_delete_lines before delete on public.journal_lines
  for each row execute function public.block_journal_mutation();

-- ملاحظة: التحديث الوحيد المسموح (وسم القيد بأنه عُكِس) يتمّ عبر الدالة أدناه
-- التي تعطّل الحاجز مؤقّتاً لعمودٍ واحد فقط بشكل مضبوط.

-- 4) دالة التصحيح الوحيدة: عكس قيد (تُنشئ قيداً مضادّاً)
create or replace function public.reverse_journal_entry(
  p_entry_id uuid,
  p_reason   text
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_school   uuid;
  v_orig     record;
  v_new_id   uuid;
  v_line     record;
begin
  -- المخوّل: المحاسب والمدير فقط
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

  -- أنشئ القيد العكسي (نفس التاريخ، وصف يوضّح أنه تصحيح)
  insert into public.journal_entries(school_id, entry_date, description, reference, reverses_entry, created_by)
  values(
    v_school, current_date,
    'قيد عكسي (تصحيح) — ' || coalesce(v_orig.description,'') || ' | السبب: ' || p_reason,
    'REV-' || coalesce(v_orig.reference, substr(p_entry_id::text,1,8)),
    p_entry_id, auth.uid()
  )
  returning id into v_new_id;

  -- انسخ سطور القيد الأصلي مع عكس المدين/الدائن
  for v_line in select account_id, debit, credit from public.journal_lines where entry_id = p_entry_id loop
    insert into public.journal_lines(school_id, entry_id, account_id, debit, credit)
    values(v_school, v_new_id, v_line.account_id, v_line.credit, v_line.debit); -- معكوس
  end loop;

  -- وسم القيد الأصلي بأنه عُكِس (التحديث الوحيد المسموح — عبر علم الجلسة)
  perform set_config('rusoom.allow_journal_flag', 'on', true);
  update public.journal_entries set reversed_by_entry = v_new_id where id = p_entry_id;
  perform set_config('rusoom.allow_journal_flag', 'off', true);

  insert into public.audit_log(school_id, actor_id, action, details)
  values(v_school, auth.uid(), 'عكس قيد محاسبي', 'القيد ' || p_entry_id::text || ' — السبب: ' || p_reason);

  return v_new_id;
end; $$;

grant execute on function public.reverse_journal_entry(uuid, text) to authenticated;
