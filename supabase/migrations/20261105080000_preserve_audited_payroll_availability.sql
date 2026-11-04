-- The upstream payroll migration may be deployed after the role audit on an existing database.
-- Preserve its daily scheduling rules while keeping closed bookings from reserving workers.
do $compatibility$
declare definition text; needle text:='a.booking_id <> p_booking';
begin
 definition:=pg_get_functiondef('public.provider_slot_available(uuid,uuid,timestamptz,timestamptz,integer)'::regprocedure);
 if position('parent.id=a.booking_id' in definition)=0 then
  if position(needle in definition)=0 then raise exception 'Expected assignment availability filter not found'; end if;
  execute replace(definition,needle,needle||' and exists(select 1 from public.bookings parent where parent.id=a.booking_id and parent.status not in (''cancelled'',''done'',''signed'',''balance_paid'',''completed''))');
 end if;
end $compatibility$;
