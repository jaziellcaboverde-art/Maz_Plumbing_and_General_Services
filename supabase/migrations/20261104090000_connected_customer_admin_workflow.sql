-- Shared records for the customer, MAZ operations and provider workspaces.
-- Inspection payments count once as money received, never as a second discount.
alter table public.bookings
  add column admin_accepted_at timestamptz,
  add column admin_review_note text,
  add column inspection_required boolean not null default false,
  add column inspection_fee numeric(12,2) not null default 0 check(inspection_fee in (0,1500)),
  add column inspection_pay_before_visit boolean not null default false,
  add column contract_required boolean not null default false,
  add column execution_confirmed_at timestamptz,
  add column preferred_worker_note text,
  add column alternate_start timestamptz,
  add column gateway_fee numeric(12,2) not null default 0 check(gateway_fee>=0),
  add column official_status text not null default 'Pending' check(official_status in ('Pending','Accepted','Assigned','Ongoing','Completed','Cancelled'));
grant update(preferred_worker_note,alternate_start) on public.bookings to authenticated;

alter table public.quotes add column version integer not null default 1,
  add column line_items jsonb not null default '[]',
  add column payment_schedule jsonb not null default '[]',
  add column accepted_by uuid references public.profiles(id),
  add column accepted_at timestamptz;
update public.quotes q set version=(select count(*) from public.quotes prev where prev.booking_id=q.booking_id and (prev.created_at,prev.id)<=(q.created_at,q.id));
create unique index quotes_booking_version on public.quotes(booking_id,version);
alter table public.payments add column purpose text not null default 'deposit' check(purpose in ('inspection','deposit','milestone','balance')),
  add column processing_fee numeric(12,2) not null default 0 check(processing_fee>=0),
  add column manual_channel text check(manual_channel in ('cash','gcash','bank'));
alter table public.payments add column gateway_checkout_url text,add column gateway_checkout_claimed_at timestamptz;
update public.payments set purpose=kind::text;

create table public.project_documents (
  id uuid primary key default gen_random_uuid(),booking_id uuid not null references public.bookings(id),
  quote_id uuid not null references public.quotes(id),kind text not null check(kind in ('contract','change_order')),
  version integer not null,title text not null,body text not null,cost_delta numeric(12,2) not null default 0 check(cost_delta>=0),
  days_delta integer not null default 0 check(days_delta>=0),status text not null default 'issued' check(status in ('issued','accepted','declined','superseded')),
  issued_by uuid not null references public.profiles(id),accepted_by uuid references public.profiles(id),decided_at timestamptz,
  created_at timestamptz not null default now(),unique(booking_id,kind,version)
);
create table public.project_payment_installments (
  id uuid primary key default gen_random_uuid(),booking_id uuid not null references public.bookings(id),quote_id uuid not null references public.quotes(id),
  label text not null,amount numeric(12,2) not null check(amount>0),due_at timestamptz,milestone_id uuid references public.milestones(id),check(due_at is not null or milestone_id is not null)
);
alter table public.project_payment_installments enable row level security;
grant select on public.project_payment_installments to authenticated;
create policy "installments: issued quote parties" on public.project_payment_installments for select to authenticated using(public.is_admin() or public.is_booking_customer(booking_id));
create table public.booking_requests (
  id uuid primary key default gen_random_uuid(),booking_id uuid not null references public.bookings(id),author_id uuid not null references public.profiles(id),
  kind text not null check(kind in ('cancellation','clarification','change','dispute','refund')),
  note text not null,amount numeric(12,2),payment_id uuid references public.payments(id),
  status text not null default 'requested' check(status in ('requested','approved','denied','resolved','settled')),
  decision_note text,decided_by uuid references public.profiles(id),reference text,created_at timestamptz not null default now(),decided_at timestamptz,
  request_key uuid not null unique
);
create table public.manual_payment_claims (
  id uuid primary key default gen_random_uuid(),booking_id uuid not null references public.bookings(id),customer_id uuid not null references public.profiles(id),
  purpose text not null check(purpose in ('inspection','deposit','milestone','balance')),amount numeric(12,2) not null check(amount>0),
  method text not null check(method in ('cash','gcash','bank')),reference text not null,proof_path text,
  status text not null default 'pending' check(status in ('pending','verified','rejected')),
  payment_id uuid unique references public.payments(id),decision_note text,verified_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),request_key uuid not null unique
);
create unique index verified_manual_reference on public.manual_payment_claims(method,reference) where status='verified';
create table public.payment_events (
  id uuid primary key default gen_random_uuid(),booking_id uuid not null references public.bookings(id),payment_id uuid references public.payments(id),
  kind text not null,amount numeric(12,2) not null,reference text,actor_id uuid references public.profiles(id),created_at timestamptz not null default now()
);
create trigger payment_events_immutable before update or delete on public.payment_events for each row execute function public.block_row_change();
create table public.booking_turnovers (
  booking_id uuid primary key references public.bookings(id),customer_id uuid not null references public.profiles(id),
  notes text not null default '',acknowledged_at timestamptz not null default now()
);
create trigger booking_turnovers_immutable before update or delete on public.booking_turnovers for each row execute function public.block_row_change();
create table public.company_reviews (
  id uuid primary key default gen_random_uuid(),booking_id uuid not null unique references public.bookings(id),customer_id uuid not null references public.profiles(id),
  stars integer not null check(stars between 1 and 5),comment text not null default '',publish boolean not null default false,
  attribution text not null default 'anonymous' check(attribution in ('anonymous','first_name','no_quote')),
  hidden boolean not null default false,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.company_review_edits (
  id uuid primary key default gen_random_uuid(),review_id uuid not null references public.company_reviews(id),snapshot jsonb not null,edited_at timestamptz not null default now()
);
create trigger company_review_edits_immutable before update or delete on public.company_review_edits for each row execute function public.block_row_change();
create table public.project_publication_consents (
  booking_id uuid primary key references public.bookings(id),customer_id uuid not null references public.profiles(id),
  photos_allowed boolean not null default false,updated_at timestamptz not null default now()
);
create table public.project_portfolio_entries (
  id uuid primary key default gen_random_uuid(),booking_id uuid not null references public.bookings(id),title text not null,description text not null,
  photo_paths text[] not null,published boolean not null default false,privacy_checked_by uuid not null references public.profiles(id),created_at timestamptz not null default now()
);

do $$ declare t text; begin
  foreach t in array array['project_documents','booking_requests','manual_payment_claims','payment_events','booking_turnovers','company_reviews','company_review_edits','project_publication_consents','project_portfolio_entries'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('grant select on public.%I to authenticated',t);
  end loop;
end $$;
create policy "documents: customer or admin" on public.project_documents for select to authenticated using(public.is_admin() or public.is_booking_customer(booking_id));
create policy "requests: customer or admin" on public.booking_requests for select to authenticated using(public.is_admin() or public.is_booking_customer(booking_id));
create policy "claims: customer or admin" on public.manual_payment_claims for select to authenticated using(public.is_admin() or customer_id=auth.uid());
create policy "ledger: customer or admin" on public.payment_events for select to authenticated using(public.is_admin() or public.is_booking_customer(booking_id));
create policy "turnover: booking party" on public.booking_turnovers for select to authenticated using(public.is_admin() or public.is_booking_customer(booking_id) or public.is_booking_provider(booking_id));
create policy "company reviews: customer or admin" on public.company_reviews for select to authenticated using(public.is_admin() or customer_id=auth.uid());
create policy "review edits: admin" on public.company_review_edits for select to authenticated using(public.is_admin());
create policy "publication consent: customer or admin" on public.project_publication_consents for select to authenticated using(public.is_admin() or customer_id=auth.uid());
create policy "portfolio: admin" on public.project_portfolio_entries for select to authenticated using(public.is_admin());

create function public.refresh_official_booking_status() returns trigger language plpgsql set search_path='' as $$
begin
  new.official_status:=case when new.status='cancelled' then 'Cancelled'
    when new.status in ('done','signed','balance_paid','completed') then 'Completed'
    when new.status='in_progress' then 'Ongoing'
    when new.execution_confirmed_at is not null then 'Assigned'
    when new.admin_accepted_at is not null and new.schedule_confirmed_at is not null then 'Accepted' else 'Pending' end;
  return new;
end $$;
create trigger bookings_official_status before insert or update on public.bookings for each row execute function public.refresh_official_booking_status();
update public.bookings set admin_accepted_at=case when schedule_confirmed_at is not null then schedule_confirmed_at else null end,
  execution_confirmed_at=case when status in ('scheduled','on_the_way','in_progress','done','signed','balance_paid','completed') then schedule_confirmed_at else null end;

create function public.net_booking_paid(p_booking uuid) returns numeric language sql stable security definer set search_path='' as $$
  select coalesce((select sum(amount-refunded_amount) from public.payments where booking_id=p_booking and status in ('paid','partially_refunded')),0)
    +coalesce((select sum(amount) from public.cash_records where booking_id=p_booking),0)
$$;
revoke all on function public.net_booking_paid(uuid) from public,anon,authenticated;
create function public.booking_payment_due(p_booking uuid,p_purpose text) returns numeric language plpgsql stable security definer set search_path='' as $$
declare b public.bookings%rowtype;q public.quotes%rowtype;paid numeric;
begin
  select * into b from public.bookings where id=p_booking;
  paid:=public.net_booking_paid(p_booking);
  if b.status in ('draft','cancelled') then return 0; end if;
  if p_purpose='inspection' then return case when b.admin_accepted_at is null then 0 else least(greatest(0,b.inspection_fee-coalesce((select sum(amount-refunded_amount) from public.payments where booking_id=p_booking and purpose='inspection' and status in ('paid','partially_refunded')),0)),case when exists(select 1 from public.quotes where booking_id=p_booking and status='accepted') then greatest(0,b.quote_total-paid) else b.inspection_fee end) end; end if;
  select * into q from public.quotes where booking_id=p_booking and status='accepted' order by version desc limit 1;
  if not found then return 0; end if;
  if p_purpose='deposit' then return greatest(0,coalesce(q.deposit_amount,0)-paid); end if;
  if p_purpose='milestone' then return greatest(0,least(coalesce(b.quote_total,q.amount),coalesce(q.deposit_amount,0)+coalesce((select sum(i.amount) from public.project_payment_installments i where i.quote_id=q.id and (i.due_at is null or i.due_at<=now()) and (i.milestone_id is null or exists(select 1 from public.milestones m where m.id=i.milestone_id and m.status='confirmed'))),0))-paid); end if;
  if p_purpose='balance' and b.status in ('done','signed','balance_paid','completed') then return greatest(0,coalesce(b.quote_total,q.amount)-paid); end if;
  return 0;
end $$;
revoke all on function public.booking_payment_due(uuid,text) from public,anon,authenticated;

create function public.guard_accepted_project_records() returns trigger language plpgsql set search_path='' as $$
begin
  if old.status='accepted' then raise exception 'Accepted documents are immutable. Issue a versioned change order' using errcode='42501'; end if;
  return new;
end $$;
create trigger quotes_accepted_immutable before update or delete on public.quotes for each row execute function public.guard_accepted_project_records();
create trigger documents_accepted_immutable before update or delete on public.project_documents for each row execute function public.guard_accepted_project_records();

-- One mutation boundary, with role, ownership, state and row-lock checks repeated in SQL.
create function public.managed_booking_action(p_booking uuid,p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare b public.bookings%rowtype;q public.quotes%rowtype;d public.project_documents%rowtype;c public.manual_payment_claims%rowtype;
  r public.company_reviews%rowtype;req public.booking_requests%rowtype;v_id uuid;v_total numeric;v_amount numeric;v_paid numeric;v_version integer;
  v_note text:=btrim(coalesce(p_data->>'note',''));v_admin boolean:=public.is_admin();item jsonb;v_path text;
begin
  if auth.uid() is null then raise exception 'Sign in first' using errcode='42501'; end if;
  select * into b from public.bookings where id=p_booking for update;
  if not found or not(v_admin or public.is_booking_customer(p_booking)) then raise exception 'Booking not found' using errcode='42501'; end if;
  if p_action like 'admin_%' and not v_admin then raise exception 'MAZ administrator access required' using errcode='42501'; end if;
  if p_action not like 'admin_%' and b.customer_id<>auth.uid() then raise exception 'Only the booking customer may decide this' using errcode='42501'; end if;
  v_paid:=public.net_booking_paid(p_booking);

  if p_action='admin_review' then
    if b.status not in ('open','offered','accepted') then raise exception 'Request is already in delivery'; end if;
    if length(v_note)<5 then raise exception 'Add the review decision or clarification'; end if;
    if p_data->>'decision'='accept' then
      update public.bookings set admin_accepted_at=coalesce(admin_accepted_at,now()),admin_review_note=v_note,
        inspection_required=coalesce((p_data->>'inspectionRequired')::boolean,false),inspection_fee=case when coalesce((p_data->>'chargeInspection')::boolean,false) then 1500 else 0 end,
        inspection_pay_before_visit=coalesce((p_data->>'payInspectionBeforeVisit')::boolean,false),
        contract_required=coalesce((p_data->>'contractRequired')::boolean,false) where id=p_booking;
    elsif p_data->>'decision'='clarify' then update public.bookings set admin_review_note=v_note,needs_admin=true where id=p_booking;
    elsif p_data->>'decision'='decline' then perform public.change_booking_status(p_booking,'cancelled',v_note);
    else raise exception 'Choose accept, clarify or decline'; end if;

  elsif p_action='admin_quote' then
    if b.admin_accepted_at is null or b.status not in ('accepted','quoted','open') then raise exception 'MAZ must accept the request before issuing a quote'; end if;
    if b.inspection_required and not exists(select 1 from public.provider_work_updates where booking_id=p_booking and kind='inspection' and review_status='approved') then raise exception 'Review inspection findings first'; end if;
    if exists(select 1 from public.quotes where booking_id=p_booking and status='accepted') then raise exception 'Use a change order for an accepted scope'; end if;
    if jsonb_typeof(p_data->'items')<>'array' or jsonb_array_length(p_data->'items') not between 1 and 30 then raise exception 'Add 1 to 30 quote items'; end if;
    v_total:=0;
    for item in select * from jsonb_array_elements(p_data->'items') loop
      if length(btrim(coalesce(item->>'description','')))<3 or (item->>'quantity')::numeric<=0 or (item->>'unitPrice')::numeric<0 then raise exception 'Check quote item descriptions, quantities and prices'; end if;
      v_total:=v_total+round((item->>'quantity')::numeric*(item->>'unitPrice')::numeric,2);
    end loop;
    v_amount:=(p_data->>'deposit')::numeric;
    if v_total<=0 or v_total>10000000 or v_amount is null or v_amount<0 or v_amount>v_total or length(v_note)<10 then raise exception 'Check total, required deposit and scope'; end if;
    if (p_data->>'expiresAt')::timestamptz<=now() then raise exception 'Set a future quote expiry'; end if;
    select coalesce(max(version),0)+1 into v_version from public.quotes where booking_id=p_booking;
    update public.quotes set status='superseded' where booking_id=p_booking and status in ('proposed','approved');
    insert into public.quotes(booking_id,proposed_by,amount,job_class,status,notes,approved_by,deposit_amount,expires_at,version,line_items)
      values(p_booking,auth.uid(),v_total,coalesce(b.job_class,'minor'),'approved',v_note,auth.uid(),v_amount,(p_data->>'expiresAt')::timestamptz,v_version,p_data->'items') returning id into v_id;
    update public.quotes set payment_schedule=coalesce(p_data->'schedule','[]') where id=v_id;
    for item in select * from jsonb_array_elements(coalesce(p_data->'schedule','[]')) loop
      if (item->>'milestoneId') is not null and not exists(select 1 from public.milestones where id=(item->>'milestoneId')::uuid and booking_id=p_booking) then raise exception 'Payment milestone must belong to this project'; end if;
      insert into public.project_payment_installments(booking_id,quote_id,label,amount,due_at,milestone_id) values(p_booking,v_id,item->>'label',(item->>'amount')::numeric,(item->>'dueAt')::timestamptz,(item->>'milestoneId')::uuid);
    end loop;
    if v_amount+coalesce((select sum(amount) from public.project_payment_installments where quote_id=v_id),0)>v_total then raise exception 'Deposit and installments cannot exceed the quotation total'; end if;
    update public.bookings set quote_total=v_total,deposit_amount=v_amount,payment_tier=null,gateway_fee=coalesce((p_data->>'gatewayFee')::numeric,0) where id=p_booking;
    if b.status='open' then perform public.change_booking_status(p_booking,'accepted','MAZ accepted scope for quotation'); end if;
    if b.status<>'quoted' then perform public.change_booking_status(p_booking,'quoted','MAZ issued quotation version '||v_version); end if;

  elsif p_action='respond_quote' then
    select * into q from public.quotes where id=(p_data->>'id')::uuid and booking_id=p_booking for update;
    if not found or q.status<>'approved' or q.version<>(p_data->>'version')::integer or q.expires_at<=now() then raise exception 'This quotation version is no longer open'; end if;
    update public.quotes set status=case when (p_data->>'accept')::boolean then 'accepted'::public.quote_status else 'declined'::public.quote_status end,
      accepted_by=case when (p_data->>'accept')::boolean then auth.uid() end,accepted_at=case when (p_data->>'accept')::boolean then now() end,decision_note=nullif(v_note,''),decided_at=now() where id=q.id;
    -- Declining a quotation does not silently cancel the parent request or charge a penalty.

  elsif p_action='admin_document' then
    select * into q from public.quotes where booking_id=p_booking and status='accepted' order by version desc limit 1;
    if not found then raise exception 'An accepted quotation is required'; end if;
    if p_data->>'kind' not in ('contract','change_order') or length(v_note)<10 or length(btrim(coalesce(p_data->>'title','')))<3 then raise exception 'Add document kind, title and full terms'; end if;
    if p_data->>'kind'='contract' and exists(select 1 from public.project_documents where booking_id=p_booking and kind='contract' and status='accepted') then raise exception 'Use a change order to revise an accepted contract'; end if;
    select coalesce(max(version),0)+1 into v_version from public.project_documents where booking_id=p_booking and kind=p_data->>'kind';
    update public.project_documents set status='superseded' where booking_id=p_booking and kind=p_data->>'kind' and status='issued';
    insert into public.project_documents(booking_id,quote_id,kind,version,title,body,cost_delta,days_delta,issued_by)
      values(p_booking,q.id,p_data->>'kind',v_version,p_data->>'title',v_note,case when p_data->>'kind'='change_order' then coalesce((p_data->>'costDelta')::numeric,0) else 0 end,coalesce((p_data->>'daysDelta')::integer,0),auth.uid()) returning id into v_id;

  elsif p_action='respond_document' then
    select * into d from public.project_documents where id=(p_data->>'id')::uuid and booking_id=p_booking for update;
    if not found or d.status<>'issued' or d.version<>(p_data->>'version')::integer then raise exception 'Document version is no longer open'; end if;
    update public.project_documents set status=case when (p_data->>'accept')::boolean then 'accepted' else 'declined' end,accepted_by=auth.uid(),decided_at=now() where id=d.id;
    if (p_data->>'accept')::boolean and d.kind='change_order' then update public.bookings set quote_total=coalesce(quote_total,0)+d.cost_delta where id=p_booking; end if;

  elsif p_action='manual_payment' then
    select id into v_id from public.manual_payment_claims where request_key=(p_data->>'key')::uuid and customer_id=auth.uid();
    if found then return jsonb_build_object('ok',true,'id',v_id); end if;
    v_amount:=(p_data->>'amount')::numeric;
    if v_amount is null or v_amount<=0 or v_amount>public.booking_payment_due(p_booking,p_data->>'purpose') then raise exception 'Amount exceeds the currently payable requirement'; end if;
    if p_data->>'method' not in ('cash','gcash','bank') or length(btrim(coalesce(p_data->>'reference','')))<3 then raise exception 'Add payment channel and reference'; end if;
    v_path:=nullif(p_data->>'proofPath','');
    if p_data->>'method'<>'cash' and (v_path is null or v_path not like p_booking::text||'/'||auth.uid()::text||'/%' or not exists(select 1 from storage.objects where bucket_id='receipts' and name=v_path and owner_id=auth.uid()::text)) then raise exception 'Upload your payment proof privately for this booking'; end if;
    insert into public.manual_payment_claims(booking_id,customer_id,purpose,amount,method,reference,proof_path,request_key)
      values(p_booking,auth.uid(),p_data->>'purpose',v_amount,p_data->>'method',btrim(p_data->>'reference'),v_path,(p_data->>'key')::uuid) returning id into v_id;

  elsif p_action='admin_verify_payment' then
    select * into c from public.manual_payment_claims where id=(p_data->>'id')::uuid and booking_id=p_booking for update;
    if not found or c.status<>'pending' then raise exception 'Payment claim is no longer pending'; end if;
    if length(v_note)<5 then raise exception 'Record how receipt of funds was checked'; end if;
    if not (p_data->>'approve')::boolean then update public.manual_payment_claims set status='rejected',decision_note=v_note,verified_by=auth.uid() where id=c.id;
    else
      if c.amount>public.booking_payment_due(p_booking,c.purpose) then raise exception 'This amount is no longer due. Reconcile existing payments first'; end if;
      insert into public.payments(booking_id,kind,purpose,amount,status,method,manual_channel,paid_at)
        values(p_booking,case when c.purpose='inspection' then 'deposit'::public.payment_kind else c.purpose::public.payment_kind end,c.purpose,c.amount,'paid',case when c.method='cash' then 'cash'::public.payment_method when c.method='gcash' then 'gcash'::public.payment_method else null end,c.method,now()) returning id into v_id;
      update public.manual_payment_claims set status='verified',payment_id=v_id,decision_note=v_note,verified_by=auth.uid() where id=c.id;
      insert into public.payment_events(booking_id,payment_id,kind,amount,reference,actor_id) values(p_booking,v_id,'manual_payment_verified',c.amount,c.reference,auth.uid());
      insert into public.receipts(booking_id,payment_id,kind,amount) values(p_booking,v_id,case when c.purpose='inspection' then 'deposit' else c.purpose end,c.amount);
      if c.purpose='deposit' and b.status='quoted' and public.booking_payment_due(p_booking,'deposit')=0 then perform public.change_booking_status(p_booking,'deposit_paid','MAZ verified the required payment'); end if;
    end if;

  elsif p_action='customer_request' then
    if length(v_note)<10 or p_data->>'kind' not in ('cancellation','clarification','change','dispute','refund') then raise exception 'Choose a request type and explain what MAZ should review'; end if;
    if p_data->>'kind'='refund' and not exists(select 1 from public.payments where id=(p_data->>'paymentId')::uuid and booking_id=p_booking and status in ('paid','partially_refunded') and (p_data->>'amount')::numeric>0 and (p_data->>'amount')::numeric<=amount-refunded_amount) then raise exception 'Choose a verified payment and refundable amount'; end if;
    insert into public.booking_requests(booking_id,author_id,kind,note,amount,payment_id,request_key)
      values(p_booking,auth.uid(),p_data->>'kind',v_note,(p_data->>'amount')::numeric,(p_data->>'paymentId')::uuid,(p_data->>'key')::uuid)
      on conflict(request_key) do nothing returning id into v_id;

  elsif p_action='admin_resolve_request' then
    select * into req from public.booking_requests where id=(p_data->>'id')::uuid and booking_id=p_booking for update;
    if not found or req.status<>'requested' or length(v_note)<10 then raise exception 'Select an open request and record the decision'; end if;
    if (p_data->>'approve')::boolean and req.kind='cancellation' then
      if b.status in ('done','signed','balance_paid','completed','cancelled') then raise exception 'Use the dispute/refund process for finished work'; end if;
      perform public.change_booking_status(p_booking,'cancelled',v_note||case when v_paid>0 then ' | Verified payments require separate refund review.' else '' end);
    end if;
    update public.booking_requests set status=case when (p_data->>'approve')::boolean then 'approved' else 'denied' end,decision_note=v_note,decided_by=auth.uid(),decided_at=now() where id=req.id;

  elsif p_action='admin_record_refund' then
    select * into req from public.booking_requests where id=(p_data->>'id')::uuid and booking_id=p_booking and kind='refund' for update;
    if not found or req.status<>'approved' or length(v_note)<10 or length(btrim(coalesce(p_data->>'reference','')))<3 then raise exception 'Approve the refund and record its verified settlement reference'; end if;
    if exists(select 1 from public.payments where id=req.payment_id and paymongo_payment_id is not null) then raise exception 'PayMongo refunds must be verified through the gateway refund process'; end if;
    if not exists(select 1 from public.payments where id=req.payment_id and booking_id=p_booking and req.amount<=amount-refunded_amount for update) then raise exception 'Refund exceeds the remaining paid amount'; end if;
    update public.payments set refunded_amount=refunded_amount+req.amount,status=case when refunded_amount+req.amount=amount then 'refunded'::public.payment_status else 'partially_refunded'::public.payment_status end where id=req.payment_id;
    update public.booking_requests set status='settled',decision_note=v_note,reference=p_data->>'reference',decided_at=now() where id=req.id;
    insert into public.payment_events(booking_id,payment_id,kind,amount,reference,actor_id) values(p_booking,req.payment_id,'refund_settled',-req.amount,p_data->>'reference',auth.uid());

  elsif p_action='turnover' then
    if b.status<>'done' then raise exception 'MAZ must verify completion before turnover'; end if;
    insert into public.booking_turnovers(booking_id,customer_id,notes) values(p_booking,auth.uid(),v_note);
    perform public.change_booking_status(p_booking,'signed','Customer acknowledged turnover');
  elsif p_action='admin_close' then
    if b.status<>'signed' or v_paid<coalesce(b.quote_total,0) then raise exception 'Customer turnover and full verified settlement are required'; end if;
    perform public.change_booking_status(p_booking,'balance_paid','MAZ reconciled final balance');
    perform public.change_booking_status(p_booking,'completed','MAZ closed the project');
  elsif p_action='admin_start' then
    if b.status<>'scheduled' or b.scheduled_start is null or (b.scheduled_start at time zone 'Asia/Manila')::date>(now() at time zone 'Asia/Manila')::date then raise exception 'Work must have a confirmed appointment that is due'; end if;
    perform public.change_booking_status(p_booking,'in_progress','MAZ authorized execution');
  elsif p_action='admin_finish' then
    perform public.approve_provider_project_completion(p_booking);

  elsif p_action='company_review' then
    if b.status not in ('done','signed','balance_paid','completed') then raise exception 'Reviews open after verified completion'; end if;
    select * into r from public.company_reviews where booking_id=p_booking for update;
    if found then
      if r.created_at+interval '14 days'<now() then raise exception 'The 14-day review edit window has ended'; end if;
      insert into public.company_review_edits(review_id,snapshot) values(r.id,to_jsonb(r));
      update public.company_reviews set stars=(p_data->>'stars')::integer,comment=left(v_note,2000),publish=coalesce((p_data->>'publish')::boolean,false),attribution=coalesce(p_data->>'attribution','anonymous'),updated_at=now() where id=r.id;
    else insert into public.company_reviews(booking_id,customer_id,stars,comment,publish,attribution) values(p_booking,auth.uid(),(p_data->>'stars')::integer,left(v_note,2000),coalesce((p_data->>'publish')::boolean,false),coalesce(p_data->>'attribution','anonymous')) returning id into v_id; end if;
  elsif p_action='portfolio_consent' then
    insert into public.project_publication_consents(booking_id,customer_id,photos_allowed) values(p_booking,auth.uid(),coalesce((p_data->>'allow')::boolean,false))
      on conflict(booking_id) do update set photos_allowed=excluded.photos_allowed,updated_at=now();
    if not (p_data->>'allow')::boolean then update public.project_portfolio_entries set published=false where booking_id=p_booking; end if;
  elsif p_action='admin_publish' then
    if b.status not in ('done','signed','balance_paid','completed') or not exists(select 1 from public.project_publication_consents where booking_id=p_booking and photos_allowed) then raise exception 'Verified completion and separate photo consent are required'; end if;
    if (p_data->>'privacyChecked')::boolean is distinct from true or length(v_note)<10 or length(btrim(coalesce(p_data->>'title','')))<3 then raise exception 'Review images for identities and addresses, and add a public-safe description'; end if;
    if jsonb_array_length(p_data->'photos') not between 1 and 10 then raise exception 'Choose 1 to 10 approved project photos'; end if;
    for v_path in select jsonb_array_elements_text(p_data->'photos') loop
      if not exists(select 1 from public.provider_work_updates u where u.booking_id=p_booking and u.review_status='approved' and v_path=any(u.photo_paths)) then raise exception 'Select evidence already reviewed for this project'; end if;
    end loop;
    insert into public.project_portfolio_entries(booking_id,title,description,photo_paths,published,privacy_checked_by)
      values(p_booking,p_data->>'title',v_note,array(select jsonb_array_elements_text(p_data->'photos')),true,auth.uid()) returning id into v_id;
  else raise exception 'Unknown workflow action'; end if;
  perform public.write_audit(auth.uid(),'workflow.'||p_action,'bookings',p_booking::text,null,jsonb_build_object('record_id',v_id,'action',p_action));
  insert into public.notifications(profile_id,event,title,body,link)
    select p.id,'workflow.'||p_action,case when v_admin then 'MAZ updated your booking' else 'Customer booking action needs review' end,
      replace(p_action,'_',' '),case when v_admin then '/customer/bookings/' else '/admin/bookings/' end||p_booking
    from public.profiles p where (v_admin and p.id=b.customer_id) or (not v_admin and p.role='admin');
  return jsonb_build_object('ok',true,'id',v_id);
end $$;
revoke all on function public.managed_booking_action(uuid,text,jsonb) from public,anon;
grant execute on function public.managed_booking_action(uuid,text,jsonb) to authenticated;

-- Confirmations keep provider scheduling, customer consent and the explicit contract connected.
alter function public.confirm_maz_appointment(uuid,uuid) rename to confirm_maz_appointment_provider_v1;
revoke all on function public.confirm_maz_appointment_provider_v1(uuid,uuid) from public,anon,authenticated;
create function public.confirm_maz_appointment(p_booking uuid,p_lead uuid) returns void language plpgsql security definer set search_path='' as $$
declare b public.bookings%rowtype;
begin
  if not public.is_admin() then raise exception 'MAZ administrator required' using errcode='42501'; end if;
  select * into b from public.bookings where id=p_booking for update;
  if b.admin_accepted_at is null then raise exception 'Review and accept this request first'; end if;
  if exists(select 1 from public.quotes where booking_id=p_booking and status='accepted') and b.contract_required and not exists(select 1 from public.project_documents where booking_id=p_booking and kind='contract' and status='accepted') then raise exception 'Customer must accept the contract before execution'; end if;
  if b.inspection_pay_before_visit and b.inspection_required and b.inspection_fee>0 and not exists(select 1 from public.quotes where booking_id=p_booking and status='accepted') and public.booking_payment_due(p_booking,'inspection')>0 then raise exception 'Verify the disclosed inspection fee before the chargeable visit'; end if;
  perform public.confirm_maz_appointment_provider_v1(p_booking,p_lead);
  update public.bookings set admin_accepted_at=coalesce(admin_accepted_at,now()),execution_confirmed_at=case when status='scheduled' then now() else execution_confirmed_at end where id=p_booking;
end $$;
revoke all on function public.confirm_maz_appointment(uuid,uuid) from public,anon;
grant execute on function public.confirm_maz_appointment(uuid,uuid) to authenticated;

create function public.public_company_reviews(p_service uuid default null)
returns table(stars integer,comment text,attribution text,created_at timestamptz) language sql stable security definer set search_path='' as $$
  select r.stars,case when r.attribution='no_quote' then '' else left(r.comment,700) end,
    case when r.attribution='first_name' then p.first_name else 'Anonymous customer' end,r.created_at
  from public.company_reviews r join public.bookings b on b.id=r.booking_id join public.profiles p on p.id=r.customer_id
  where r.publish and not r.hidden and b.official_status='Completed' and (p_service is null or b.service_id=p_service) order by r.created_at desc limit 30
$$;
revoke all on function public.public_company_reviews(uuid) from public;
grant execute on function public.public_company_reviews(uuid) to anon,authenticated;
create function public.public_project_portfolio(p_service uuid default null)
returns table(id uuid,title text,description text,photo_count integer) language sql stable security definer set search_path='' as $$
  select e.id,e.title,e.description,cardinality(e.photo_paths) from public.project_portfolio_entries e
  join public.bookings b on b.id=e.booking_id join public.project_publication_consents c on c.booking_id=b.id
  where e.published and c.photos_allowed and b.official_status='Completed' and (p_service is null or b.service_id=p_service) order by e.created_at desc limit 30
$$;
revoke all on function public.public_project_portfolio(uuid) from public;
grant execute on function public.public_project_portfolio(uuid) to anon,authenticated;

insert into public.booking_status_moves(from_status,to_status,actors) values ('scheduled','in_progress',array['admin']) on conflict do nothing;
create function public.guard_managed_execution() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.status='in_progress' and old.status<>'in_progress' then
    if new.execution_confirmed_at is null or not exists(select 1 from public.quotes where booking_id=new.id and status='accepted') or public.booking_payment_due(new.id,'deposit')>0 then raise exception 'Confirmed team, customer-approved scope and verified required payment are necessary before work starts'; end if;
    if new.contract_required and not exists(select 1 from public.project_documents where booking_id=new.id and kind='contract' and status='accepted') then raise exception 'Customer contract approval is required'; end if;
  end if;
  if new.status='signed' and old.status<>'signed' and not exists(select 1 from public.booking_turnovers where booking_id=new.id) then raise exception 'Record customer turnover acknowledgment first'; end if;
  if new.status='done' and old.status<>'done' then
    if not public.is_admin() then raise exception 'MAZ completion approval required' using errcode='42501'; end if;
    if exists(select 1 from public.provider_assignments where booking_id=new.id and phase='execution' and status in ('offered','accepted','withdrawal_requested')) or exists(select 1 from public.milestones where booking_id=new.id and status<>'confirmed') then raise exception 'Review team completions and all milestones first'; end if;
    if not exists(select 1 from public.provider_work_updates where booking_id=new.id and kind='completion' and review_status='approved' and provider_id=new.provider_id) then raise exception 'Approved lead completion evidence required'; end if;
  end if;
  if new.status in ('balance_paid','completed') and old.status is distinct from new.status and (not exists(select 1 from public.booking_turnovers where booking_id=new.id) or public.net_booking_paid(new.id)<coalesce(new.quote_total,0)) then raise exception 'Turnover and full verified settlement are required'; end if;
  return new;
end $$;
create trigger bookings_managed_execution before update of status on public.bookings for each row execute function public.guard_managed_execution();
create policy "documents: providers read accepted scope" on public.project_documents for select to authenticated using(status='accepted' and public.is_booking_provider(booking_id));

create function public.managed_booking_summary(p_booking uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare b public.bookings%rowtype;team jsonb;
begin
  select * into b from public.bookings where id=p_booking;
  if not found or not(public.is_admin() or public.is_booking_customer(p_booking)) then raise exception 'Booking access denied' using errcode='42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('provider_id',a.provider_id,'name',concat_ws(' ',p.first_name,p.last_name),'trade',a.trade,'phase',a.phase,'status',a.status,'starts_at',a.starts_at,'ends_at',a.ends_at)),'[]') into team
    from public.provider_assignments a join public.profiles p on p.id=a.provider_id where a.booking_id=p_booking and (public.is_admin() or (((a.phase='inspection' and b.schedule_confirmed_at is not null) or (a.phase='execution' and b.execution_confirmed_at is not null)) and a.status in ('accepted','completed','withdrawal_requested')));
  return jsonb_build_object('net_paid',public.net_booking_paid(p_booking),'inspection_due',public.booking_payment_due(p_booking,'inspection'),
    'deposit_due',public.booking_payment_due(p_booking,'deposit'),'milestone_due',public.booking_payment_due(p_booking,'milestone'),'balance_due',public.booking_payment_due(p_booking,'balance'),'team',team);
end $$;
revoke all on function public.managed_booking_summary(uuid) from public,anon;
grant execute on function public.managed_booking_summary(uuid) to authenticated;

create function public.start_managed_payment(p_booking uuid,p_purpose text,p_fee_accepted boolean) returns public.payments
language plpgsql security definer set search_path='' as $$
declare b public.bookings%rowtype;p public.payments%rowtype;due numeric;
begin
  select * into b from public.bookings where id=p_booking for update;
  if not found or not public.is_booking_customer(p_booking) then raise exception 'Booking access denied' using errcode='42501'; end if;
  due:=public.booking_payment_due(p_booking,p_purpose);
  if due<=0 then raise exception 'No payment is currently due for that purpose'; end if;
  if p_fee_accepted is distinct from true then raise exception 'Review the service amount and disclosed processing fee'; end if;
  select * into p from public.payments where booking_id=p_booking and purpose=p_purpose and status='pending' and manual_channel is null order by created_at desc limit 1;
  if found and (p.amount<>due or p.processing_fee<>b.gateway_fee) then raise exception 'An earlier checkout has a different amount. MAZ must reconcile it before another charge'; end if;
  if not found then
    insert into public.payments(booking_id,kind,purpose,amount,processing_fee) values(p_booking,case when p_purpose='inspection' then 'deposit'::public.payment_kind else p_purpose::public.payment_kind end,p_purpose,due,b.gateway_fee) returning * into p;
  end if;
  return p;
end $$;
revoke all on function public.start_managed_payment(uuid,text,boolean) from public,anon;
grant execute on function public.start_managed_payment(uuid,text,boolean) to authenticated;

create function public.confirm_managed_gateway_payment(p_payment uuid,p_remote text,p_amount numeric,p_currency text,p_method public.payment_method)
returns void language plpgsql security definer set search_path='' as $$
declare p public.payments%rowtype;b public.bookings%rowtype;
begin
  if auth.role()<>'service_role' then raise exception 'Verified gateway server only' using errcode='42501'; end if;
  select * into p from public.payments where id=p_payment for update;
  if not found or p.manual_channel is not null then raise exception 'Gateway payment record not found'; end if;
  if p.status='paid' then return; end if;
  if p_currency<>'PHP' or p_amount<>p.amount+p.processing_fee or p_remote is null then raise exception 'Gateway currency, amount or payment identifier does not match'; end if;
  select * into b from public.bookings where id=p.booking_id for update;
  update public.payments set status='paid',method=p_method,paid_at=now(),paymongo_payment_id=p_remote where id=p.id;
  insert into public.payment_events(booking_id,payment_id,kind,amount,reference) values(p.booking_id,p.id,'gateway_verified',p.amount,p_remote);
  insert into public.receipts(booking_id,payment_id,kind,amount) values(p.booking_id,p.id,p.kind::text,p.amount);
  if p.purpose='deposit' and b.status='quoted' and public.booking_payment_due(b.id,'deposit')=0 then perform public.change_booking_status(b.id,'deposit_paid','Verified PayMongo payment'); end if;
end $$;
revoke all on function public.confirm_managed_gateway_payment(uuid,text,numeric,text,public.payment_method) from public,anon,authenticated;
grant execute on function public.confirm_managed_gateway_payment(uuid,text,numeric,text,public.payment_method) to service_role;

alter table public.booking_requests add column gateway_refund_id text unique;
create function public.settle_verified_gateway_refund(p_request uuid,p_remote text,p_payment_remote text,p_amount numeric,p_actor uuid)
returns void language plpgsql security definer set search_path='' as $$
declare r public.booking_requests%rowtype;p public.payments%rowtype;bid uuid;
begin
  if auth.role()<>'service_role' or not exists(select 1 from public.profiles where id=p_actor and role='admin') then raise exception 'Verified gateway server and MAZ administrator required' using errcode='42501'; end if;
  select booking_id into bid from public.booking_requests where id=p_request;
  perform 1 from public.bookings where id=bid for update;
  select * into r from public.booking_requests where id=p_request and kind='refund' for update;
  if r.status='settled' and r.gateway_refund_id=p_remote then return; end if;
  if r.status is distinct from 'approved' or r.amount is distinct from p_amount or p_remote is null then raise exception 'Approved refund amount does not match'; end if;
  select * into p from public.payments where id=r.payment_id and booking_id=r.booking_id for update;
  if not found or p.paymongo_payment_id is distinct from p_payment_remote or p_amount>p.amount-p.refunded_amount then raise exception 'Refund does not match the remaining gateway payment'; end if;
  update public.payments set refunded_amount=refunded_amount+p_amount,status=case when refunded_amount+p_amount=amount then 'refunded'::public.payment_status else 'partially_refunded'::public.payment_status end where id=p.id;
  update public.booking_requests set status='settled',reference=p_remote,gateway_refund_id=p_remote,decided_at=now() where id=r.id;
  insert into public.payment_events(booking_id,payment_id,kind,amount,reference,actor_id) values(r.booking_id,p.id,'gateway_refund_verified',-p_amount,p_remote,p_actor);
  perform public.write_audit(p_actor,'payment.refund_verified','booking_requests',r.id::text,null,jsonb_build_object('reference',p_remote,'amount',p_amount));
  insert into public.notifications(profile_id,event,title,body,link) select customer_id,'payment.refund_verified','MAZ verified your refund','The gateway confirmed the approved refund. Bank or wallet posting times vary.','/customer/bookings/'||bid from public.bookings where id=bid;
end $$;
revoke all on function public.settle_verified_gateway_refund(uuid,text,text,numeric,uuid) from public,anon,authenticated;
grant execute on function public.settle_verified_gateway_refund(uuid,text,text,numeric,uuid) to service_role;
revoke execute on function public.start_deposit_payment(uuid) from authenticated;

-- Retire customer/provider mutations whose old semantics conflict with the shared workflow.
revoke execute on function public.respond_to_quote(uuid,boolean,text) from authenticated;
revoke execute on function public.propose_quote(uuid,numeric,public.job_class,text,jsonb) from authenticated;
revoke execute on function public.decide_quote(uuid,boolean,text,public.job_class) from authenticated;
do $$ begin if to_regprocedure('public.submit_review(uuid,integer,text)') is not null then execute 'revoke execute on function public.submit_review(uuid,integer,text) from authenticated'; end if; end $$;
create or replace function public.public_service_reviews(p_service_id uuid)
returns table(stars integer,comment text,created_at timestamptz) language sql stable security definer set search_path='' as $$
  select r.stars,r.comment,r.created_at from public.public_company_reviews(p_service_id) r
$$;

alter table public.services add column inspection_policy text not null default 'not_required' check(inspection_policy in ('not_required','free','chargeable')),
  add column inspection_due_point text not null default 'admin_agreed' check(inspection_due_point in ('admin_agreed','before_visit'));
create table public.maz_payment_instructions(method text primary key check(method in ('cash','gcash','bank')),instructions text not null,updated_at timestamptz not null default now());
alter table public.maz_payment_instructions enable row level security;
grant select on public.maz_payment_instructions to authenticated;
create policy "payment instructions: customer or admin" on public.maz_payment_instructions for select to authenticated using(public.current_user_role()='customer' or public.is_admin());
create function public.configure_managed_service(p_service uuid,p_policy text,p_due text) returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.is_admin() then raise exception 'MAZ administrator required' using errcode='42501'; end if;
  update public.services set inspection_policy=p_policy,inspection_due_point=p_due where id=p_service;
  if not found then raise exception 'Service not found'; end if;
  perform public.write_audit(auth.uid(),'service.inspection_policy','services',p_service::text,null,jsonb_build_object('policy',p_policy,'due',p_due));
end $$;
revoke all on function public.configure_managed_service(uuid,text,text) from public,anon;
grant execute on function public.configure_managed_service(uuid,text,text) to authenticated;
create function public.configure_maz_payment_instructions(p_method text,p_instructions text) returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.is_admin() then raise exception 'MAZ administrator required' using errcode='42501'; end if;
  if length(btrim(coalesce(p_instructions,''))) not between 10 and 2000 then raise exception 'Add verified MAZ payment instructions'; end if;
  insert into public.maz_payment_instructions(method,instructions) values(p_method,btrim(p_instructions)) on conflict(method) do update set instructions=excluded.instructions,updated_at=now();
  perform public.write_audit(auth.uid(),'payment.instructions_updated','maz_payment_instructions',p_method,null,'{}');
end $$;
revoke all on function public.configure_maz_payment_instructions(text,text) from public,anon;
grant execute on function public.configure_maz_payment_instructions(text,text) to authenticated;

alter function public.submit_booking(uuid,boolean) rename to submit_booking_request_v1;
revoke all on function public.submit_booking_request_v1(uuid,boolean) from public,anon,authenticated;
create function public.submit_booking(p_booking_id uuid,p_terms_accepted boolean) returns public.booking_status language plpgsql security definer set search_path='' as $$
declare b public.bookings%rowtype;s public.services%rowtype;result public.booking_status;
begin
  select * into b from public.bookings where id=p_booking_id for update;
  if not found or not public.is_booking_customer(b.id) then raise exception 'Only the draft owner may submit' using errcode='42501'; end if;
  if b.status<>'draft' then return b.status; end if;
  select * into s from public.services where id=b.service_id;
  update public.bookings set inspection_required=s.inspection_policy<>'not_required',inspection_fee=case when s.inspection_policy='chargeable' then 1500 else 0 end,
    inspection_pay_before_visit=s.inspection_due_point='before_visit',needs_admin=true,needs_admin_reason='MAZ must review and confirm the requested appointment' where id=b.id;
  result:=public.submit_booking_request_v1(p_booking_id,p_terms_accepted);
  insert into public.notifications(profile_id,event,title,body,link) select id,'booking.pending_review','New service request','Review scope, coverage and proposed schedule.','/admin/bookings/'||b.id from public.profiles where role='admin';
  return result;
end $$;
revoke all on function public.submit_booking(uuid,boolean) from public,anon;
grant execute on function public.submit_booking(uuid,boolean) to authenticated;

alter function public.prepare_maz_quote(uuid,numeric,numeric,text,timestamptz) rename to prepare_maz_quote_provider_v1;
revoke all on function public.prepare_maz_quote_provider_v1(uuid,numeric,numeric,text,timestamptz) from public,anon,authenticated;
create function public.prepare_maz_quote(p_booking uuid,p_amount numeric,p_deposit numeric,p_notes text,p_expires timestamptz) returns jsonb language plpgsql security definer set search_path='' as $$
begin
  return public.managed_booking_action(p_booking,'admin_quote',jsonb_build_object('note',p_notes,'deposit',p_deposit,'gatewayFee',0,'expiresAt',p_expires,'items',jsonb_build_array(jsonb_build_object('description',p_notes,'quantity',1,'unitPrice',p_amount))));
end $$;
revoke all on function public.prepare_maz_quote(uuid,numeric,numeric,text,timestamptz) from public,anon;
grant execute on function public.prepare_maz_quote(uuid,numeric,numeric,text,timestamptz) to authenticated;

alter table public.bookings add column created_by uuid references public.profiles(id),add column source_channel text not null default 'web';
update public.booking_status_moves set actors=array(select distinct unnest(actors||array['admin'])) where from_status='draft' and to_status='open';
create function public.admin_create_managed_booking(p_customer uuid,p_service uuid,p_address uuid,p_description text,p_start timestamptz,p_source text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;s public.services%rowtype;
begin
  if not public.is_admin() then raise exception 'MAZ administrator required' using errcode='42501'; end if;
  if length(btrim(coalesce(p_description,'')))<10 or p_start<=now() or p_source not in ('phone','facebook','walk_in','referral') then raise exception 'Check request details, source and future requested appointment'; end if;
  if not exists(select 1 from public.profiles where id=p_customer and role='customer') or not exists(select 1 from public.addresses where id=p_address and profile_id=p_customer and location is not null) then raise exception 'Choose a customer and their covered address with a map pin'; end if;
  select * into s from public.services where id=p_service and active;
  if not found then raise exception 'Choose an active service'; end if;
  insert into public.bookings(customer_id,service_id,address_id,description,preferred_start,created_by,source_channel,job_class,needs_admin,inspection_required,inspection_fee,inspection_pay_before_visit)
    values(p_customer,p_service,p_address,btrim(p_description),p_start,auth.uid(),p_source,s.default_class,true,s.inspection_policy<>'not_required',case when s.inspection_policy='chargeable' then 1500 else 0 end,s.inspection_due_point='before_visit') returning id into v_id;
  perform public.change_booking_status(v_id,'open','MAZ recorded request from '||p_source);
  perform public.write_audit(auth.uid(),'booking.created_on_behalf','bookings',v_id::text,null,jsonb_build_object('source',p_source));
  return v_id;
end $$;
revoke all on function public.admin_create_managed_booking(uuid,uuid,uuid,text,timestamptz,text) from public,anon;
grant execute on function public.admin_create_managed_booking(uuid,uuid,uuid,text,timestamptz,text) to authenticated;

-- Customer quote history is visible after MAZ issuance, never a provider's unreviewed proposal.
create policy "quotes: customer reads issued history" on public.quotes for select to authenticated using(public.is_booking_customer(booking_id) and status in ('approved','accepted','declined','superseded','expired'));

update public.booking_status_moves set actors=array_remove(actors,'customer') where to_status='cancelled';
create or replace function public.reschedule_booking(p_booking_id uuid,p_preferred_start timestamptz) returns timestamptz language plpgsql security definer set search_path='' as $$
declare b public.bookings%rowtype;
begin
  select * into b from public.bookings where id=p_booking_id for update;
  if not found or not public.is_booking_customer(b.id) then raise exception 'Booking access denied' using errcode='42501'; end if;
  if b.status not in ('open','offered') or p_preferred_start is null or p_preferred_start<=now() then raise exception 'Choose a future requested appointment for a pending request'; end if;
  if exists(select 1 from public.bookings where id=p_booking_id and admin_accepted_at is not null) or exists(select 1 from public.provider_assignments where booking_id=p_booking_id and status in ('offered','accepted','withdrawal_requested')) then raise exception 'Request a schedule change through MAZ after review or assignment'; end if;
  update public.bookings set preferred_start=p_preferred_start where id=p_booking_id;
  perform public.write_audit(auth.uid(),'booking.requested_time_changed','bookings',p_booking_id::text,null,jsonb_build_object('requested_start',p_preferred_start));
  return p_preferred_start;
end $$;
revoke all on function public.reschedule_booking(uuid,timestamptz) from public,anon;
grant execute on function public.reschedule_booking(uuid,timestamptz) to authenticated;
drop policy if exists "reviews: read shown reviews or admin" on public.reviews;
create policy "legacy worker reviews: relevant parties only" on public.reviews for select to authenticated using(public.is_admin() or customer_id=auth.uid() or provider_id=auth.uid());

create function public.moderate_project_publication(p_kind text,p_id uuid,p_hide boolean,p_note text) returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.is_admin() then raise exception 'MAZ administrator required' using errcode='42501'; end if;
  if length(btrim(coalesce(p_note,'')))<10 then raise exception 'Record the privacy or moderation reason'; end if;
  if p_kind='review' then update public.company_reviews set hidden=p_hide where id=p_id;
  elsif p_kind='portfolio' and p_hide then update public.project_portfolio_entries set published=false where id=p_id;
  else raise exception 'Choose a review or unpublish a portfolio entry'; end if;
  if not found then raise exception 'Publication not found'; end if;
  perform public.write_audit(auth.uid(),'publication.moderated',p_kind,p_id::text,p_note,jsonb_build_object('hidden',p_hide));
end $$;
revoke all on function public.moderate_project_publication(text,uuid,boolean,text) from public,anon;
grant execute on function public.moderate_project_publication(text,uuid,boolean,text) to authenticated;
