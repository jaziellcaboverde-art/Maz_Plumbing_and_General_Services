-- Phase 8 foundation: allow only the customer and accepted provider to send booking messages.
-- Admins retain their existing read-only access through the Phase 2 policy.
grant insert on public.messages to authenticated;

create policy "messages: send as booking party" on public.messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and (
      (select public.is_booking_customer(booking_id))
      or (select public.is_booking_provider(booking_id))
    )
  );

alter table public.messages
  add constraint messages_body_max_length check (body is null or char_length(body) <= 4000);

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    execute 'create publication supabase_realtime';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    execute 'alter publication supabase_realtime add table public.messages';
  end if;
end
$$;
