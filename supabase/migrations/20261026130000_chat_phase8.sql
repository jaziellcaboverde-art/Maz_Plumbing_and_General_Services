-- Phase 8: chat photos (8.3), unread counts (8.4) and admin flags (8.6).
-- Threads themselves already exist: a booking has a chat as soon as a provider is assigned (8.1).

-- 8.3 Photos live in a private bucket. The first folder is the booking id, so the same
-- booking-party rule that guards the messages guards the photos. Admin can read, never upload.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('chat-photos', 'chat-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "chat photos: parties or admin read" on storage.objects;
create policy "chat photos: parties or admin read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'chat-photos'
    and ((select public.is_booking_party_text((storage.foldername(name))[1])) or (select public.is_admin()))
  );

drop policy if exists "chat photos: parties upload" on storage.objects;
create policy "chat photos: parties upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'chat-photos'
    and (select public.is_booking_party_text((storage.foldername(name))[1]))
  );

-- A message can only point at a photo inside its own booking's folder.
alter table public.messages
  drop constraint if exists messages_attachment_in_booking_folder;
alter table public.messages
  add constraint messages_attachment_in_booking_folder
  check (attachment_path is null or attachment_path like booking_id::text || '/%');

-- 8.4 Unread. One row per person and booking: when they last opened the thread.
create table if not exists public.message_reads (
  booking_id uuid not null references public.bookings (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (booking_id, profile_id)
);
alter table public.message_reads enable row level security;
grant select on public.message_reads to authenticated;
drop policy if exists "message_reads: read own" on public.message_reads;
create policy "message_reads: read own" on public.message_reads
  for select to authenticated
  using (profile_id = (select auth.uid()));

create or replace function public.mark_chat_read(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  if not (public.is_booking_customer(p_booking_id) or public.is_booking_provider(p_booking_id)) then
    raise exception 'You are not part of this chat' using errcode = '42501';
  end if;
  insert into public.message_reads (booking_id, profile_id, last_read_at)
  values (p_booking_id, auth.uid(), now())
  on conflict (booking_id, profile_id) do update set last_read_at = excluded.last_read_at;
end;
$$;
revoke all on function public.mark_chat_read(uuid) from public, anon;
grant execute on function public.mark_chat_read(uuid) to authenticated;

-- How many messages from the other person the signed-in customer or provider has not opened.
create or replace function public.chat_unread_counts()
returns table (booking_id uuid, unread bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select m.booking_id, count(*)::bigint
  from public.messages m
  join public.bookings b on b.id = m.booking_id
  left join public.message_reads r on r.booking_id = m.booking_id and r.profile_id = auth.uid()
  where auth.uid() is not null
    and (b.customer_id = auth.uid() or b.provider_id = auth.uid())
    and m.sender_id <> auth.uid()
    and m.created_at > coalesce(r.last_read_at, '-infinity'::timestamptz)
  group by m.booking_id
$$;
revoke all on function public.chat_unread_counts() from public, anon;
grant execute on function public.chat_unread_counts() to authenticated;

-- 8.6 Admin flags a message for follow up. Nobody else can change a message.
create or replace function public.flag_message(p_message_id uuid, p_flagged boolean, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Only an admin can flag a message' using errcode = '42501'; end if;
  update public.messages set flagged = p_flagged where id = p_message_id;
  if not found then raise exception 'Message not found' using errcode = 'P0002'; end if;
  perform public.write_audit(auth.uid(), case when p_flagged then 'message.flagged' else 'message.unflagged' end,
    'messages', p_message_id::text, null,
    jsonb_build_object('reason', nullif(btrim(left(p_reason, 300)), '')));
end;
$$;
revoke all on function public.flag_message(uuid, boolean, text) from public, anon;
grant execute on function public.flag_message(uuid, boolean, text) to authenticated;
