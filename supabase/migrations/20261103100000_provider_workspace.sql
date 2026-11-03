-- KumpuNinja v3.1: additive provider workspace; existing lead bookings remain intact.
create table public.provider_assignments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id),
  provider_id uuid not null references public.profiles(id),
  assigned_by uuid not null references public.profiles(id),
  trade text not null check (length(btrim(trade)) between 2 and 120),
  phase text not null default 'execution' check (phase in ('inspection','execution')),
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  travel_minutes integer not null default 30 check (travel_minutes between 0 and 240),
  required boolean not null default true,
  expires_at timestamptz not null,
  status text not null default 'offered' check (status in ('offered','accepted','declined','expired','withdrawal_requested','withdrawn','completed')),
  response_note text,
  responded_at timestamptz,
  created_at timestamptz not null default now()
);
create index provider_assignments_calendar on public.provider_assignments(provider_id, starts_at);
create unique index provider_assignments_active_role on public.provider_assignments(booking_id, provider_id, phase)
  where status in ('offered','accepted','withdrawal_requested');
alter table public.provider_assignments enable row level security;
grant select on public.provider_assignments to authenticated;
create policy "assignments: own or admin" on public.provider_assignments for select to authenticated
using (provider_id = auth.uid() or public.is_admin());

create table public.provider_weekly_hours (
  provider_id uuid not null references public.profiles(id),
  weekday integer not null check (weekday between 0 and 6),
  starts_at time not null,
  ends_at time not null check (ends_at > starts_at),
  primary key (provider_id, weekday)
);
alter table public.provider_weekly_hours enable row level security;
grant select on public.provider_weekly_hours to authenticated;
create policy "weekly hours: own or admin" on public.provider_weekly_hours for select to authenticated
using (provider_id = auth.uid() or public.is_admin());

create function public.is_active_provider() returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p join public.provider_profiles pp on pp.profile_id = p.id
    where p.id = auth.uid() and p.role = 'provider' and pp.status = 'approved')
$$;
create or replace function public.is_booking_provider(p_booking uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_active_provider() and (
    exists (select 1 from public.bookings where id = p_booking and provider_id = auth.uid())
    or exists (select 1 from public.provider_assignments where booking_id = p_booking and provider_id = auth.uid()
      and status in ('accepted','withdrawal_requested','completed')))
$$;
create policy "bookings: accepted team reads" on public.bookings for select to authenticated
using (public.is_booking_provider(id));
create policy "addresses: accepted team reads" on public.addresses for select to authenticated
using (exists (select 1 from public.bookings b where b.address_id = addresses.id and public.is_booking_provider(b.id)));

-- All scheduling mutations below serialize on the provider, across separate bookings.
create function public.provider_slot_available(p_provider uuid, p_booking uuid, p_start timestamptz, p_end timestamptz, p_buffer integer default 30)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_start is not null and p_end > p_start
  and exists (select 1 from public.provider_profiles pp join public.profiles p on p.id = pp.profile_id
    where pp.profile_id = p_provider and pp.status = 'approved' and p.role = 'provider')
  and not exists (select 1 from public.provider_availability a where a.provider_id = p_provider and a.kind = 'unavailable'
    and tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(p_start, p_end, '[)'))
  and (not exists (select 1 from public.provider_weekly_hours where provider_id = p_provider)
    or not exists (
      select 1 from generate_series((p_start at time zone 'Asia/Manila')::date::timestamp,
        (p_end at time zone 'Asia/Manila')::date::timestamp,interval '1 day') as work_date(day)
      where not exists(select 1 from public.provider_weekly_hours h where h.provider_id=p_provider
        and h.weekday=extract(dow from work_date.day)
        and (work_date.day::date<>(p_start at time zone 'Asia/Manila')::date or (p_start at time zone 'Asia/Manila')::time>=h.starts_at)
        and (work_date.day::date<>(p_end at time zone 'Asia/Manila')::date or (p_end at time zone 'Asia/Manila')::time<=h.ends_at)))
    or exists (select 1 from public.provider_availability a where a.provider_id = p_provider and a.kind = 'available'
      and a.starts_at <= p_start and a.ends_at >= p_end))
  and not exists (select 1 from public.provider_assignments a where a.provider_id = p_provider and a.booking_id <> p_booking
    and (a.status in ('accepted','withdrawal_requested') or (a.status = 'offered' and a.expires_at > now()))
    and tstzrange(a.starts_at - make_interval(mins => a.travel_minutes), a.ends_at + make_interval(mins => a.travel_minutes), '[)')
      && tstzrange(p_start - make_interval(mins => p_buffer), p_end + make_interval(mins => p_buffer), '[)'))
  and not exists (select 1 from public.bookings b where b.provider_id = p_provider and b.id <> p_booking
    and b.status in ('accepted','quoted','deposit_paid','scheduled','on_the_way','in_progress')
    and coalesce(b.scheduled_start, b.preferred_start) is not null
    and tstzrange(coalesce(b.scheduled_start,b.preferred_start), coalesce(b.scheduled_start,b.preferred_start) + interval '1 hour', '[)')
      && tstzrange(p_start - make_interval(mins => p_buffer), p_end + make_interval(mins => p_buffer), '[)'))
  and not exists (select 1 from public.offers o join public.bookings b on b.id = o.booking_id
    where o.provider_id = p_provider and o.booking_id <> p_booking and o.status = 'pending' and o.expires_at > now()
      and tstzrange(coalesce(b.scheduled_start,b.preferred_start), coalesce(b.scheduled_start,b.preferred_start) + interval '1 hour', '[)')
        && tstzrange(p_start - make_interval(mins => p_buffer), p_end + make_interval(mins => p_buffer), '[)'))
$$;
revoke all on function public.provider_slot_available(uuid,uuid,timestamptz,timestamptz,integer) from public, anon, authenticated;

create function public.offer_provider_assignment(p_booking uuid, p_provider uuid, p_trade text, p_phase text,
  p_start timestamptz, p_end timestamptz, p_expires timestamptz, p_buffer integer default 30)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a public.provider_assignments%rowtype; b public.bookings%rowtype;
begin
  if not public.is_admin() then raise exception 'Only MAZ administrators assign providers' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_provider::text, 0));
  select * into b from public.bookings where id = p_booking for update;
  if not found or b.status in ('draft','cancelled','done','signed','balance_paid','completed') then raise exception 'This booking cannot receive an assignment'; end if;
  if p_expires is null or p_expires < now() + interval '24 hours' or p_expires > now() + interval '48 hours' then raise exception 'Set an offer expiry between 24 and 48 hours from now'; end if;
  if p_start is null or p_start <= p_expires or p_end is null or p_end <= p_start or p_end - p_start > interval '31 days' then raise exception 'Set a valid work period after the offer deadline'; end if;
  if not exists (select 1 from public.provider_services where provider_id = p_provider and service_id = b.service_id) then raise exception 'Provider is not qualified for this service'; end if;
  if not public.provider_slot_available(p_provider,p_booking,p_start,p_end,p_buffer) then raise exception 'Provider is unavailable or has a conflicting assignment'; end if;
  insert into public.provider_assignments(booking_id,provider_id,assigned_by,trade,phase,starts_at,ends_at,expires_at,travel_minutes)
    values(p_booking,p_provider,auth.uid(),btrim(p_trade),p_phase,p_start,p_end,p_expires,p_buffer) returning * into a;
  if b.preferred_start is distinct from p_start or p_phase='execution' then
    insert into public.provider_appointment_requests(booking_id,starts_at,ends_at,phase,requested_by)
      values(p_booking,p_start,p_end,p_phase,auth.uid()) on conflict(booking_id,starts_at,ends_at,phase) do nothing;
  end if;
  perform public.write_audit(auth.uid(),'assignment.offered','provider_assignments',a.id::text,null,to_jsonb(a));
  return jsonb_build_object('assignment',to_jsonb(a),'notify',jsonb_build_array(jsonb_build_object(
    'profile_id',p_provider,'event','offer.new','title','MAZ assignment offer','body','Review your role, schedule and deadline in Offers.',
    'link','/provider/offers','channels',jsonb_build_array('in_app','email')),jsonb_build_object(
    'profile_id',b.customer_id,'event','appointment.proposed','title','MAZ is arranging your service appointment',
    'body','Review any proposed inspection or execution work period in your booking. Your team is not yet confirmed.',
    'link','/customer/bookings/'||p_booking,'channels',jsonb_build_array('in_app'))));
end $$;
revoke all on function public.offer_provider_assignment(uuid,uuid,text,text,timestamptz,timestamptz,timestamptz,integer) from public,anon;
grant execute on function public.offer_provider_assignment(uuid,uuid,text,text,timestamptz,timestamptz,timestamptz,integer) to authenticated;

create function public.respond_provider_assignment(p_assignment uuid, p_accept boolean, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a public.provider_assignments%rowtype;
begin
  if not public.is_active_provider() then raise exception 'An active provider account is required' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
  select * into a from public.provider_assignments where id=p_assignment and provider_id=auth.uid() for update;
  if not found then raise exception 'Assignment not found' using errcode = 'P0002'; end if;
  if (a.status='accepted' and p_accept) or (a.status='declined' and not p_accept) then return jsonb_build_object('outcome',a.status); end if;
  if a.status <> 'offered' then raise exception 'This offer is no longer open'; end if;
  if a.expires_at <= now() then
    update public.provider_assignments set status='expired',responded_at=now() where id=a.id;
    return jsonb_build_object('outcome','expired');
  end if;
  if not exists(select 1 from public.bookings where id=a.booking_id and status not in ('cancelled','done','signed','balance_paid','completed')) then raise exception 'This booking is no longer active'; end if;
  if p_accept and not public.provider_slot_available(auth.uid(),a.booking_id,a.starts_at,a.ends_at,a.travel_minutes) then raise exception 'Your schedule has changed. Contact MAZ for a new offer'; end if;
  update public.provider_assignments set status=case when p_accept then 'accepted' else 'declined' end, responded_at=now(), response_note=left(btrim(p_reason),500) where id=a.id;
  perform public.write_audit(auth.uid(),'assignment.responded','provider_assignments',a.id::text,p_reason,jsonb_build_object('accepted',p_accept));
  return jsonb_build_object('outcome',case when p_accept then 'accepted' else 'declined' end);
end $$;
revoke all on function public.respond_provider_assignment(uuid,boolean,text) from public,anon;
grant execute on function public.respond_provider_assignment(uuid,boolean,text) to authenticated;

create function public.save_provider_weekly_hours(p_hours jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare h jsonb;
begin
  if not public.is_active_provider() then raise exception 'Active provider account required' using errcode='42501'; end if;
  if jsonb_typeof(p_hours) <> 'array' or jsonb_array_length(p_hours) > 7 then raise exception 'Supply up to seven working days'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
  delete from public.provider_weekly_hours where provider_id=auth.uid();
  for h in select * from jsonb_array_elements(p_hours) loop
    insert into public.provider_weekly_hours(provider_id,weekday,starts_at,ends_at)
      values(auth.uid(),(h->>'weekday')::integer,(h->>'start')::time,(h->>'end')::time);
  end loop;
  perform public.write_audit(auth.uid(),'provider.weekly_hours_saved','provider_weekly_hours',auth.uid()::text,null,p_hours);
end $$;
revoke all on function public.save_provider_weekly_hours(jsonb) from public,anon;
grant execute on function public.save_provider_weekly_hours(jsonb) to authenticated;

create table public.provider_work_updates (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id),
  provider_id uuid not null references public.profiles(id),
  milestone_id uuid references public.milestones(id),
  kind text not null check (kind in ('inspection','progress','milestone','change_request','issue','completion')),
  notes text not null check (length(btrim(notes)) between 10 and 4000),
  photo_paths text[] not null default '{}',
  review_status text not null default 'pending' check (review_status in ('pending','approved','changes_requested')),
  reviewed_by uuid references public.profiles(id),
  review_note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  idempotency_key uuid not null unique
);
alter table public.provider_work_updates enable row level security;
grant select on public.provider_work_updates to authenticated;
create policy "work updates: author or admin" on public.provider_work_updates for select to authenticated
using (provider_id=auth.uid() or public.is_admin());
create policy "work updates: customer reads approved project evidence" on public.provider_work_updates for select to authenticated
using(public.is_booking_customer(booking_id) and review_status='approved' and kind in ('inspection','progress','milestone','completion'));
create index provider_updates_booking on public.provider_work_updates(booking_id, created_at);
create unique index provider_one_pending_completion on public.provider_work_updates(booking_id,provider_id) where kind='completion' and review_status='pending';

create function public.submit_provider_work_update(p_booking uuid,p_kind text,p_notes text,p_photos text[],p_milestone uuid,p_key uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_path text; b public.bookings%rowtype;
begin
  if not public.is_booking_provider(p_booking) then raise exception 'Only an active assigned provider can submit work' using errcode='42501'; end if;
  select * into b from public.bookings where id=p_booking for update;
  select id into v_id from public.provider_work_updates where idempotency_key=p_key and provider_id=auth.uid();
  if found then return v_id; end if;
  if b.status in ('cancelled','done','signed','balance_paid','completed') then raise exception 'This booking is closed to work updates'; end if;
  if p_kind in ('progress','milestone','completion') and b.status <> 'in_progress' then raise exception 'Execution must be in progress before submitting this update'; end if;
  if p_milestone is not null and not exists(select 1 from public.milestones where id=p_milestone and booking_id=p_booking) then raise exception 'Milestone does not belong to this booking'; end if;
  if p_kind='milestone' and p_milestone is null then raise exception 'Choose a milestone'; end if;
  if p_kind in ('milestone','completion') and coalesce(cardinality(p_photos),0) < 1 then raise exception 'Completion and milestone submissions need photographic evidence'; end if;
  if coalesce(cardinality(p_photos),0)>10 then raise exception 'Add up to ten photos'; end if;
  foreach v_path in array coalesce(p_photos,'{}') loop
    if v_path is null or v_path not like p_booking::text || '/' || auth.uid()::text || '/%' or v_path like '%..%'
      or not exists(select 1 from storage.objects where bucket_id='proof-photos' and name=v_path and owner_id=auth.uid()::text)
    then raise exception 'Evidence must be your uploaded photo for this booking'; end if;
  end loop;
  insert into public.provider_work_updates(booking_id,provider_id,kind,notes,photo_paths,milestone_id,idempotency_key)
  values(p_booking,auth.uid(),p_kind,btrim(p_notes),coalesce(p_photos,'{}'),p_milestone,p_key) returning id into v_id;
  perform public.write_audit(auth.uid(),'provider.work_submitted','provider_work_updates',v_id::text,null,jsonb_build_object('kind',p_kind,'booking_id',p_booking));
  return v_id;
end $$;
revoke all on function public.submit_provider_work_update(uuid,text,text,text[],uuid,uuid) from public,anon;
grant execute on function public.submit_provider_work_update(uuid,text,text,text[],uuid,uuid) to authenticated;

create function public.review_provider_work_update(p_update uuid,p_approve boolean,p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare u public.provider_work_updates%rowtype;
begin
  if not public.is_admin() then raise exception 'Only MAZ approves work' using errcode='42501'; end if;
  select * into u from public.provider_work_updates where id=p_update for update;
  if not found then raise exception 'Submission not found' using errcode='P0002'; end if;
  if u.review_status <> 'pending' then raise exception 'Submission already reviewed'; end if;
  if not p_approve and length(btrim(coalesce(p_note,'')))<5 then raise exception 'Explain the corrections needed'; end if;
  update public.provider_work_updates set review_status=case when p_approve then 'approved' else 'changes_requested' end,
    reviewed_by=auth.uid(),reviewed_at=now(),review_note=left(btrim(p_note),2000) where id=u.id;
  if p_approve and u.kind='milestone' then update public.milestones set status='confirmed',confirmed_at=now() where id=u.milestone_id; end if;
  if p_approve and u.kind='completion' then
    update public.provider_assignments set status='completed' where booking_id=u.booking_id and provider_id=u.provider_id and status in ('accepted','withdrawal_requested');
  end if;
  if p_approve and u.kind='inspection' then
    update public.provider_assignments set status='completed' where booking_id=u.booking_id and provider_id=u.provider_id and phase='inspection' and status='accepted';
  end if;
  -- Parent completion is a separate explicit admin sign-off, after all workers and milestones.
  perform public.write_audit(auth.uid(),'provider.work_reviewed','provider_work_updates',u.id::text,p_note,jsonb_build_object('approved',p_approve));
end $$;
revoke all on function public.review_provider_work_update(uuid,boolean,text) from public,anon;
grant execute on function public.review_provider_work_update(uuid,boolean,text) to authenticated;

-- Optional worker feedback is separate from the existing company/legacy reviews.
create table public.provider_feedback (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id),
  provider_id uuid not null references public.profiles(id),
  customer_id uuid not null references public.profiles(id),
  stars integer not null check(stars between 1 and 5),
  comment text check(length(comment)<=2000),
  created_at timestamptz not null default now(),
  unique(booking_id,provider_id)
);
alter table public.provider_feedback enable row level security;
grant select on public.provider_feedback to authenticated;
create policy "feedback: private to relevant parties" on public.provider_feedback for select to authenticated
using (provider_id=auth.uid() or customer_id=auth.uid() or public.is_admin());
create function public.submit_private_provider_feedback(p_booking uuid,p_provider uuid,p_stars integer,p_comment text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not exists(select 1 from public.bookings b where b.id=p_booking and b.customer_id=auth.uid()
    and b.status in ('done','signed','balance_paid','completed')
    and (b.provider_id=p_provider or exists(select 1 from public.provider_assignments a where a.booking_id=b.id and a.provider_id=p_provider and a.status='completed')))
  then raise exception 'Feedback requires completed work by this assigned provider' using errcode='42501'; end if;
  insert into public.provider_feedback(booking_id,provider_id,customer_id,stars,comment)
    values(p_booking,p_provider,auth.uid(),p_stars,nullif(btrim(p_comment),'')) returning id into v_id;
  perform public.write_audit(auth.uid(),'provider.feedback_submitted','provider_feedback',v_id::text,null,jsonb_build_object('booking_id',p_booking));
  return v_id;
end $$;
revoke all on function public.submit_private_provider_feedback(uuid,uuid,integer,text) from public,anon;
grant execute on function public.submit_private_provider_feedback(uuid,uuid,integer,text) to authenticated;

-- Close legacy provider price/schedule mutations at the database boundary as well as the UI.
revoke execute on function public.propose_quote(uuid,numeric,public.job_class,text,jsonb) from authenticated;
revoke execute on function public.confirm_schedule(uuid,timestamptz) from authenticated;
revoke execute on function public.submit_provider_completion(uuid,text,text[]) from authenticated;
update public.booking_status_moves set actors=array['admin','system'] where from_status='in_progress' and to_status='done';
update public.booking_status_moves set actors=array_remove(actors,'provider') where to_status in ('cancelled','quoted','scheduled');
update public.config set value='0'::jsonb where key='matching.customer_pick';
update public.config set value='2880'::jsonb where key in ('offer.window_minutes.normal','offer.window_minutes.urgent');

-- Preserve existing offer functions, adding serialized acceptance checks and idempotency.
alter function public.respond_to_offer(uuid,boolean,text) rename to respond_to_offer_legacy;
revoke all on function public.respond_to_offer_legacy(uuid,boolean,text) from public,anon,authenticated;
create function public.respond_to_offer(p_offer_id uuid,p_accept boolean,p_reason text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare o public.offers%rowtype; b public.bookings%rowtype;
begin
  if not public.is_active_provider() then raise exception 'Active provider account required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
  select * into o from public.offers where id=p_offer_id and provider_id=auth.uid() for update;
  if not found then raise exception 'Offer not found' using errcode='P0002'; end if;
  if (o.status='accepted' and p_accept) or (o.status='declined' and not p_accept) then return jsonb_build_object('outcome',o.status,'next','none','booking_id',o.booking_id); end if;
  select * into b from public.bookings where id=o.booking_id;
  if p_accept and o.expires_at>now() then
    if coalesce(b.scheduled_start,b.preferred_start) is null then raise exception 'Ask MAZ to specify the appointment before accepting'; end if;
    if not public.provider_slot_available(auth.uid(),b.id,coalesce(b.scheduled_start,b.preferred_start),coalesce(b.scheduled_start,b.preferred_start)+interval '1 hour',30)
      then raise exception 'This offer conflicts with your availability or another assignment'; end if;
    if not exists(select 1 from public.provider_services where provider_id=auth.uid() and service_id=b.service_id) then raise exception 'Your qualifications no longer match this service'; end if;
  end if;
  return public.respond_to_offer_legacy(p_offer_id,p_accept,p_reason);
end $$;
revoke all on function public.respond_to_offer(uuid,boolean,text) from public,anon;
grant execute on function public.respond_to_offer(uuid,boolean,text) to authenticated;

-- Creating legacy holds uses the same provider lock and availability checks as team offers.
alter function public.make_offer(uuid,uuid,text) rename to make_offer_legacy;
revoke all on function public.make_offer_legacy(uuid,uuid,text) from public,anon,authenticated;
create function public.make_offer(p_booking_id uuid,p_provider_id uuid,p_kind text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare b public.bookings%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_provider_id::text,0));
  if p_kind not in ('admin_assign','foreman') then raise exception 'MAZ administrators select assignment offers' using errcode='42501'; end if;
  select * into b from public.bookings where id=p_booking_id;
  if coalesce(b.scheduled_start,b.preferred_start) is null or not public.provider_slot_available(p_provider_id,b.id,coalesce(b.scheduled_start,b.preferred_start),coalesce(b.scheduled_start,b.preferred_start)+interval '1 hour',30)
    then raise exception 'Set an appointment with an available qualified provider before offering work'; end if;
  return public.make_offer_legacy(p_booking_id,p_provider_id,p_kind);
end $$;
revoke all on function public.make_offer(uuid,uuid,text) from public,anon,authenticated;

-- Offer summaries expose only the area and scope, never private customer contact/address.
create function public.my_team_offers() returns table (
  id uuid,booking_id uuid,trade text,phase text,starts_at timestamptz,ends_at timestamptz,
  expires_at timestamptz,status text,service_name text,description text,area text
) language sql stable security definer set search_path = '' as $$
  select a.id,a.booking_id,a.trade,a.phase,a.starts_at,a.ends_at,a.expires_at,
    case when a.status='offered' and a.expires_at<=now() then 'expired' else a.status end,
    s.name,b.description,concat_ws(', ',addr.barangay,addr.city)
  from public.provider_assignments a join public.bookings b on b.id=a.booking_id
  left join public.services s on s.id=b.service_id left join public.addresses addr on addr.id=b.address_id
  where a.provider_id=auth.uid() and public.is_active_provider() order by a.created_at desc
$$;
revoke all on function public.my_team_offers() from public,anon;
grant execute on function public.my_team_offers() to authenticated;

create function public.expire_provider_assignments() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a record; p record; result jsonb:='[]'::jsonb;
begin
  if auth.role()<>'service_role' then raise exception 'Server only' using errcode='42501'; end if;
  for a in update public.provider_assignments set status='expired',responded_at=now()
    where status='offered' and expires_at<=now() returning id,booking_id loop
    perform public.write_audit(null,'assignment.expired','provider_assignments',a.id::text,null,jsonb_build_object('booking_id',a.booking_id));
    for p in select id from public.profiles where role='admin' loop
      result:=result||jsonb_build_array(jsonb_build_object('profile_id',p.id,'event','assignment.expired','title','Team offer expired',
        'body','Offer a replacement or arrange a new appointment. Other team assignments stay reserved.',
        'link','/admin/provider-work-updates','channels',jsonb_build_array('in_app')));
    end loop;
  end loop;
  return result;
end $$;
revoke all on function public.expire_provider_assignments() from public,anon,authenticated;
grant execute on function public.expire_provider_assignments() to service_role;

-- Admin-only parent sign-off. Provider submissions do not mark a booking Completed.
create function public.approve_provider_project_completion(p_booking uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare b public.bookings%rowtype;
begin
  if not public.is_admin() then raise exception 'MAZ approval required' using errcode='42501'; end if;
  select * into b from public.bookings where id=p_booking for update;
  if not found then raise exception 'Booking not found' using errcode='P0002'; end if;
  if b.status<>'in_progress' then raise exception 'Only ongoing work can be signed off'; end if;
  if exists(select 1 from public.provider_assignments where booking_id=p_booking and phase='execution'
    and status in ('offered','accepted','withdrawal_requested')) then raise exception 'Review all required worker completions first'; end if;
  if exists(select 1 from public.provider_assignments needed where needed.booking_id=p_booking and needed.phase='execution' and needed.required
    and not exists(select 1 from public.provider_assignments filled where filled.booking_id=p_booking and filled.trade=needed.trade and filled.phase='execution' and filled.status='completed')) then raise exception 'Required project roles still need completed work or a replacement'; end if;
  if exists(select 1 from public.milestones where booking_id=p_booking and status<>'confirmed') then raise exception 'Approve all project milestones first'; end if;
  if b.provider_id is not null and not exists(select 1 from public.provider_work_updates where booking_id=p_booking and provider_id=b.provider_id
    and kind='completion' and review_status='approved') then raise exception 'Approve the lead provider completion evidence first'; end if;
  if not exists(select 1 from public.provider_work_updates where booking_id=p_booking and kind='completion' and review_status='approved') then raise exception 'Approved completion evidence required'; end if;
  perform public.change_booking_status(p_booking,'done','MAZ verified completion evidence and signed off');
  perform public.write_audit(auth.uid(),'project.completion_approved','bookings',p_booking::text,null,'{}'::jsonb);
end $$;
revoke all on function public.approve_provider_project_completion(uuid) from public,anon;
grant execute on function public.approve_provider_project_completion(uuid) to authenticated;

-- Leave/withdrawal does not silently remove a worker or cancel the parent project.
create function public.request_provider_withdrawal(p_assignment uuid,p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare a public.provider_assignments%rowtype;
begin
  if not public.is_active_provider() then raise exception 'Active provider required' using errcode='42501'; end if;
  if length(btrim(coalesce(p_reason,'')))<10 then raise exception 'Explain why replacement or rescheduling is needed'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
  select * into a from public.provider_assignments where id=p_assignment and provider_id=auth.uid() for update;
  if not found or a.status not in ('accepted','withdrawal_requested') then raise exception 'Accepted assignment required'; end if;
  update public.provider_assignments set status='withdrawal_requested',response_note=left(btrim(p_reason),1000) where id=a.id;
  perform public.write_audit(auth.uid(),'assignment.withdrawal_requested','provider_assignments',a.id::text,p_reason,'{}'::jsonb);
end $$;
revoke all on function public.request_provider_withdrawal(uuid,text) from public,anon;
grant execute on function public.request_provider_withdrawal(uuid,text) to authenticated;

create function public.release_provider_assignment(p_assignment uuid,p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare a public.provider_assignments%rowtype;
begin
  if not public.is_admin() then raise exception 'MAZ approval required' using errcode='42501'; end if;
  if length(btrim(coalesce(p_reason,'')))<10 then raise exception 'Record the replacement or rescheduling plan'; end if;
  select * into a from public.provider_assignments where id=p_assignment;
  if not found then raise exception 'Assignment not found' using errcode='P0002'; end if;
  perform pg_advisory_xact_lock(hashtextextended(a.provider_id::text,0));
  select * into a from public.provider_assignments where id=p_assignment for update;
  if a.status not in ('accepted','withdrawal_requested','offered') then raise exception 'Assignment already closed'; end if;
  update public.provider_assignments set status='withdrawn',response_note=left(btrim(p_reason),1000) where id=a.id;
  perform public.write_audit(auth.uid(),'assignment.released','provider_assignments',a.id::text,p_reason,jsonb_build_object('booking_id',a.booking_id));
end $$;
revoke all on function public.release_provider_assignment(uuid,text) from public,anon;
grant execute on function public.release_provider_assignment(uuid,text) to authenticated;

-- Team members participate in the booking-scoped chat after acceptance.
create policy "messages: accepted team sends" on public.messages for insert to authenticated
with check (sender_id=auth.uid() and booking_id is not null and public.is_booking_provider(booking_id)
  and exists(select 1 from public.bookings where id=booking_id and status<>'cancelled'));

-- Customer receipts never become visible through project-evidence access.
drop policy "receipts and proof photos: parties or admin read" on storage.objects;
create policy "receipts and proof photos: parties or admin read" on storage.objects for select to authenticated
using ((bucket_id='proof-photos' and (public.is_booking_party_text((storage.foldername(name))[1]) or public.is_admin()))
  or (bucket_id='receipts' and (public.is_admin() or exists(select 1 from public.bookings b
    where b.id::text=(storage.foldername(name))[1] and b.customer_id=auth.uid()))));

-- MAZ prepares versioned quotations with an explicit deposit; no unapproved price tiers.
create function public.prepare_maz_quote(p_booking uuid,p_amount numeric,p_deposit numeric,p_notes text,p_expires timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare b public.bookings%rowtype; q uuid;
begin
  if not public.is_admin() then raise exception 'Only MAZ prepares business quotations' using errcode='42501'; end if;
  select * into b from public.bookings where id=p_booking for update;
  if not found or b.status not in ('accepted','quoted') then raise exception 'Confirm the appointment and assigned lead before quoting'; end if;
  if p_amount is null or p_amount<=0 or p_amount>10000000 or p_deposit is null or p_deposit<0 or p_deposit>p_amount then raise exception 'Enter valid quote and required deposit amounts'; end if;
  if p_expires is null or p_expires<=now() or length(btrim(coalesce(p_notes,'')))<10 or length(p_notes)>4000 then raise exception 'Add scope, inclusions, exclusions and a future validity date'; end if;
  if exists(select 1 from public.quotes where booking_id=p_booking and status='accepted') then raise exception 'An approved customer scope already exists. Extra work requires a separate change order'; end if;
  update public.quotes set status='superseded' where booking_id=p_booking and status in ('proposed','approved');
  insert into public.quotes(booking_id,proposed_by,amount,job_class,status,notes,approved_by,deposit_amount,payment_tier,expires_at,decided_at)
    values(p_booking,auth.uid(),p_amount,coalesce(b.job_class,'minor'),'approved',btrim(p_notes),auth.uid(),p_deposit,null,p_expires,now()) returning id into q;
  update public.bookings set quote_total=p_amount,deposit_amount=p_deposit,payment_tier=null where id=p_booking;
  if b.status='accepted' then perform public.change_booking_status(p_booking,'quoted','MAZ issued a quotation'); end if;
  perform public.write_audit(auth.uid(),'quote.issued_by_maz','quotes',q::text,null,jsonb_build_object('amount',p_amount,'deposit',p_deposit));
  return jsonb_build_object('quote_id',q,'notify',jsonb_build_array(jsonb_build_object('profile_id',b.customer_id,'event','quote.ready',
    'title','Your MAZ quotation is ready','body','Review the scope and payment plan before approving.','link','/customer/bookings/'||p_booking,'channels',jsonb_build_array('in_app','email'))));
end $$;
revoke all on function public.prepare_maz_quote(uuid,numeric,numeric,text,timestamptz) from public,anon;
grant execute on function public.prepare_maz_quote(uuid,numeric,numeric,text,timestamptz) to authenticated;

insert into public.booking_status_moves(from_status,to_status,actors) values ('open','accepted',array['admin']) on conflict do nothing;
create function public.confirm_maz_appointment(p_booking uuid,p_lead uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare b public.bookings%rowtype; a public.provider_assignments%rowtype; q public.quotes%rowtype;
begin
  if not public.is_admin() then raise exception 'Only MAZ confirms appointments' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_lead::text,0));
  select * into b from public.bookings where id=p_booking for update;
  select * into a from public.provider_assignments where booking_id=p_booking and provider_id=p_lead and status='accepted' order by starts_at limit 1;
  if not found then
    if b.provider_id is distinct from p_lead or not exists(select 1 from public.offers where booking_id=p_booking and provider_id=p_lead and status='accepted') then raise exception 'Select a provider who accepted this project role'; end if;
    a.starts_at:=b.preferred_start; a.ends_at:=b.preferred_start+interval '1 hour'; a.travel_minutes:=30;
    a.phase:=case when exists(select 1 from public.quotes where booking_id=p_booking and status='accepted') then 'execution' else 'inspection' end;
  end if;
  -- Requested appointments are already customer-proposed. Material changes need customer agreement.
  if (b.preferred_start is distinct from a.starts_at or a.phase='execution') and not exists(select 1 from public.provider_appointment_requests r
    where r.booking_id=p_booking and r.starts_at=a.starts_at and r.ends_at=a.ends_at and r.phase=a.phase and r.status='accepted')
    then raise exception 'Obtain customer agreement to this proposed work period first'; end if;
  if b.status not in ('open','accepted','quoted','deposit_paid') then raise exception 'The booking cannot be scheduled in its current state'; end if;
  if not public.provider_slot_available(p_lead,p_booking,a.starts_at,a.ends_at,a.travel_minutes) then raise exception 'The provider has a conflicting schedule'; end if;
  update public.bookings set provider_id=p_lead,scheduled_start=a.starts_at,schedule_confirmed_at=now(),reminder_sent_at=null where id=p_booking;
  if b.status='open' then perform public.change_booking_status(p_booking,'accepted','MAZ confirmed accepted lead and requested appointment'); end if;
  if a.phase='execution' then
    select * into q from public.quotes where booking_id=p_booking and status='accepted' order by created_at desc limit 1;
    if not found then raise exception 'Customer must approve the MAZ scope before execution is scheduled'; end if;
    if coalesce(q.deposit_amount,0)>coalesce((select sum(amount-refunded_amount) from public.payments where booking_id=p_booking and status in ('paid','partially_refunded')),0)
      then raise exception 'Required deposit must be verified before execution'; end if;
    if exists(select 1 from public.provider_assignments where booking_id=p_booking and phase='execution' and status in ('offered','withdrawal_requested')) then raise exception 'Resolve all required execution roles first'; end if;
    if exists(select 1 from public.provider_assignments needed where needed.booking_id=p_booking and needed.phase='execution' and needed.required
      and not exists(select 1 from public.provider_assignments filled where filled.booking_id=p_booking and filled.trade=needed.trade and filled.phase='execution' and filled.status in ('accepted','completed'))) then raise exception 'A required execution role needs an accepted replacement'; end if;
    if exists(select 1 from public.provider_assignments work where work.booking_id=p_booking and work.phase='execution' and work.status='accepted'
      and not exists(select 1 from public.provider_appointment_requests agreed where agreed.booking_id=p_booking and agreed.starts_at=work.starts_at and agreed.ends_at=work.ends_at and agreed.phase='execution' and agreed.status='accepted')) then raise exception 'Customer must approve the execution work periods for the full team'; end if;
    if b.status='quoted' then perform public.change_booking_status(p_booking,'deposit_paid','Admin verified the configured payment requirement'); end if;
    perform public.change_booking_status(p_booking,'scheduled','MAZ confirmed execution appointment');
  end if;
  perform public.write_audit(auth.uid(),'appointment.confirmed_by_maz','bookings',p_booking::text,null,jsonb_build_object('lead',p_lead,'start',a.starts_at,'phase',a.phase));
end $$;
revoke all on function public.confirm_maz_appointment(uuid,uuid) from public,anon;
grant execute on function public.confirm_maz_appointment(uuid,uuid) to authenticated;

alter table public.milestones add column due_at timestamptz;
create function public.add_provider_work_milestone(p_booking uuid,p_title text,p_due timestamptz default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare b public.bookings%rowtype; v_id uuid;
begin
  if not public.is_admin() then raise exception 'Only MAZ defines project milestones' using errcode='42501'; end if;
  select * into b from public.bookings where id=p_booking for update;
  if not found or b.status not in ('accepted','quoted','deposit_paid','scheduled','in_progress') then raise exception 'Active project required'; end if;
  if length(btrim(coalesce(p_title,''))) not between 3 and 120 then raise exception 'Add a milestone title of 3 to 120 characters'; end if;
  insert into public.milestones(booking_id,position,title,amount,due_at)
    select p_booking,coalesce(max(position),0)+1,btrim(p_title),0,p_due from public.milestones where booking_id=p_booking returning id into v_id;
  perform public.write_audit(auth.uid(),'project.milestone_added','milestones',v_id::text,null,jsonb_build_object('booking_id',p_booking));
  return v_id;
end $$;
revoke all on function public.add_provider_work_milestone(uuid,text,timestamptz) from public,anon;
grant execute on function public.add_provider_work_milestone(uuid,text,timestamptz) to authenticated;

create function public.booking_feedback_workers(p_booking uuid)
returns table(provider_id uuid,display_name text,submitted boolean)
language sql stable security definer set search_path = '' as $$
  select p.id,concat_ws(' ',p.first_name,p.last_name),exists(select 1 from public.provider_feedback f where f.booking_id=p_booking and f.provider_id=p.id)
  from public.profiles p where exists(select 1 from public.bookings b where b.id=p_booking and b.customer_id=auth.uid()
    and b.status in ('done','signed','balance_paid','completed') and (b.provider_id=p.id
      or exists(select 1 from public.provider_assignments a where a.booking_id=b.id and a.provider_id=p.id and a.status='completed')))
$$;
revoke all on function public.booking_feedback_workers(uuid) from public,anon;
grant execute on function public.booking_feedback_workers(uuid) to authenticated;

-- Suspended providers cannot use their former booking access to bypass the workspace guard.
create policy "bookings: provider must be active" on public.bookings as restrictive for select to authenticated
using (public.current_user_role()<>'provider' or public.is_active_provider());

-- Execution consent is separate from an earlier inspection appointment.
create table public.provider_appointment_requests (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null check(ends_at>starts_at),
  phase text not null check(phase in ('inspection','execution')),
  requested_by uuid not null references public.profiles(id),
  status text not null default 'pending' check(status in ('pending','accepted','declined')),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  unique(booking_id,starts_at,ends_at,phase)
);
alter table public.provider_appointment_requests enable row level security;
grant select on public.provider_appointment_requests to authenticated;
create policy "appointment proposals: customer or admin" on public.provider_appointment_requests for select to authenticated
using(public.is_booking_customer(booking_id) or public.is_admin());
create function public.respond_provider_appointment(p_request uuid,p_accept boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.provider_appointment_requests%rowtype;
begin
  select * into r from public.provider_appointment_requests where id=p_request for update;
  if not found or not public.is_booking_customer(r.booking_id) then raise exception 'Only the booking customer can decide this schedule' using errcode='42501'; end if;
  if (r.status='accepted' and p_accept) or (r.status='declined' and not p_accept) then return; end if;
  if r.status<>'pending' or r.starts_at<=now() then raise exception 'This schedule proposal is no longer open'; end if;
  if not exists(select 1 from public.bookings where id=r.booking_id and status not in ('cancelled','done','signed','balance_paid','completed')) then raise exception 'Booking is no longer active'; end if;
  update public.provider_appointment_requests set status=case when p_accept then 'accepted' else 'declined' end,decided_at=now() where id=r.id;
  perform public.write_audit(auth.uid(),'appointment.customer_responded','provider_appointment_requests',r.id::text,null,jsonb_build_object('accepted',p_accept,'starts_at',r.starts_at,'ends_at',r.ends_at));
end $$;
revoke all on function public.respond_provider_appointment(uuid,boolean) from public,anon;
grant execute on function public.respond_provider_appointment(uuid,boolean) to authenticated;

-- Eligibility lists use the same calendar rules as final transaction checks.
alter function public.provider_can_take(uuid,uuid,boolean) rename to provider_can_take_legacy;
revoke all on function public.provider_can_take_legacy(uuid,uuid,boolean) from public,anon,authenticated;
create function public.provider_can_take(p_booking_id uuid,p_provider_id uuid,p_check_distance boolean)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.provider_can_take_legacy(p_booking_id,p_provider_id,p_check_distance)
    and exists(select 1 from public.bookings b where b.id=p_booking_id
      and public.provider_slot_available(p_provider_id,p_booking_id,coalesce(b.scheduled_start,b.preferred_start),
        coalesce(b.scheduled_start,b.preferred_start)+interval '1 hour',30))
$$;
revoke all on function public.provider_can_take(uuid,uuid,boolean) from public,anon,authenticated;
