create table public.provider_completions (
  booking_id uuid primary key references public.bookings (id) on delete restrict,
  provider_id uuid not null references public.profiles (id) on delete restrict,
  notes text not null check (length(btrim(notes)) >= 10),
  photo_paths text[] not null check (cardinality(photo_paths) between 1 and 10),
  submitted_at timestamptz not null default now()
);

alter table public.provider_completions enable row level security;
grant select on public.provider_completions to authenticated;
create policy "provider completions: assigned provider or admin reads"
  on public.provider_completions for select to authenticated
  using (provider_id = (select auth.uid()) or (select public.is_admin()));

create trigger provider_completions_no_change before update or delete
  on public.provider_completions for each row execute function public.block_row_change();

create or replace function public.submit_provider_completion(
  p_booking_id uuid, p_notes text, p_photo_paths text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_booking public.bookings%rowtype;
  v_path text;
begin
  if v_uid is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  select * into v_booking from public.bookings
    where id = p_booking_id and provider_id = v_uid for update;
  if not found then raise exception 'You cannot complete this booking' using errcode = '42501'; end if;
  if v_booking.status <> 'in_progress' then
    raise exception 'The job must be in progress before it can be completed';
  end if;
  if length(btrim(coalesce(p_notes, ''))) < 10 then
    raise exception 'Add completion notes of at least 10 characters';
  end if;
  if p_photo_paths is null or cardinality(p_photo_paths) not between 1 and 10 then
    raise exception 'Add 1 to 10 completion photos';
  end if;
  foreach v_path in array p_photo_paths loop
    if v_path is null or left(v_path, 37) <> p_booking_id::text || '/' then
      raise exception 'A completion photo does not belong to this booking';
    end if;
  end loop;
  insert into public.provider_completions(booking_id, provider_id, notes, photo_paths)
  values (p_booking_id, v_uid, left(btrim(p_notes), 2000), p_photo_paths);
  perform public.change_booking_status(p_booking_id, 'done', 'Provider submitted completion');
  perform public.write_audit(v_uid, 'provider.completion_submitted', 'bookings', p_booking_id::text, null,
    jsonb_build_object('photos', cardinality(p_photo_paths)));
  return jsonb_build_object('booking_id', p_booking_id, 'notify', jsonb_build_array(
    jsonb_build_object('profile_id', v_booking.customer_id, 'event', 'job.completed',
      'title', 'Your provider marked the job done', 'body', 'Review the completion and next steps in your booking.',
      'link', '/customer/bookings/' || p_booking_id, 'channels', jsonb_build_array('in_app', 'email'))));
end;
$$;
revoke all on function public.submit_provider_completion(uuid, text, text[]) from public, anon;
grant execute on function public.submit_provider_completion(uuid, text, text[]) to authenticated;
