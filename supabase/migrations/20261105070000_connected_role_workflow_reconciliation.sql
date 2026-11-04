-- Direct team assignments must be visible consistently to all booking parties.
create or replace function public.refresh_official_booking_status() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 new.official_status:=case when new.status='cancelled' then 'Cancelled'
  when new.status in ('done','signed','balance_paid','completed') then 'Completed'
  when new.status='in_progress' then 'Ongoing'
  when new.execution_confirmed_at is not null or exists(select 1 from public.provider_assignments a where a.booking_id=new.id and a.status in ('accepted','withdrawal_requested')) then 'Assigned'
  when new.admin_accepted_at is not null then 'Accepted' else 'Pending' end;
 return new;
end $$;
create function public.sync_assignment_booking_status() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='DELETE' then update public.bookings set official_status=official_status where id=old.booking_id; return old; end if;
 update public.bookings set official_status=official_status where id=new.booking_id;
 if tg_op='UPDATE' and old.booking_id<>new.booking_id then update public.bookings set official_status=official_status where id=old.booking_id; end if;
 return new;
end $$;
create trigger assignments_sync_booking_status after insert or update or delete on public.provider_assignments
 for each row execute function public.sync_assignment_booking_status();
revoke all on function public.sync_assignment_booking_status() from public,anon,authenticated;

-- Parent authorization remains enforced by the existing summary RPC.
do $migration$
declare definition text; old_filter text;
begin
 definition:=pg_get_functiondef('public.managed_booking_summary(uuid)'::regprocedure);
 old_filter:='(public.is_admin() or (((a.phase=''inspection'' and b.schedule_confirmed_at is not null) or (a.phase=''execution'' and b.execution_confirmed_at is not null)) and a.status in (''accepted'',''completed'',''withdrawal_requested'')))';
 if position(old_filter in definition)=0 then raise exception 'Expected team visibility filter not found'; end if;
 execute replace(definition,old_filter,'(public.is_admin() or a.status in (''accepted'',''completed'',''withdrawal_requested''))');
end $migration$;

-- Legacy completion callers must use the same private-evidence and MAZ review workflow.
create or replace function public.submit_provider_completion(p_booking_id uuid,p_notes text,p_photo_paths text[])
returns jsonb language plpgsql security definer set search_path='' as $$
declare update_id uuid;
begin
 if length(btrim(coalesce(p_notes,'')))<10 then raise exception 'Add completion notes of at least 10 characters'; end if;
 update_id:=public.submit_provider_work_update(p_booking_id,'completion',p_notes,p_photo_paths,null,gen_random_uuid());
 return jsonb_build_object('booking_id',p_booking_id,'update_id',update_id,'status','pending_maz_review','notify',(select coalesce(jsonb_agg(jsonb_build_object('profile_id',p.id,'event','provider.work_update','title','Provider completion awaiting MAZ review','link','/admin/provider-work-updates','channels',jsonb_build_array('in_app'))),'[]'::jsonb) from public.profiles p where p.role='admin'));
end $$;
-- Recompute derived labels only; do not change workflow, approvals or financial records.
do $repair$
declare r record; corrected text;
begin
 for r in select id,official_status from public.bookings loop
  update public.bookings set official_status=official_status where id=r.id returning official_status into corrected;
  if corrected is distinct from r.official_status then perform public.write_audit(null,'booking.status_label_reconciled','bookings',r.id::text,null,jsonb_build_object('before',r.official_status,'after',corrected)); end if;
 end loop;
end $repair$;
-- Cancelled bookings must release reserved workers instead of blocking their availability.
create function public.release_cancelled_booking_team() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 update public.provider_assignments set status='withdrawn',response_note='Booking cancelled by MAZ; assignment released'
  where booking_id=new.id and status in ('offered','accepted','withdrawal_requested');
 update public.provider_appointment_requests set status='declined',decided_at=now()
  where booking_id=new.id and status in ('pending','accepted') and starts_at>now();
 perform public.write_audit(auth.uid(),'assignment.released_on_cancellation','bookings',new.id::text,null,jsonb_build_object('reason','Booking cancelled'));
 return new;
end $$;
create trigger cancelled_booking_releases_team after update of status on public.bookings for each row
 when(new.status='cancelled' and old.status is distinct from new.status) execute function public.release_cancelled_booking_team();
revoke all on function public.release_cancelled_booking_team() from public,anon,authenticated;
-- Historical completed/cancelled assignments cannot reserve new appointments.
do $availability$
declare definition text; needle text:='a.booking_id <> p_booking';
begin
 definition:=pg_get_functiondef('public.provider_slot_available(uuid,uuid,timestamptz,timestamptz,integer)'::regprocedure);
 if position(needle in definition)=0 then raise exception 'Expected assignment availability filter not found'; end if;
 execute replace(definition,needle,needle||' and exists(select 1 from public.bookings parent where parent.id=a.booking_id and parent.status not in (''cancelled'',''done'',''signed'',''balance_paid'',''completed''))');
end $availability$;
-- The contract decision controls the quotation's fixed automatic advance.
create function public.guard_issued_contract_requirement() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.contract_required is distinct from old.contract_required and exists(select 1 from public.quotes where booking_id=new.id and status='accepted') then
  raise exception 'The contract requirement is fixed by the issued quotation. Use a change order for additional agreed terms';
 end if;
 return new;
end $$;
create trigger issued_contract_requirement before update of contract_required on public.bookings
 for each row execute function public.guard_issued_contract_requirement();
create function public.guard_required_contract_document() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.kind='contract' and not exists(select 1 from public.bookings where id=new.booking_id and contract_required) then
  raise exception 'Select the contract requirement before issuing the quotation. Small services without a contract have no advance payment';
 end if;
 return new;
end $$;
create trigger project_documents_required_contract before insert on public.project_documents
 for each row execute function public.guard_required_contract_document();
revoke all on function public.guard_issued_contract_requirement() from public,anon,authenticated;
revoke all on function public.guard_required_contract_document() from public,anon,authenticated;
-- Knowing a storage path must not expose an unreviewed provider photo to customers.
create function public.can_read_provider_evidence(p_path text,p_owner text) returns boolean
language sql stable security definer set search_path='' as $$
 select public.is_admin() or exists(select 1 from public.bookings b where b.id::text=split_part(p_path,'/',1) and (
  (p_owner=auth.uid()::text and public.is_booking_provider(b.id))
  or (b.customer_id=auth.uid() and exists(select 1 from public.provider_work_updates u where u.booking_id=b.id and u.review_status='approved' and p_path=any(u.photo_paths)))
 ))
$$;
revoke all on function public.can_read_provider_evidence(text,text) from public,anon;
grant execute on function public.can_read_provider_evidence(text,text) to authenticated;
drop policy "receipts and proof photos: parties or admin read" on storage.objects;
create policy "receipts and proof photos: parties or admin read" on storage.objects for select to authenticated
using ((bucket_id='proof-photos' and public.can_read_provider_evidence(name,owner_id))
 or (bucket_id='receipts' and (public.is_admin() or exists(select 1 from public.bookings b where b.id::text=(storage.foldername(name))[1] and b.customer_id=auth.uid()))));
