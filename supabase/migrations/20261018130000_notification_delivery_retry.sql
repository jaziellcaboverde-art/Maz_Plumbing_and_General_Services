-- Phase 3.6: durable channel delivery log, idempotent in-app delivery and retry claims.

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  event text not null,
  channel text not null check (channel in ('in_app', 'email')),
  title text not null,
  body text,
  link text,
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed')),
  attempts integer not null default 0 check (attempts between 0 and 3),
  next_attempt_at timestamptz not null default now(),
  processing_started_at timestamptz,
  last_error text,
  admin_alerted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.notification_deliveries enable row level security;
revoke all on public.notification_deliveries from anon, authenticated;
grant all on public.notification_deliveries to service_role;
create index notification_deliveries_due_idx
  on public.notification_deliveries (next_attempt_at, created_at)
  where status = 'pending';
create index notification_deliveries_failed_alert_idx
  on public.notification_deliveries (created_at)
  where status = 'failed' and admin_alerted_at is null;
create trigger notification_deliveries_set_updated_at before update on public.notification_deliveries
  for each row execute function public.set_updated_at();

alter table public.notifications
  add column delivery_id uuid references public.notification_deliveries (id) on delete set null,
  add column alert_for_delivery_id uuid references public.notification_deliveries (id) on delete set null;
create unique index notifications_delivery_id_unique on public.notifications (delivery_id);
create unique index notifications_delivery_alert_unique on public.notifications (alert_for_delivery_id, profile_id);

-- Claims due rows atomically so concurrent worker calls do not send the same attempt.
create function public.claim_notification_deliveries(p_limit integer default 50, p_ids uuid[] default null)
returns setof public.notification_deliveries
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- A worker that stopped mid-send leaves a lease. Reclaim it after five minutes.
  update public.notification_deliveries d
  set status = case when d.attempts >= 3 then 'failed' else 'pending' end,
      next_attempt_at = case when d.attempts >= 3 then d.next_attempt_at else now() end,
      processing_started_at = null,
      last_error = coalesce(d.last_error, 'Delivery worker stopped before completing this attempt')
  where d.status = 'processing'
    and d.processing_started_at < now() - interval '5 minutes';

  return query
  with candidates as (
    select d.id
    from public.notification_deliveries d
    where d.status = 'pending'
      and d.next_attempt_at <= now()
      and d.attempts < 3
      and (p_ids is null or d.id = any(p_ids))
    order by d.next_attempt_at, d.created_at
    for update skip locked
    limit least(greatest(coalesce(p_limit, 50), 1), 100)
  )
  update public.notification_deliveries d
  set status = 'processing', attempts = d.attempts + 1, processing_started_at = now()
  from candidates c
  where d.id = c.id
  returning d.*;
end;
$$;
revoke all on function public.claim_notification_deliveries(integer, uuid[]) from public, anon, authenticated;
grant execute on function public.claim_notification_deliveries(integer, uuid[]) to service_role;
