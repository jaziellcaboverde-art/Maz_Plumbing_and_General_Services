-- Steps 2.5 and 2.9 (status list): enums and core tables.
-- PostGIS types live in the "extensions" schema, so write them as extensions.geography.
-- Point order is longitude first, then latitude.

-- Enums ----------------------------------------------------------------------------------
create type public.user_role as enum ('customer', 'provider', 'admin');
create type public.account_type as enum ('household', 'business');
create type public.provider_status as enum ('pending', 'approved', 'rejected', 'suspended');
create type public.payout_method as enum ('gcash', 'bank', 'cash');
create type public.job_class as enum ('minor', 'major');
create type public.payment_tier as enum ('minor', 'standard', 'large');
create type public.booking_status as enum (
  'draft', 'open', 'offered', 'accepted', 'quoted', 'deposit_paid', 'scheduled',
  'on_the_way', 'in_progress', 'done', 'signed', 'balance_paid', 'completed', 'cancelled'
);
create type public.offer_status as enum ('pending', 'accepted', 'declined', 'expired', 'cancelled');
create type public.quote_status as enum ('proposed', 'approved', 'accepted', 'declined', 'superseded');
create type public.milestone_status as enum ('pending', 'submitted', 'confirmed');
create type public.payment_kind as enum ('deposit', 'milestone', 'balance');
create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded', 'partially_refunded');
create type public.payment_method as enum ('card', 'gcash', 'maya', 'grabpay', 'qrph', 'cash');
create type public.payout_status as enum ('pending', 'paid', 'failed', 'on_hold');

-- Shared trigger: keep updated_at current ------------------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- People ---------------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'customer',
  first_name text,
  last_name text,
  birthday date,
  mobile text,
  account_type public.account_type not null default 'household',
  business_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  label text,
  line1 text not null,
  barangay text,
  city text not null,
  province text,
  landmark text,
  location extensions.geography(Point, 4326),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index addresses_profile_id_idx on public.addresses (profile_id);
create index addresses_location_idx on public.addresses using gist (location);
create trigger addresses_set_updated_at before update on public.addresses
  for each row execute function public.set_updated_at();

create table public.provider_profiles (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  status public.provider_status not null default 'pending',
  daily_rate numeric(12, 2) check (daily_rate is null or daily_rate >= 0),
  payout_method public.payout_method,
  payout_account_name text,
  payout_account_number text,
  emergency_contact_name text,
  emergency_contact_phone text,
  base_location extensions.geography(Point, 4326),
  rejection_reason text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index provider_profiles_status_idx on public.provider_profiles (status);
create index provider_profiles_base_location_idx on public.provider_profiles using gist (base_location);
create trigger provider_profiles_set_updated_at before update on public.provider_profiles
  for each row execute function public.set_updated_at();

create table public.provider_documents (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('government_id', 'selfie', 'nbi_clearance')),
  storage_path text not null,
  -- Q20 (how long files are kept) is still open. Leave empty until it is answered.
  delete_after date,
  created_at timestamptz not null default now()
);
create index provider_documents_provider_id_idx on public.provider_documents (provider_id);

-- Catalog and settings -------------------------------------------------------------------
create table public.services (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  name text not null,
  default_class public.job_class not null default 'minor',
  urgent_allowed boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (category, name)
);

create table public.provider_services (
  provider_id uuid not null references public.profiles (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete cascade,
  primary key (provider_id, service_id)
);

create table public.user_settings (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  font_size text not null default 'medium' check (font_size in ('small', 'medium', 'large', 'extra-large')),
  -- Phase 3 step 3.7 decides the keys. Empty until then.
  notification_prefs jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create trigger user_settings_set_updated_at before update on public.user_settings
  for each row execute function public.set_updated_at();

create table public.config (
  key text primary key,
  value jsonb not null,
  description text,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);
