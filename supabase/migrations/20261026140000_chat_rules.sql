-- Phase 8 finishing rules.
-- 8.1 Nobody can send a message until a provider is on the booking, or after it is cancelled.
drop policy if exists "messages: send as booking party" on public.messages;
create policy "messages: send as booking party" on public.messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and exists (
      select 1 from public.bookings b
      where b.id = booking_id
        and b.provider_id is not null
        and b.status <> 'cancelled'
        and (b.customer_id = (select auth.uid()) or b.provider_id = (select auth.uid()))
    )
  );

-- 8.7 The Privacy Notice says admin can read threads. A new version on top of the latest one.
insert into public.legal_versions (doc_type, version, body, published_at)
select 'privacy', '1.1',
  v.body || E'\nMessages and photos between a customer and a provider are kept inside MAZ for the booking. MAZ admin staff can read them to keep people safe and to settle disputes. Phone numbers are not shown between customers and providers; use the chat.',
  now()
from (select body from public.legal_versions where doc_type = 'privacy' and published_at is not null order by published_at desc limit 1) v
on conflict (doc_type, version) do nothing;
