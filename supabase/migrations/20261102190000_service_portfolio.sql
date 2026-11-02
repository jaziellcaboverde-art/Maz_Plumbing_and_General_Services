-- Admin-curated examples of completed work. Only photos uploaded by an administrator
-- are published. The photo bucket is public; never upload private booking attachments.
create table public.service_portfolio (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id) on delete cascade,
  image_path text not null unique,
  caption text not null default '' check (char_length(caption) <= 180),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now()
);
create index service_portfolio_service_order_idx on public.service_portfolio(service_id,sort_order,created_at);
alter table public.service_portfolio enable row level security;
grant select on public.service_portfolio to anon, authenticated;
create policy "Public may see portfolio of active services" on public.service_portfolio
  for select to anon, authenticated using (
    exists (select 1 from public.services s where s.id = service_id and s.active)
  );
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('service-portfolio','service-portfolio',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- Reviews are submitted by customers through the existing submit_review RPC.
-- This public projection omits identities and never exposes hidden/uncompleted reviews.
create or replace function public.public_service_reviews(p_service_id uuid)
returns table (stars integer, comment text, created_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select r.stars, left(r.comment, 700), r.created_at
  from public.reviews r
  join public.bookings b on b.id = r.booking_id
  join public.services s on s.id = b.service_id
  where b.service_id = p_service_id and s.active = true
    and r.hidden = false
    and b.status::text in ('done','signed','balance_paid','completed')
  order by r.created_at desc limit 12;
$$;
revoke all on function public.public_service_reviews(uuid) from public;
grant execute on function public.public_service_reviews(uuid) to anon, authenticated;
