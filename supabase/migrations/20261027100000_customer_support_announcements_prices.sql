-- Customer support, announcements and catalog starting prices.

alter table public.services
  add column starting_price_php numeric(12, 2) check (starting_price_php is null or starting_price_php >= 0),
  add column price_note text check (price_note is null or char_length(price_note) <= 300);

alter table public.notifications
  add column category text not null default 'booking'
    check (category in ('booking', 'account', 'announcement')),
  add column dismissed_at timestamptz,
  add column requires_ack boolean not null default false,
  add column acknowledged_at timestamptz,
  add constraint notifications_critical_ack_before_dismiss
    check (not requires_ack or acknowledged_at is not null or dismissed_at is null);
alter table public.notification_deliveries
  add column category text not null default 'booking'
    check (category in ('booking', 'account', 'announcement'));

create table public.support_threads (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null unique references public.profiles (id) on delete cascade,
  context text check (context is null or char_length(context) <= 250),
  context_booking_id uuid references public.bookings (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger support_threads_set_updated_at before update on public.support_threads
  for each row execute function public.set_updated_at();

create function public.touch_support_thread_from_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.support_threads set updated_at = now() where id = new.support_thread_id;
  return new;
end;
$$;

alter table public.support_threads enable row level security;
grant select, insert on public.support_threads to authenticated;
create policy "support_threads: customer opens own, admin reads"
  on public.support_threads for select to authenticated
  using (customer_id = (select auth.uid()) or (select public.is_admin()));
create policy "support_threads: customer creates own"
  on public.support_threads for insert to authenticated
  with check (customer_id = (select auth.uid()) and (select public.current_user_role()) = 'customer');

alter table public.messages alter column booking_id drop not null;
alter table public.messages
  add column support_thread_id uuid references public.support_threads (id) on delete cascade,
  add constraint messages_exactly_one_thread
    check ((booking_id is not null) <> (support_thread_id is not null));
create trigger messages_touch_support_thread
  after insert on public.messages
  for each row when (new.support_thread_id is not null)
  execute function public.touch_support_thread_from_message();
alter table public.messages
  drop constraint if exists messages_attachment_in_booking_folder;
alter table public.messages
  add constraint messages_attachment_in_thread_folder
  check (
    attachment_path is null
    or (booking_id is not null and attachment_path like booking_id::text || '/%')
    or (support_thread_id is not null and attachment_path like support_thread_id::text || '/%')
  );
create index messages_support_thread_created_at_idx
  on public.messages (support_thread_id, created_at) where support_thread_id is not null;

drop policy if exists "messages: read as party or admin" on public.messages;
create policy "messages: read as party or admin" on public.messages for select to authenticated
  using (
    (booking_id is not null and (
      (select public.is_booking_customer(booking_id))
      or (select public.is_booking_provider(booking_id))
    ))
    or (support_thread_id is not null and exists (
      select 1 from public.support_threads st
      where st.id = messages.support_thread_id
        and (st.customer_id = (select auth.uid()) or (select public.is_admin()))
    ))
    or (select public.is_admin())
  );

drop policy if exists "messages: send as booking party" on public.messages;
create policy "messages: send as booking party or support party" on public.messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and (
      (
        booking_id is not null
        and exists (
          select 1 from public.bookings b
          where b.id = booking_id
            and b.provider_id is not null
            and b.status <> 'cancelled'
            and (b.customer_id = (select auth.uid()) or b.provider_id = (select auth.uid()))
        )
      )
      or (
        support_thread_id is not null
        and exists (
          select 1 from public.support_threads st
          where st.id = messages.support_thread_id
            and (
              st.customer_id = (select auth.uid())
              or (select public.is_admin())
            )
        )
      )
    )
  );

create table public.support_message_reads (
  support_thread_id uuid not null references public.support_threads (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (support_thread_id, profile_id)
);
alter table public.support_message_reads enable row level security;
grant select on public.support_message_reads to authenticated;
create policy "support_message_reads: read own"
  on public.support_message_reads for select to authenticated
  using (profile_id = (select auth.uid()));

create or replace function public.mark_support_chat_read(p_support_thread_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  if not exists (
    select 1 from public.support_threads st
    where st.id = p_support_thread_id
      and (st.customer_id = auth.uid() or public.is_admin())
  ) then raise exception 'You are not part of this support chat' using errcode = '42501'; end if;
  insert into public.support_message_reads (support_thread_id, profile_id, last_read_at)
  values (p_support_thread_id, auth.uid(), now())
  on conflict (support_thread_id, profile_id)
  do update set last_read_at = excluded.last_read_at;
end;
$$;
revoke all on function public.mark_support_chat_read(uuid) from public, anon;
grant execute on function public.mark_support_chat_read(uuid) to authenticated;

create or replace function public.is_support_thread_party_text(p_thread text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_thread ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then exists (
        select 1 from public.support_threads st
        where st.id = p_thread::uuid
          and (st.customer_id = auth.uid() or public.is_admin())
      )
    else false
  end
$$;

drop policy if exists "chat photos: parties or admin read" on storage.objects;
create policy "chat photos: parties or admin read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'chat-photos'
    and (
      (select public.is_booking_party_text((storage.foldername(name))[1]))
      or (select public.is_support_thread_party_text((storage.foldername(name))[1]))
      or (select public.is_admin())
    )
  );
drop policy if exists "chat photos: parties upload" on storage.objects;
create policy "chat photos: parties upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'chat-photos'
    and (
      (select public.is_booking_party_text((storage.foldername(name))[1]))
      or (
        (select public.current_user_role()) = 'customer'
        and (select public.is_support_thread_party_text((storage.foldername(name))[1]))
      )
    )
  );

grant update (read_at, dismissed_at, acknowledged_at) on public.notifications to authenticated;
drop policy if exists "notifications: mark own read" on public.notifications;
create policy "notifications: mark own read" on public.notifications for update to authenticated
  using (profile_id = (select auth.uid()))
  with check (
    profile_id = (select auth.uid())
    and (not requires_ack or acknowledged_at is not null or dismissed_at is null)
  );
