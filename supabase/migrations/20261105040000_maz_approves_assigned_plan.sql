-- MAZ approves issued quotations and assigned work periods; never attribute it to the customer.
create function public.approve_maz_booking_plan(p_booking uuid) returns void
language plpgsql security definer set search_path='' as $$
declare q public.quotes%rowtype; changed integer;
begin
  if not public.is_admin() then raise exception 'Only MAZ approves the assigned booking plan' using errcode='42501'; end if;
  perform 1 from public.bookings where id=p_booking for update;
  select * into q from public.quotes where booking_id=p_booking and status='approved' and expires_at>now() order by version desc limit 1 for update;
  if found and not exists(select 1 from public.quotes where booking_id=p_booking and status='accepted') then
    update public.quotes set status='accepted',accepted_by=auth.uid(),accepted_at=now(),decided_at=now(),decision_note='Approved by MAZ; customer response not required' where id=q.id;
    perform public.write_audit(auth.uid(),'quotation.approved_by_maz','quotes',q.id::text,null,jsonb_build_object('booking_id',p_booking,'customer_response_required',false));
  end if;
  update public.provider_appointment_requests set status='accepted',decided_at=now() where booking_id=p_booking and status='pending' and starts_at>now();
  get diagnostics changed=row_count;
  if changed>0 then perform public.write_audit(auth.uid(),'appointment.approved_by_maz','bookings',p_booking::text,null,jsonb_build_object('periods',changed,'customer_response_required',false)); end if;
end $$;
revoke all on function public.approve_maz_booking_plan(uuid) from public,anon,authenticated;

do $migration$
declare definition text; needle text;
begin
 definition:=pg_get_functiondef('public.managed_booking_action(uuid,text,jsonb)'::regprocedure);
 needle:='elsif p_action=''respond_quote'' then';
 if position(needle in definition)=0 then raise exception 'Quotation branch not found'; end if;
 execute replace(definition,needle,'perform public.approve_maz_booking_plan(p_booking); '||needle);
 definition:=pg_get_functiondef('public.assign_provider_team(uuid,jsonb,text,uuid)'::regprocedure);
 needle:='result:=jsonb_build_object(''assignments'',assignments,''notify'',notifications);';
 if position(needle in definition)=0 then raise exception 'Assignment return not found'; end if;
 execute replace(definition,needle,'perform public.approve_maz_booking_plan(p_booking); '||needle);
 definition:=pg_get_functiondef('public.confirm_maz_team_appointment(uuid,uuid[])'::regprocedure);
 needle:='phase_name:=case';
 if position(needle in definition)=0 then raise exception 'Confirmation phase not found'; end if;
 execute replace(definition,needle,'perform public.approve_maz_booking_plan(p_booking); '||needle);
end $migration$;
-- Bring existing, unexpired MAZ-issued plans into the new admin-approved policy.
-- Declined/expired quotations and already accepted records stay unchanged.
do $backfill$
declare q public.quotes%rowtype; r public.provider_appointment_requests%rowtype;
begin
 for q in select qt.* from public.quotes qt join public.profiles p on p.id=qt.approved_by
   join public.bookings b on b.id=qt.booking_id where qt.status='approved' and qt.expires_at>now() and p.role='admin'
   and b.status not in ('cancelled','done','signed','balance_paid','completed')
   and not exists(select 1 from public.quotes accepted where accepted.booking_id=qt.booking_id and accepted.status='accepted')
   order by qt.version desc loop
   if exists(select 1 from public.quotes where booking_id=q.booking_id and status='accepted') then continue; end if;
   update public.quotes set status='accepted',accepted_by=q.approved_by,accepted_at=now(),decided_at=now(),decision_note='MAZ-issued quotation activated under direct-assignment policy; no customer response required' where id=q.id;
   perform public.write_audit(null,'quotation.approved_by_maz_policy','quotes',q.id::text,null,jsonb_build_object('booking_id',q.booking_id,'original_issuer',q.approved_by));
 end loop;
 for r in select pr.* from public.provider_appointment_requests pr where pr.status='pending' and pr.starts_at>now()
   and exists(select 1 from public.provider_assignments a where a.booking_id=pr.booking_id and a.phase=pr.phase and a.starts_at=pr.starts_at and a.ends_at=pr.ends_at and a.status='accepted') loop
   update public.provider_appointment_requests set status='accepted',decided_at=now() where id=r.id;
   perform public.write_audit(null,'appointment.approved_by_maz_policy','provider_appointment_requests',r.id::text,null,jsonb_build_object('booking_id',r.booking_id,'customer_response_required',false));
 end loop;
end $backfill$;
