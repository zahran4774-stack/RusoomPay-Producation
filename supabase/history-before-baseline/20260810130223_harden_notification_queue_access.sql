-- 1) Revoke direct write access from `authenticated` on notification_queue.
--    All writes must go through enqueue_notification() (SECURITY DEFINER, validated below)
--    or the service-role client (used by the fee-reminders cron), which bypasses grants/RLS entirely.
revoke insert, update, delete on public.notification_queue from authenticated;

-- 2) Replace the overly broad ALL policy with a read-only policy restricted to
--    school staff roles (owner/admin/accountant/platform_admin), not parents/students.
--    Staff can see queued/sent notification metadata for their own school only.
drop policy if exists notification_queue_school_rw on public.notification_queue;

create policy notification_queue_staff_select
on public.notification_queue
for select
to authenticated
using (
  school_id = (select school_id from public.profiles where id = auth.uid())
  and (select role from public.profiles where id = auth.uid()) in ('owner','admin','accountant','platform_admin')
);

-- 3) Harden enqueue_notification(): validate that p_recipient actually belongs to
--    a parent/student/staff contact within the caller's own school before queuing.
--    Without this, any authenticated user could still queue a message to an arbitrary
--    phone number for their own school_id via the RPC.
create or replace function public.enqueue_notification(
  p_channel text,
  p_recipient text,
  p_payload jsonb,
  p_dedupe_key text default null,
  p_max_attempts integer default 5
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_id uuid;
  v_school uuid;
  v_recipient_ok boolean;
begin
  v_school := public.my_school_id();

  if v_school is null then
    raise exception 'no school context for caller';
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
$function$;