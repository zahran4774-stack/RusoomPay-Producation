
drop policy if exists pending_payments_guardian_update on public.pending_payments;
create policy pending_payments_guardian_update on public.pending_payments
  for update
  using (guardian_id = auth.uid() and status = 'pending')
  with check (guardian_id = auth.uid() and status = 'rejected');
