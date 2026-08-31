-- ============================================================================
-- P0 Hardening (Part 1) — Notification queue role check + pending_payments
-- column/RLS lockdown.
--
-- This migration documents changes already applied directly to production
-- during a P0 security review. It is written to be safe on a fresh database
-- (functions/policies use CREATE OR REPLACE / DROP-then-CREATE) and a no-op
-- where nothing matches on an existing, already-patched database.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- P0-5: enqueue_notification previously validated recipient + school but had
-- NO role check — any authenticated user (including a parent) could call it
-- directly via RPC to send arbitrary content to any known contact of their
-- school, impersonating the school. Restrict to staff roles.
-- ----------------------------------------------------------------------------
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

  if v_role not in ('owner','admin','accountant') then
    raise exception 'غير مصرّح: إرسال الإشعارات للطاقم الإداري فقط';
  end if;

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

-- ----------------------------------------------------------------------------
-- P0-2: pending_payments_guardian_update allowed a guardian to UPDATE *any*
-- column on their own row (status, amount, method, bank_ref, txn_state...) as
-- long as the row was 'pending'. The only real caller
-- (app/api/thawani/create-session/route.ts) only ever sets
-- status='rejected' + failure_reason when session creation fails.
--
-- Fix: (1) column-level grant restricts authenticated to status/failure_reason/
-- state_updated_at only; (2) RLS WITH CHECK restricts the only settable status
-- value to 'rejected'.
-- ----------------------------------------------------------------------------
do $$ begin
  if exists (
    select 1 from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'pending_payments'
      and grantee = 'authenticated' and privilege_type = 'UPDATE'
  ) then
    execute 'revoke update on public.pending_payments from authenticated';
  end if;
end $$;

grant update (status, failure_reason, state_updated_at) on public.pending_payments to authenticated;

drop policy if exists pending_payments_guardian_update on public.pending_payments;
create policy pending_payments_guardian_update on public.pending_payments
  for update
  using (guardian_id = auth.uid() and status = 'pending')
  with check (guardian_id = auth.uid() and status = 'rejected');
