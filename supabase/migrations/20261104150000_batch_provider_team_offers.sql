-- One transaction per team offer: no partial team if any worker fails validation.
create table public.provider_team_offer_batches (
  request_key uuid primary key,booking_id uuid not null references public.bookings(id),
  assigned_by uuid not null references public.profiles(id),payload jsonb not null,result jsonb not null,created_at timestamptz not null default now()
);
alter table public.provider_team_offer_batches enable row level security;
grant select on public.provider_team_offer_batches to authenticated;
create policy "team offer batches: admin" on public.provider_team_offer_batches for select to authenticated using(public.is_admin());
create function public.offer_provider_team(p_booking uuid,p_workers jsonb,p_phase text,p_start timestamptz,p_end timestamptz,p_expires timestamptz,p_buffer integer,p_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare worker jsonb;provider uuid;payload jsonb;prior public.provider_team_offer_batches%rowtype;entry jsonb;assignments jsonb:='[]';notifications jsonb:='[]';result jsonb;worker_name text;
begin
  if not public.is_admin() then raise exception 'Only MAZ administrators assign teams' using errcode='42501'; end if;
  if p_key is null or jsonb_typeof(p_workers) is distinct from 'array' or jsonb_array_length(p_workers) not between 1 and 50 then raise exception 'Choose 1 to 50 workers per offer batch'; end if;
  if p_phase not in ('inspection','execution') or p_buffer not between 0 and 240 or p_buffer is null then raise exception 'Choose a valid phase and travel buffer'; end if;
  if (select count(distinct value->>'providerId') from jsonb_array_elements(p_workers))<>jsonb_array_length(p_workers) then raise exception 'Select each worker only once'; end if;
  payload:=jsonb_build_object('workers',p_workers,'phase',p_phase,'start',p_start,'end',p_end,'expires',p_expires,'buffer',p_buffer);
  -- Same lock order across batches prevents reversed worker lists from deadlocking.
  for provider in select (value->>'providerId')::uuid from jsonb_array_elements(p_workers) order by 1 loop
    perform pg_advisory_xact_lock(hashtextextended(provider::text,0));
  end loop;
  perform 1 from public.bookings where id=p_booking for update;
  select * into prior from public.provider_team_offer_batches where request_key=p_key;
  if found then
    if prior.booking_id<>p_booking or prior.assigned_by<>auth.uid() or prior.payload<>payload then raise exception 'This request key belongs to a different team offer'; end if;
    return prior.result||jsonb_build_object('replayed',true);
  end if;
  for worker in select value from jsonb_array_elements(p_workers) loop
    provider:=(worker->>'providerId')::uuid;
    select concat_ws(' ',first_name,last_name) into worker_name from public.profiles where id=provider;
    begin
      entry:=public.offer_provider_assignment(p_booking,provider,worker->>'trade',p_phase,p_start,p_end,p_expires,p_buffer);
    exception when others then raise exception 'Could not offer role to %: %',coalesce(nullif(worker_name,''),provider::text),sqlerrm; end;
    assignments:=assignments||jsonb_build_array(entry->'assignment');
    notifications:=notifications||coalesce(entry->'notify','[]');
  end loop;
  select coalesce(jsonb_agg(n),'[]') into notifications from (select distinct on (n->>'profile_id',n->>'event',n->>'link') n from jsonb_array_elements(notifications) n) deduplicated;
  result:=jsonb_build_object('assignments',assignments,'notify',notifications);
  insert into public.provider_team_offer_batches(request_key,booking_id,assigned_by,payload,result) values(p_key,p_booking,auth.uid(),payload,result);
  return result;
end $$;
revoke all on function public.offer_provider_team(uuid,jsonb,text,timestamptz,timestamptz,timestamptz,integer,uuid) from public,anon;
grant execute on function public.offer_provider_team(uuid,jsonb,text,timestamptz,timestamptz,timestamptz,integer,uuid) to authenticated;

-- Select the accepted lead for the correct phase, not an earlier inspection role.
create or replace function public.confirm_maz_appointment_provider_v1(p_booking uuid,p_lead uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare b public.bookings%rowtype; a public.provider_assignments%rowtype; q public.quotes%rowtype;
begin
  if not public.is_admin() then raise exception 'Only MAZ confirms appointments' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_lead::text,0));
  select * into b from public.bookings where id=p_booking for update;
  select * into a from public.provider_assignments where booking_id=p_booking and provider_id=p_lead and status='accepted' and phase=case when exists(select 1 from public.quotes where booking_id=p_booking and status='accepted') then 'execution' else 'inspection' end order by starts_at limit 1;
  if not found then
    if exists(select 1 from public.provider_assignments where booking_id=p_booking and provider_id=p_lead and phase=case when exists(select 1 from public.quotes where booking_id=p_booking and status='accepted') then 'execution' else 'inspection' end) then raise exception 'The lead must accept the current project phase before confirmation'; end if;
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
