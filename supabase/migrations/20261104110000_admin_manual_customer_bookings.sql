alter table public.bookings
  add column manual_customer_name text,
  add column manual_customer_mobile text,
  add column manual_customer_address text;

alter table public.quotes
  add column decision_channel text check (decision_channel in ('portal', 'offline')),
  add column decision_recorded_by uuid references public.profiles(id);
alter table public.project_documents
  add column decision_channel text check (decision_channel in ('portal', 'offline')),
  add column decision_recorded_by uuid references public.profiles(id),
  add column decision_note text;

create function public.admin_create_manual_booking(
  p_customer_name text,
  p_customer_mobile text,
  p_customer_address text,
  p_service uuid,
  p_description text,
  p_start timestamptz,
  p_source text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_service public.services%rowtype;
begin
  if not public.is_admin() then
    raise exception 'MAZ administrator required' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_customer_name, ''))) not between 2 and 160
     or length(btrim(coalesce(p_customer_mobile, ''))) not between 7 and 32
     or length(btrim(coalesce(p_customer_address, ''))) not between 8 and 500
     or length(btrim(coalesce(p_description, ''))) not between 10 and 4000
     or p_start is null or p_start <= now()
     or p_source not in ('phone', 'facebook', 'walk_in', 'referral') then
    raise exception 'Check customer contact, request details, source and future requested appointment';
  end if;

  select * into v_service from public.services where id = p_service and active;
  if not found then raise exception 'Choose an active service'; end if;

  insert into public.bookings(
    customer_id, service_id, address_id, description, preferred_start,
    created_by, source_channel, manual_customer_name,
    manual_customer_mobile, manual_customer_address, job_class, needs_admin,
    inspection_required, inspection_fee, inspection_pay_before_visit
  ) values (
    auth.uid(), p_service, null, btrim(p_description), p_start,
    auth.uid(), p_source, btrim(p_customer_name), btrim(p_customer_mobile),
    btrim(p_customer_address), v_service.default_class, true,
    v_service.inspection_policy <> 'not_required',
    case when v_service.inspection_policy = 'chargeable' then 1500 else 0 end,
    v_service.inspection_due_point = 'before_visit'
  ) returning id into v_id;

  perform public.change_booking_status(v_id, 'open', 'MAZ recorded request from ' || p_source);
  perform public.write_audit(auth.uid(), 'booking.created_on_behalf', 'bookings', v_id::text, null,
    jsonb_build_object('source', p_source, 'manual_customer', true));
  return v_id;
end
$$;

revoke all on function public.admin_create_manual_booking(text, text, text, uuid, text, timestamptz, text) from public, anon;
grant execute on function public.admin_create_manual_booking(text, text, text, uuid, text, timestamptz, text) to authenticated;

create function public.admin_record_manual_decision(
  p_booking uuid,
  p_action text,
  p_data jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_note text := btrim(coalesce(p_data->>'note', ''));
  v_accept boolean := coalesce((p_data->>'accept')::boolean, false);
  v_quote public.quotes%rowtype;
  v_document public.project_documents%rowtype;
begin
  if not public.is_admin() then
    raise exception 'MAZ administrator required' using errcode = '42501';
  end if;
  if length(v_note) < 10 then
    raise exception 'Record how the customer communicated their decision';
  end if;
  if not exists (
    select 1 from public.bookings
    where id = p_booking and manual_customer_name is not null
  ) then
    raise exception 'Offline decisions are only for manually recorded customer requests';
  end if;

  if p_action = 'admin_record_quote_decision' then
    select * into v_quote from public.quotes
    where id = (p_data->>'id')::uuid and booking_id = p_booking
      and version = (p_data->>'version')::integer
      and status = 'approved' and (expires_at is null or expires_at > now())
    for update;
    if not found then raise exception 'This quotation is no longer open'; end if;
    update public.quotes set
      status = case when v_accept then 'accepted'::public.quote_status else 'declined'::public.quote_status end,
      accepted_by = null,
      accepted_at = case when v_accept then now() else null end,
      decision_note = v_note,
      decided_at = now(),
      decision_channel = 'offline',
      decision_recorded_by = auth.uid()
    where id = v_quote.id;
    perform public.write_audit(auth.uid(), 'quote.offline_decision_recorded', 'quotes', v_quote.id::text, v_note,
      jsonb_build_object('accepted', v_accept, 'version', v_quote.version));
    return jsonb_build_object('ok', true, 'id', v_quote.id);
  elsif p_action = 'admin_record_document_decision' then
    select * into v_document from public.project_documents
    where id = (p_data->>'id')::uuid and booking_id = p_booking
      and version = (p_data->>'version')::integer and status = 'issued'
    for update;
    if not found then raise exception 'This agreement is no longer awaiting a decision'; end if;
    update public.project_documents set
      status = case when v_accept then 'accepted' else 'declined' end,
      accepted_by = null,
      decided_at = now(),
      decision_note = v_note,
      decision_channel = 'offline',
      decision_recorded_by = auth.uid()
    where id = v_document.id;
    if v_accept and v_document.kind = 'change_order' then
      update public.bookings set quote_total = coalesce(quote_total, 0) + v_document.cost_delta where id = p_booking;
    end if;
    perform public.write_audit(auth.uid(), 'document.offline_decision_recorded', 'project_documents', v_document.id::text, v_note,
      jsonb_build_object('accepted', v_accept, 'version', v_document.version));
    return jsonb_build_object('ok', true, 'id', v_document.id);
  end if;
  raise exception 'Unsupported offline decision';
end
$$;

revoke all on function public.admin_record_manual_decision(uuid, text, jsonb) from public, anon;
grant execute on function public.admin_record_manual_decision(uuid, text, jsonb) to authenticated;
