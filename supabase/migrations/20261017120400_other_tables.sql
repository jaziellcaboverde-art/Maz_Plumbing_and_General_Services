-- Step 2.8: chat, reviews, notifications, legal documents, consents and the audit log.

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete restrict,
  body text,
  attachment_path text,
  flagged boolean not null default false,
  created_at timestamptz not null default now(),
  check (body is not null or attachment_path is not null)
);
create index messages_booking_id_created_at_idx on public.messages (booking_id, created_at);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings (id) on delete cascade,
  customer_id uuid not null references public.profiles (id) on delete restrict,
  provider_id uuid not null references public.profiles (id) on delete restrict,
  stars integer not null check (stars between 1 and 5),
  comment text,
  hidden boolean not null default false,
  hidden_reason text,
  hidden_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (not hidden or hidden_reason is not null)
);
create index reviews_provider_id_idx on public.reviews (provider_id);

-- Phase 3 step 3.2 defines the events and channels. Basic shape only.
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  event text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_profile_id_idx on public.notifications (profile_id, created_at desc);

create table public.legal_versions (
  id uuid primary key default gen_random_uuid(),
  doc_type text not null check (doc_type in ('terms', 'privacy', 'unpaid_balance', 'cancellation')),
  version text not null,
  body text not null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (doc_type, version)
);

create table public.consents (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  legal_version_id uuid not null references public.legal_versions (id) on delete restrict,
  accepted_at timestamptz not null default now(),
  device text
);
create index consents_profile_id_idx on public.consents (profile_id);

-- No foreign key on actor_id on purpose: audit rows must never change, and a foreign key with
-- "on delete set null" would try to change them.
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  target_table text,
  target_id text,
  reason text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_created_at_idx on public.audit_log (created_at desc);
create index audit_log_target_idx on public.audit_log (target_table, target_id);

create trigger audit_log_no_change before update or delete on public.audit_log
  for each row execute function public.block_row_change();
