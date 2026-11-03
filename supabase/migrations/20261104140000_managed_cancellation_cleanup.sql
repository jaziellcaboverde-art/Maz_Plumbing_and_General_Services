-- MAZ cancellation releases only this project's reservations; refunds stay separate.
alter table public.provider_appointment_requests drop constraint provider_appointment_requests_status_check;
alter table public.provider_appointment_requests add constraint provider_appointment_requests_status_check check(status in ('pending','accepted','declined','cancelled'));
create function public.release_cancelled_project_reservations() returns trigger language plpgsql security definer set search_path='' as $$
declare released integer;
begin
  if new.status='cancelled' and old.status<>'cancelled' then
    insert into public.notifications(profile_id,event,title,body,link)
      select distinct a.provider_id,'booking.cancelled_by_maz','MAZ cancelled a project','Your active reservation for booking '||new.id||' has been released. Contact MAZ for details.','/provider/offers'
      from public.provider_assignments a where a.booking_id=new.id and a.status in ('offered','accepted','withdrawal_requested');
    update public.provider_assignments set status='withdrawn',response_note='MAZ cancelled the booking: '||coalesce(new.cancel_reason,'See project audit'),responded_at=now()
      where booking_id=new.id and status in ('offered','accepted','withdrawal_requested');
    get diagnostics released=row_count;
    update public.provider_appointment_requests set status='cancelled',decided_at=now() where booking_id=new.id and status='pending';
    perform public.write_audit(auth.uid(),'booking.reservations_released','bookings',new.id::text,new.cancel_reason,jsonb_build_object('assignments',released));
  end if;
  return new;
end $$;
create trigger bookings_release_cancelled_reservations after update of status on public.bookings for each row execute function public.release_cancelled_project_reservations();
