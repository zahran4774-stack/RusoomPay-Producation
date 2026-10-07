
-- P0-5: enqueue_notification already validates recipient+school, but has NO role
-- check — any authenticated user (parent included) could call it to send arbitrary
-- content to any known contact of their school. Restrict to staff roles that
-- legitimately trigger notifications (fee reminders, admin comms).
create or replace function public.enqueue_notification(
  p_channel text, p_recipient text, p_payload jsonb,
  p_dedupe_key text default null, p_max_attempts int default 5
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_school uuid;
  v_role text;
  v_recipient_ok boolean;
begin
  select school_id, role into v_school, v_role
  from public.profiles where id = auth.uid();

  if v_school is null then
    raise exception 'no school context for caller';
  end if;

  -- P0-5 fix: only staff roles may enqueue notifications; parents/guardians
  -- must never be able to send arbitrary messages through the school's account.
  if v_role not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح: إرسال الإشعارات للطاقم الإداري فقط';
  end if;

  -- recipient must be a known contact phone within the caller's own school:
  -- either a staff/parent profile phone, or a guardian phone on a student in this school.
  select exists (
    select 1 from public.profiles pr
    where pr.school_id = v_school and pr.phone = p_recipient
    union
    select 1 from public.students s
    where s.school_id = v_school and s.guardian_phone = p_recipient
  ) into v_recipient_ok;

  if not v_recipient_ok then
    raise exception 'recipient % is not a known contact of this school', p_recipient;
  end if;

  insert into public.notification_queue(school_id, channel, recipient, payload, dedupe_key, max_attempts)
  values (v_school, p_channel, p_recipient, p_payload, p_dedupe_key, coalesce(p_max_attempts,5))
  on conflict (school_id, dedupe_key) where dedupe_key is not null do nothing
  returning id into v_id;

  return v_id;
end;
$$;
