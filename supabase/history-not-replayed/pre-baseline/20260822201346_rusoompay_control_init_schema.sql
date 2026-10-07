-- RusoomPay Control: isolated schema, kept fully separate from `public` (RusoomPay production data)
create schema if not exists rusoompay_control;

create extension if not exists "pgcrypto" schema extensions;

create type rusoompay_control.org_role as enum ('owner','admin','finance','viewer');
create type rusoompay_control.subscription_status as enum ('trial','active','past_due','payment_failed','suspended','cancelled','expired');
create type rusoompay_control.cost_type as enum ('fixed','variable');
create type rusoompay_control.billing_frequency as enum ('monthly','annual','quarterly','custom');

create table rusoompay_control.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  base_currency text not null default 'OMR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table rusoompay_control.org_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references rusoompay_control.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role rusoompay_control.org_role not null default 'viewer',
  created_at timestamptz not null default now(),
  unique(organization_id, user_id)
);

create table rusoompay_control.vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  website text,
  logo_url text,
  default_category text,
  created_at timestamptz not null default now()
);

create table rusoompay_control.subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references rusoompay_control.organizations(id) on delete cascade,
  vendor_id uuid not null references rusoompay_control.vendors(id),
  status rusoompay_control.subscription_status not null default 'active',
  cost_type rusoompay_control.cost_type not null default 'fixed',
  billing_frequency rusoompay_control.billing_frequency not null default 'monthly',
  amount numeric(14,4) not null,
  currency text not null,
  amount_in_base_currency numeric(14,4) not null,
  next_payment_date date,
  last_payment_date date,
  source text not null default 'manual',
  is_unused boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at timestamptz
);

create index idx_subscriptions_org_status on rusoompay_control.subscriptions(organization_id, status);
create index idx_subscriptions_org_next_payment on rusoompay_control.subscriptions(organization_id, next_payment_date);

-- Row Level Security: every tenant table scoped to organizations the calling user belongs to
alter table rusoompay_control.organizations enable row level security;
alter table rusoompay_control.org_members enable row level security;
alter table rusoompay_control.vendors enable row level security;
alter table rusoompay_control.subscriptions enable row level security;

create policy "members can read their orgs"
  on rusoompay_control.organizations for select
  using (id in (select organization_id from rusoompay_control.org_members where user_id = auth.uid()));

create policy "owners/admins can update their orgs"
  on rusoompay_control.organizations for update
  using (id in (select organization_id from rusoompay_control.org_members where user_id = auth.uid() and role in ('owner','admin')));

create policy "authenticated users can create an org"
  on rusoompay_control.organizations for insert
  with check (auth.uid() is not null);

create policy "members can read their own membership rows"
  on rusoompay_control.org_members for select
  using (organization_id in (select organization_id from rusoompay_control.org_members where user_id = auth.uid()));

create policy "owners/admins can manage membership"
  on rusoompay_control.org_members for all
  using (organization_id in (select organization_id from rusoompay_control.org_members where user_id = auth.uid() and role in ('owner','admin')));

create policy "vendors are readable by any authenticated user"
  on rusoompay_control.vendors for select
  using (auth.uid() is not null);

create policy "members can read their org subscriptions"
  on rusoompay_control.subscriptions for select
  using (organization_id in (select organization_id from rusoompay_control.org_members where user_id = auth.uid()));

create policy "admin/finance/owner can write subscriptions"
  on rusoompay_control.subscriptions for all
  using (organization_id in (select organization_id from rusoompay_control.org_members where user_id = auth.uid() and role in ('owner','admin','finance')));
