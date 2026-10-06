
revoke update on public.pending_payments from authenticated;
grant update (status, failure_reason, state_updated_at) on public.pending_payments to authenticated;
