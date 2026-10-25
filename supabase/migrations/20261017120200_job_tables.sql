-- Step 2.6: job tables. Money amounts are numeric(12,2), in pesos.

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete restrict,
  service_id uuid references public.services (id) on delete restrict,
  address_id uuid references public.addresses (id) on delete set null,
  status public.booking_status not null default 'draft',
  description text,
  preferred_start timestamptz,
  is_urgent boolean not null default false,
  is_major_renovation boolean not null default false,
  job_class public.job_class,
  payment_tier public.payment_tier,
  -- The provider the customer picked (normal jobs). Set by the pick function in Phase 7.
  picked_provider_id uuid references public.profiles (id) on delete set null,
  -- The provider who accepted. For large jobs this is the foreman.
  provider_id uuid references public.profiles (id) on delete set null,
  quote_total numeric(12, 2) check (quote_total is null or quote_total >= 0),
  deposit_amount numeric(12, 2) check (deposit_amount is null or deposit_amount >= 0),
  -- Declined or timed out offers so far. The limit is in config (offer.max_misses).
  miss_count integer not null default 0 check (miss_count >= 0),
  terms_accepted_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index bookings_customer_id_idx on public.bookings (customer_id);
create index bookings_provider_id_idx on public.bookings (provider_id);
create index bookings_picked_provider_id_idx on public.bookings (picked_provider_id);
create index bookings_status_idx on public.bookings (status);
create trigger bookings_set_updated_at before update on public.bookings
  for each row execute function public.set_updated_at();

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  provider_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('customer_pick', 'auto_chain', 'foreman', 'admin_assign')),
  status public.offer_status not null default 'pending',
  expires_at timestamptz not null,
  responded_at timestamptz,
  decline_reason text,
  created_at timestamptz not null default now()
);
create index offers_booking_id_idx on public.offers (booking_id);
create index offers_provider_id_idx on public.offers (provider_id);
-- One open offer per booking at a time.
create unique index offers_one_pending_per_booking on public.offers (booking_id) where status = 'pending';

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  proposed_by uuid not null references public.profiles (id) on delete restrict,
  amount numeric(12, 2) not null check (amount >= 0),
  job_class public.job_class not null,
  status public.quote_status not null default 'proposed',
  notes text,
  approved_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index quotes_booking_id_idx on public.quotes (booking_id);

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  position integer not null check (position > 0),
  title text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  status public.milestone_status not null default 'pending',
  submitted_at timestamptz,
  confirmed_at timestamptz,
  unique (booking_id, position)
);

create table public.work_days (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  provider_id uuid not null references public.profiles (id) on delete restrict,
  work_date date not null,
  arrived_at timestamptz,
  arrival_location extensions.geography(Point, 4326),
  arrival_distance_m numeric(10, 1),
  gps_accuracy_m numeric(10, 1),
  admin_override boolean not null default false,
  override_reason text,
  closed_at timestamptz,
  unique (booking_id, work_date),
  check (not admin_override or override_reason is not null)
);

create table public.materials (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  provider_id uuid not null references public.profiles (id) on delete restrict,
  amount numeric(12, 2) not null check (amount >= 0),
  receipt_path text,
  approved boolean not null default false,
  approved_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index materials_booking_id_idx on public.materials (booking_id);

create table public.punch_items (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  description text not null,
  done boolean not null default false,
  confirmed_by_customer boolean not null default false,
  created_at timestamptz not null default now()
);
create index punch_items_booking_id_idx on public.punch_items (booking_id);

-- A signature record cannot be changed after it is saved (decision-log.md #5).
create table public.signatures (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  signer_id uuid not null references public.profiles (id) on delete restrict,
  image_path text not null,
  signed_at timestamptz not null default now(),
  location extensions.geography(Point, 4326),
  device text,
  override_by uuid references public.profiles (id) on delete set null,
  override_reason text,
  check ((override_by is null) = (override_reason is null))
);
create index signatures_booking_id_idx on public.signatures (booking_id);

create function public.block_row_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Rows in % cannot be changed or deleted after they are saved', tg_table_name
    using errcode = '42501';
end;
$$;
-- A cascade delete from bookings also fires this trigger, so a booking that has a signature
-- cannot be deleted. That is intended.
create trigger signatures_no_change before update or delete on public.signatures
  for each row execute function public.block_row_change();
