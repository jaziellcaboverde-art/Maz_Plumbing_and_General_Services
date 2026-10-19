-- Step 2.7: money tables. Amounts are pesos, numeric(12,2).

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete restrict,
  milestone_id uuid references public.milestones (id) on delete set null,
  kind public.payment_kind not null,
  amount numeric(12, 2) not null check (amount > 0),
  status public.payment_status not null default 'pending',
  method public.payment_method,
  -- PayMongo ids. Unique so a repeated webhook cannot create a second row (Phase 9).
  paymongo_payment_intent_id text unique,
  paymongo_payment_id text unique,
  refunded_amount numeric(12, 2) not null default 0 check (refunded_amount >= 0),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (refunded_amount <= amount)
);
create index payments_booking_id_idx on public.payments (booking_id);
create trigger payments_set_updated_at before update on public.payments
  for each row execute function public.set_updated_at();

-- Cash is recorded by the owner or admin only. Providers never collect (Q6).
create table public.cash_records (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete restrict,
  amount numeric(12, 2) not null check (amount > 0),
  collected_on date not null,
  reference text not null,
  proof_path text not null,
  customer_signature_path text,
  recorded_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now()
);
create index cash_records_booking_id_idx on public.cash_records (booking_id);

create table public.cancellations (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete restrict,
  cancelled_by uuid references public.profiles (id) on delete set null,
  cancelled_by_role public.user_role not null,
  reason text,
  fee_basis text not null check (fee_basis in ('none', 'flat', 'assessed')),
  fee_amount numeric(12, 2) not null default 0 check (fee_amount >= 0),
  -- Inspection, materials, days worked and proof, for major jobs (Phase 10).
  breakdown jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index cancellations_booking_id_idx on public.cancellations (booking_id);

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.profiles (id) on delete restrict,
  booking_id uuid not null references public.bookings (id) on delete restrict,
  milestone_id uuid references public.milestones (id) on delete set null,
  amount numeric(12, 2) not null check (amount > 0),
  method public.payout_method not null,
  status public.payout_status not null default 'pending',
  reference text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payouts_provider_id_idx on public.payouts (provider_id);
create index payouts_booking_id_idx on public.payouts (booking_id);
create trigger payouts_set_updated_at before update on public.payouts
  for each row execute function public.set_updated_at();

create table public.payout_slips (
  id uuid primary key default gen_random_uuid(),
  payout_id uuid not null references public.payouts (id) on delete cascade,
  printed_at timestamptz,
  provider_signature_path text,
  signed_at timestamptz,
  marked_paid_by uuid references public.profiles (id) on delete set null
);
create index payout_slips_payout_id_idx on public.payout_slips (payout_id);

-- "PA" means payment acknowledgment. Q13 (BIR registered receipts) is still open.
create sequence public.receipt_number_seq;

create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  number text not null unique
    default ('PA-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.receipt_number_seq')::text, 6, '0')),
  booking_id uuid not null references public.bookings (id) on delete restrict,
  payment_id uuid references public.payments (id) on delete set null,
  cash_record_id uuid references public.cash_records (id) on delete set null,
  kind text not null check (kind in ('deposit', 'milestone', 'balance', 'cancellation_fee', 'refund')),
  amount numeric(12, 2) not null check (amount >= 0),
  pdf_path text,
  issued_at timestamptz not null default now()
);
create index receipts_booking_id_idx on public.receipts (booking_id);
