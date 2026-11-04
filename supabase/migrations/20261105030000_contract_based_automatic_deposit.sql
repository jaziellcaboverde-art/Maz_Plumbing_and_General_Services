-- New quotation deposits follow the stored contract decision, not client input.
-- Approved quotation/payment records are not rewritten.
do $migration$
declare definition text; needle text:='v_amount:=(p_data->>''deposit'')::numeric;';
begin
  definition:=pg_get_functiondef('public.managed_booking_action(uuid,text,jsonb)'::regprocedure);
  if position(needle in definition)=0 then raise exception 'Expected quotation calculation not found; review before applying'; end if;
  definition:=replace(definition,needle,'v_amount:=case when b.contract_required then round(v_total*0.5,2) else 0 end; p_data:=jsonb_set(p_data,''{schedule}'',''[]''::jsonb);');
  execute definition;
end $migration$;
