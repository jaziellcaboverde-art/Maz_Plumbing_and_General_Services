-- Direct MAZ assignments retain the existing 'accepted' state for compatibility.
-- They are audited as admin assignments, never as provider responses.
create function public.assign_provider_team(p_booking uuid,p_workers jsonb,p_phase text,p_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.bookings%rowtype; worker jsonb; provider uuid; a public.provider_assignments%rowtype;
  payload jsonb; prior public.provider_team_offer_batches%rowtype; assignments jsonb:='[]'; notifications jsonb:='[]';
  result jsonb; work_start timestamptz; work_end timestamptz; worker_name text; candidate timestamptz; available boolean;
begin
  if not public.is_admin() then raise exception 'Only MAZ administrators assign teams' using errcode='42501'; end if;
  if p_key is null or jsonb_typeof(p_workers) is distinct from 'array' then raise exception 'Choose 1 to 50 workers'; end if;
  if jsonb_array_length(p_workers) not between 1 and 50 or p_phase is null or p_phase not in ('inspection','execution') then raise exception 'Choose workers and a valid phase'; end if;
  if (select count(distinct value->>'providerId') from jsonb_array_elements(p_workers))<>jsonb_array_length(p_workers) then raise exception 'Select each worker once'; end if;
  payload:=jsonb_build_object('workers',p_workers,'phase',p_phase,'mode','direct');
  perform pg_advisory_xact_lock(hashtextextended(p_key::text,1));
  select * into prior from public.provider_team_offer_batches where request_key=p_key;
  if found then
    if prior.booking_id<>p_booking or prior.assigned_by<>auth.uid() or prior.payload<>payload then raise exception 'Request key already used for a different assignment'; end if;
    return prior.result||jsonb_build_object('replayed',true);
  end if;
  for provider in select (value->>'providerId')::uuid from jsonb_array_elements(p_workers) order by 1 loop
    perform pg_advisory_xact_lock(hashtextextended(provider::text,0));
  end loop;
  select * into b from public.bookings where id=p_booking for update;
  if not found or b.status in ('draft','cancelled','done','signed','balance_paid','completed') then raise exception 'This booking cannot receive assignments'; end if;
  if exists(select 1 from jsonb_array_elements(p_workers) w where not exists(select 1 from public.provider_services ps where ps.provider_id=(w->>'providerId')::uuid and ps.service_id=b.service_id)) then raise exception 'Every worker must be assigned to the selected service'; end if;
  if exists(select 1 from jsonb_array_elements(p_workers) w where not exists(select 1 from public.provider_profiles pp join public.profiles pr on pr.id=pp.profile_id where pp.profile_id=(w->>'providerId')::uuid and pp.status='approved' and pr.role='provider')) then raise exception 'Select approved providers only'; end if;
  select r.starts_at,r.ends_at into work_start,work_end from public.provider_appointment_requests r
    where r.booking_id=p_booking and r.phase=p_phase and r.status='accepted' and r.starts_at>now() order by r.created_at desc limit 1;
  if work_start is null then
    work_start:=coalesce(b.scheduled_start,b.preferred_start);
    work_end:=work_start+interval '1 hour';
  end if;
  -- Find the next shared available appointment if the requested time has passed or conflicts.
  -- Changed dates still require customer consent through the existing proposal guards.
  available:=work_start>now() and not exists(select 1 from jsonb_array_elements(p_workers) w
    where not public.provider_slot_available((w->>'providerId')::uuid,p_booking,work_start,work_end,30));
  if available is distinct from true then
    work_start:=null;
    for candidate in select t from generate_series(to_timestamp(ceil(extract(epoch from now())/1800)*1800)+interval '30 minutes',now()+interval '30 days',interval '30 minutes') t loop
      -- For providers without weekly hours, use daytime visits as the default.
      if (candidate at time zone 'Asia/Manila')::time < time '08:00' or (candidate at time zone 'Asia/Manila')::time > time '17:00' then continue; end if;
      if not exists(select 1 from jsonb_array_elements(p_workers) w where not public.provider_slot_available((w->>'providerId')::uuid,p_booking,candidate,candidate+interval '1 hour',30)) then
        work_start:=candidate; work_end:=candidate+interval '1 hour'; exit;
      end if;
    end loop;
    if work_start is null then raise exception 'No shared available appointment in the next 30 days. Select another team or update provider availability'; end if;
  end if;
  for worker in select value from jsonb_array_elements(p_workers) loop
    provider:=(worker->>'providerId')::uuid;
    select concat_ws(' ',first_name,last_name) into worker_name from public.profiles where id=provider;
    if worker->>'trade' is null or length(btrim(worker->>'trade')) not between 2 and 120 then raise exception 'Provide a valid role for each worker'; end if;
    if not exists(select 1 from public.provider_services where provider_id=provider and service_id=b.service_id) then raise exception '% is not assigned to this service',coalesce(worker_name,'Worker'); end if;
    if not public.provider_slot_available(provider,p_booking,work_start,work_end,30) then raise exception '% is unavailable for the booking appointment. Update the appointment or select another worker',coalesce(worker_name,'Worker'); end if;
    if exists(select 1 from public.provider_assignments where booking_id=p_booking and provider_id=provider and phase=p_phase and status in ('accepted','withdrawal_requested')) then raise exception '% is already assigned to this phase',coalesce(worker_name,'Worker'); end if;
    -- An administrator can explicitly replace a previous unanswered offer with a direct assignment.
    update public.provider_assignments set status='withdrawn',response_note='Superseded by direct MAZ assignment' where booking_id=p_booking and provider_id=provider and phase=p_phase and status='offered';
    insert into public.provider_assignments(booking_id,provider_id,assigned_by,trade,phase,starts_at,ends_at,expires_at,travel_minutes,status,response_note)
      values(p_booking,provider,auth.uid(),btrim(worker->>'trade'),p_phase,work_start,work_end,work_start,30,'accepted','Assigned directly by MAZ; provider response not required') returning * into a;
    perform public.write_audit(auth.uid(),'assignment.assigned_by_admin','provider_assignments',a.id::text,null,to_jsonb(a));
    assignments:=assignments||jsonb_build_array(to_jsonb(a));
    notifications:=notifications||jsonb_build_array(jsonb_build_object('profile_id',provider,'event','assignment.assigned','title','New MAZ assignment','body','Your assignment is confirmed. Check the appointment and your work details. No acceptance is required.','link','/provider/jobs/'||p_booking,'channels',jsonb_build_array('in_app')));
  end loop;
  if p_phase='execution' or b.preferred_start is distinct from work_start then
    insert into public.provider_appointment_requests(booking_id,starts_at,ends_at,phase,requested_by)
      values(p_booking,work_start,work_end,p_phase,auth.uid()) on conflict(booking_id,starts_at,ends_at,phase) do nothing;
  end if;
  notifications:=notifications||jsonb_build_array(jsonb_build_object('profile_id',b.customer_id,'event','appointment.proposed','title','MAZ has assigned your service team','body','Review the appointment in your booking. MAZ will confirm it after the required approvals.','link','/customer/bookings/'||p_booking,'channels',jsonb_build_array('in_app')));
  result:=jsonb_build_object('assignments',assignments,'notify',notifications);
  insert into public.provider_team_offer_batches(request_key,booking_id,assigned_by,payload,result) values(p_key,p_booking,auth.uid(),payload,result);
  return result;
end $$;
revoke all on function public.assign_provider_team(uuid,jsonb,text,uuid) from public,anon;
grant execute on function public.assign_provider_team(uuid,jsonb,text,uuid) to authenticated;

alter table public.bookings add column appointment_worker_ids uuid[] not null default '{}';
create function public.confirm_maz_team_appointment(p_booking uuid,p_workers uuid[])
returns void language plpgsql security definer set search_path='' as $$
declare provider uuid; phase_name text; a public.provider_assignments%rowtype;
begin
  if not public.is_admin() then raise exception 'Only MAZ confirms appointments' using errcode='42501'; end if;
  if coalesce(cardinality(p_workers),0) not between 1 and 50 or array_position(p_workers,null) is not null or (select count(distinct id) from unnest(p_workers) id)<>cardinality(p_workers) then raise exception 'Select distinct assigned workers'; end if;
  for provider in select id from unnest(p_workers) id order by id loop perform pg_advisory_xact_lock(hashtextextended(provider::text,0)); end loop;
  perform 1 from public.bookings where id=p_booking for update;
  phase_name:=case when exists(select 1 from public.quotes where booking_id=p_booking and status='accepted') then 'execution' else 'inspection' end;
  foreach provider in array p_workers loop
    select * into a from public.provider_assignments where booking_id=p_booking and provider_id=provider and phase=phase_name and status='accepted';
    if not found then
      if provider is distinct from (select provider_id from public.bookings where id=p_booking) or not exists(select 1 from public.offers where booking_id=p_booking and provider_id=provider and status='accepted') then raise exception 'Each selected worker must be assigned to this booking phase'; end if;
      select coalesce(scheduled_start,preferred_start) into a.starts_at from public.bookings where id=p_booking;
      a.ends_at:=a.starts_at+interval '1 hour'; a.travel_minutes:=30;
    end if;
    if not public.provider_slot_available(provider,p_booking,a.starts_at,a.ends_at,a.travel_minutes) then raise exception 'A selected worker is no longer available. Update the team before confirming'; end if;
  end loop;
  -- Keep all existing customer approval, contract and verified payment guards.
  perform public.confirm_maz_appointment(p_booking,p_workers[1]);
  update public.bookings set appointment_worker_ids=p_workers where id=p_booking;
  perform public.write_audit(auth.uid(),'appointment.team_confirmed','bookings',p_booking::text,null,jsonb_build_object('workers',to_jsonb(p_workers)));
end $$;
revoke all on function public.confirm_maz_team_appointment(uuid,uuid[]) from public,anon;
grant execute on function public.confirm_maz_team_appointment(uuid,uuid[]) to authenticated;

-- Old assignment entry points also create direct assignments; no response window.
create or replace function public.offer_provider_team(p_booking uuid,p_workers jsonb,p_phase text,p_start timestamptz,p_end timestamptz,p_expires timestamptz,p_buffer integer,p_key uuid)
returns jsonb language sql security definer set search_path='' as $$
  select public.assign_provider_team(p_booking,p_workers,p_phase,p_key)
$$;
create or replace function public.offer_provider_assignment(p_booking uuid,p_provider uuid,p_trade text,p_phase text,p_start timestamptz,p_end timestamptz,p_expires timestamptz,p_buffer integer default 30)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  result:=public.assign_provider_team(p_booking,jsonb_build_array(jsonb_build_object('providerId',p_provider,'trade',p_trade)),p_phase,gen_random_uuid());
  return result||jsonb_build_object('assignment',result->'assignments'->0);
end $$;
-- Matching/admin legacy callers still receive their expected return shape.
create or replace function public.make_offer(p_booking_id uuid,p_provider_id uuid,p_kind text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; phase_name text;
begin
  if p_kind not in ('admin_assign','foreman') then raise exception 'MAZ assigns providers' using errcode='42501'; end if;
  phase_name:=case when exists(select 1 from public.quotes where booking_id=p_booking_id and status='accepted') then 'execution' else 'inspection' end;
  result:=public.assign_provider_team(p_booking_id,jsonb_build_array(jsonb_build_object('providerId',p_provider_id,'trade',case when p_kind='foreman' then 'Team lead' else 'Service worker' end)),phase_name,gen_random_uuid());
  return result||jsonb_build_object('offer_id',result->'assignments'->0->'id','expires_at',result->'assignments'->0->'starts_at');
end $$;
-- Historical pending offers are left untouched; MAZ may reassign them explicitly.

-- Avoid the old booking-before-provider lock order in the legacy admin screen.
create or replace function public.admin_offer(p_booking_id uuid,p_provider_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if not public.is_admin() then raise exception 'Only MAZ assigns providers' using errcode='42501'; end if;
  return public.make_offer(p_booking_id,p_provider_id,'admin_assign');
end $$;
