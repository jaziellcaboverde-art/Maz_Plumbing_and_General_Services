-- A booking review cannot charge the ocular fee for a non-chargeable service.
create function public.guard_selected_service_inspection() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.inspection_fee>0 and (not new.inspection_required or not exists(select 1 from public.services where id=new.service_id and inspection_policy='chargeable')) then
    raise exception 'PHP 1,500 inspection applies only to selected chargeable services with a required inspection';
  end if;
  return new;
end $$;
create trigger bookings_selected_inspection before insert or update of inspection_fee,inspection_required,service_id on public.bookings for each row execute function public.guard_selected_service_inspection();
