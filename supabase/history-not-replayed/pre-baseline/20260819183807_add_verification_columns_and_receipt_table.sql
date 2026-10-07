
alter table public.school_registrations
  add column if not exists verification_status text
    check (verification_status in ('approved', 'suspicious', 'rejected')),
  add column if not exists verification_reason text;

create table if not exists public.receipt_verifications (
  id                      uuid primary key default gen_random_uuid(),
  school_registration_id  uuid references public.school_registrations(id) on delete cascade,
  reference_number        text unique,
  amount_extracted        numeric,
  recipient_extracted     text,
  date_extracted          date,
  verification_status     text check (verification_status in ('approved', 'suspicious', 'rejected')),
  verification_reason     text,
  created_at              timestamptz not null default now()
);

alter table public.receipt_verifications enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'receipt_verifications'
      and policyname = 'service role only'
  ) then
    execute $pol$
      create policy "service role only"
        on public.receipt_verifications
        using (false)
    $pol$;
  end if;
end $$;
