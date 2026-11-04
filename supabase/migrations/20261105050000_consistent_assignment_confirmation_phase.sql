-- Match confirmation to the same inspection/execution phase used by the admin UI.
do $migration$
declare definition text; old_phase text; new_phase text;
begin
 old_phase:='case when exists(select 1 from public.quotes where booking_id=p_booking and status=''accepted'') then ''execution'' else ''inspection'' end';
 new_phase:='case when exists(select 1 from public.quotes where booking_id=p_booking and status=''accepted'') or exists(select 1 from public.bookings where id=p_booking and not inspection_required) or exists(select 1 from public.provider_work_updates where booking_id=p_booking and kind=''inspection'' and review_status=''approved'') then ''execution'' else ''inspection'' end';
 definition:=pg_get_functiondef('public.confirm_maz_team_appointment(uuid,uuid[])'::regprocedure);
 if position(old_phase in definition)=0 then raise exception 'Team phase expression not found'; end if;
 definition:=replace(definition,old_phase,new_phase);
 definition:=replace(definition,'foreach provider in array p_workers loop','if phase_name=''execution'' and not exists(select 1 from public.quotes where booking_id=p_booking and status=''accepted'') then raise exception ''Workers are already assigned. Issue the MAZ quotation before confirming the execution appointment.''; end if; foreach provider in array p_workers loop');
 execute definition;
 definition:=pg_get_functiondef('public.confirm_maz_appointment_provider_v1(uuid,uuid)'::regprocedure);
 if position(old_phase in definition)=0 then raise exception 'Lead phase expression not found'; end if;
 execute replace(definition,old_phase,new_phase);
end $migration$;
