-- Run after the migration inside BEGIN / ROLLBACK. All people and records are synthetic.
create function pg_temp.assert_ok(ok boolean, message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Assertion failed: %',message; end if; end $$;
create function pg_temp.as_user(person uuid) returns void language sql as $$
 select set_config('request.jwt.claims',jsonb_build_object('sub',person,'role','authenticated')::text,true)::text::void
$$;
create function pg_temp.expect_denied(booking uuid, action text, payload jsonb) returns void language plpgsql as $$
begin
  begin perform public.managed_booking_action(booking,action,payload);
  exception when others then return; end;
  raise exception 'Action unexpectedly allowed: %',action;
end $$;
create function pg_temp.expect_sql_denied(statement text) returns void language plpgsql as $$
begin
  begin execute statement; exception when others then return; end;
  raise exception 'Statement unexpectedly allowed';
end $$;
create temp table workflow_fixture_ids(customer uuid,worker uuid,stranger uuid,booking uuid);
grant select on workflow_fixture_ids to authenticated;
do $$
declare customer uuid:=gen_random_uuid();admin uuid:=gen_random_uuid();worker uuid:=gen_random_uuid();stranger uuid:=gen_random_uuid();
  address uuid:=gen_random_uuid();service uuid:=gen_random_uuid();booking uuid;cancel_booking uuid;quote uuid;document uuid;claim uuid;payment uuid;req uuid;result jsonb;key uuid:=gen_random_uuid();
begin
  insert into auth.users(id,email,raw_app_meta_data) values
    (customer,customer||'@workflow.invalid','{"role":"customer"}'),(admin,admin||'@workflow.invalid','{"role":"admin"}'),
    (worker,worker||'@workflow.invalid','{"role":"provider"}'),(stranger,stranger||'@workflow.invalid','{"role":"customer"}');
  insert into public.provider_profiles(profile_id,status) values(worker,'approved');
  insert into public.services(id,category,name,inspection_policy) values(service,'Test','Transactional workflow '||service,'chargeable');
  insert into public.provider_services values(worker,service);
  insert into public.addresses(id,profile_id,line1,city,location) values(address,customer,'Synthetic address','Pasig',extensions.st_setsrid(extensions.st_makepoint(121.08,14.57),4326)::extensions.geography);
  perform pg_temp.as_user(admin);
  booking:=public.admin_create_managed_booking(customer,service,address,'Synthetic repair request',now()+interval '2 days','phone');
  perform pg_temp.expect_denied(booking,'admin_quote',jsonb_build_object('note','Repair with materials and labor','items','[{"description":"Repair","quantity":1,"unitPrice":10000}]'::jsonb,'deposit',5000,'gatewayFee',0,'expiresAt',now()+interval '7 days'));
  perform public.managed_booking_action(booking,'admin_review','{"decision":"accept","note":"Coverage and scope reviewed","inspectionRequired":true,"chargeInspection":true,"payInspectionBeforeVisit":true,"contractRequired":true}');
  update public.services set inspection_policy='free' where id=service;
  perform pg_temp.expect_denied(booking,'admin_review','{"decision":"accept","note":"Cannot impose a fee on a free service","inspectionRequired":true,"chargeInspection":true,"payInspectionBeforeVisit":true,"contractRequired":true}');
  update public.services set inspection_policy='chargeable' where id=service;
  perform pg_temp.as_user(customer);
  perform pg_temp.assert_ok((public.managed_booking_summary(booking)->>'inspection_due')::numeric=1500,'selected inspection fee');
  result:=public.managed_booking_action(booking,'manual_payment',jsonb_build_object('purpose','inspection','amount',1500,'method','cash','reference','CASH-'||key,'key',key));claim:=(result->>'id')::uuid;
  perform public.managed_booking_action(booking,'manual_payment',jsonb_build_object('purpose','inspection','amount',1500,'method','cash','reference','CASH-'||key,'key',key));
  perform pg_temp.assert_ok((select count(*)=1 from public.manual_payment_claims where booking_id=booking),'claim retry is idempotent');
  perform pg_temp.assert_ok((public.managed_booking_summary(booking)->>'net_paid')::numeric=0,'unverified cash is not money received');
  perform pg_temp.expect_sql_denied(format('select public.start_managed_payment(%L,''inspection'',true)',booking));
  perform pg_temp.expect_denied(booking,'admin_verify_payment',jsonb_build_object('id',claim,'approve',true,'note','Not allowed customer verification'));
  perform pg_temp.as_user(admin);
  perform public.managed_booking_action(booking,'admin_verify_payment',jsonb_build_object('id',claim,'approve',true,'note','MAZ checked cash actually received'));
  insert into public.provider_work_updates(booking_id,provider_id,kind,notes,review_status,idempotency_key) values(booking,worker,'inspection','Approved synthetic inspection evidence','approved',gen_random_uuid());
  perform public.managed_booking_action(booking,'admin_quote',jsonb_build_object('note','Repair with materials and labor','items','[{"description":"Repair","quantity":1,"unitPrice":10000}]'::jsonb,'deposit',5000,'gatewayFee',25,'expiresAt',now()+interval '7 days'));
  select id into quote from public.quotes where booking_id=booking;
  perform pg_temp.as_user(customer);
  perform pg_temp.expect_denied(booking,'respond_quote',jsonb_build_object('id',quote,'version',2,'accept',true));
  perform public.managed_booking_action(booking,'respond_quote',jsonb_build_object('id',quote,'version',1,'accept',true));
  perform pg_temp.assert_ok((public.managed_booking_summary(booking)->>'deposit_due')::numeric=3500,'inspection credit applies exactly once to deposit');
  begin update public.quotes set amount=9000 where id=quote;raise exception 'immutable quote changed';exception when insufficient_privilege then null;end;
  perform pg_temp.as_user(admin);
  result:=public.managed_booking_action(booking,'admin_document','{"kind":"contract","title":"Repair contract","note":"Scope, inclusions, exclusions and duration agreed.","costDelta":0,"daysDelta":0}');document:=(result->>'id')::uuid;
  perform pg_temp.as_user(customer);
  perform public.managed_booking_action(booking,'respond_document',jsonb_build_object('id',document,'version',1,'accept',true));
  result:=public.managed_booking_action(booking,'manual_payment',jsonb_build_object('purpose','deposit','amount',3500,'method','cash','reference','CASH-'||gen_random_uuid(),'key',gen_random_uuid()));claim:=(result->>'id')::uuid;
  perform pg_temp.as_user(admin);
  perform public.managed_booking_action(booking,'admin_verify_payment',jsonb_build_object('id',claim,'approve',true,'note','MAZ verified remaining execution deposit'));
  insert into public.provider_assignments(booking_id,provider_id,assigned_by,trade,phase,starts_at,ends_at,expires_at,status) values(booking,worker,admin,'Plumber','execution',now()-interval '1 hour',now()+interval '2 hours',now()-interval '2 hours','accepted');
  insert into public.provider_appointment_requests(booking_id,starts_at,ends_at,phase,requested_by,status) values(booking,now()-interval '1 hour',now()+interval '2 hours','execution',worker,'accepted');
  perform public.confirm_maz_appointment(booking,worker);
  perform pg_temp.assert_ok((select official_status='Assigned' from public.bookings where id=booking),'shared assigned status');
  perform public.managed_booking_action(booking,'admin_start','{}');
  perform pg_temp.expect_denied(booking,'admin_finish','{}');
  update public.provider_assignments set status='completed' where booking_id=booking;
  insert into public.provider_work_updates(booking_id,provider_id,kind,notes,review_status,idempotency_key,photo_paths) values(booking,worker,'completion','Approved synthetic completion evidence','approved',gen_random_uuid(),array[booking::text||'/synthetic.jpg']);
  perform public.managed_booking_action(booking,'admin_finish','{}');
  perform pg_temp.expect_denied(booking,'admin_close','{}');
  perform pg_temp.as_user(customer);
  perform public.managed_booking_action(booking,'turnover','{"note":"Completed repair acknowledged"}');
  perform pg_temp.assert_ok((public.managed_booking_summary(booking)->>'balance_due')::numeric=5000,'balance is gross less all verified payments once');
  result:=public.managed_booking_action(booking,'manual_payment',jsonb_build_object('purpose','balance','amount',5000,'method','cash','reference','CASH-'||gen_random_uuid(),'key',gen_random_uuid()));claim:=(result->>'id')::uuid;
  perform pg_temp.as_user(admin);
  perform public.managed_booking_action(booking,'admin_verify_payment',jsonb_build_object('id',claim,'approve',true,'note','MAZ verified final cash settlement'));
  perform public.managed_booking_action(booking,'admin_close','{}');
  perform pg_temp.as_user(customer);
  perform public.managed_booking_action(booking,'company_review','{"stars":5,"note":"MAZ completed the repair","publish":false,"attribution":"anonymous"}');
  perform pg_temp.assert_ok((select count(*)=0 from public.public_company_reviews(service)),'review publication is opt in');
  perform public.managed_booking_action(booking,'company_review','{"stars":4,"note":"Updated MAZ company review","publish":true,"attribution":"no_quote"}');
  perform pg_temp.assert_ok((select comment='' from public.public_company_reviews(service)),'rating only omits comment');
  update public.company_reviews set created_at=now()-interval '15 days' where booking_id=booking;
  perform pg_temp.expect_denied(booking,'company_review','{"stars":5,"note":"Outside the edit window","publish":true,"attribution":"anonymous"}');
  perform public.managed_booking_action(booking,'portfolio_consent','{"allow":true}');
  perform pg_temp.as_user(admin);
  perform public.managed_booking_action(booking,'admin_publish',jsonb_build_object('title','Reviewed repair','note','Public-safe synthetic repair example','privacyChecked',true,'photos',jsonb_build_array(booking::text||'/synthetic.jpg')));
  perform pg_temp.assert_ok((select count(*)=1 from public.public_project_portfolio(service)),'reviewed consented portfolio published');
  perform pg_temp.as_user(customer);
  perform public.managed_booking_action(booking,'portfolio_consent','{"allow":false}');
  perform pg_temp.assert_ok((select count(*)=0 from public.public_project_portfolio(service)),'withdrawal immediately removes public portfolio');
  select payment_id into payment from public.manual_payment_claims where id=claim;
  result:=public.managed_booking_action(booking,'customer_request',jsonb_build_object('kind','refund','note','Synthetic approved adjustment','paymentId',payment,'amount',1000,'key',gen_random_uuid()));req:=(result->>'id')::uuid;
  perform pg_temp.as_user(admin);
  perform public.managed_booking_action(booking,'admin_resolve_request',jsonb_build_object('id',req,'approve',true,'note','Owner approved a documented adjustment'));
  perform public.managed_booking_action(booking,'admin_record_refund',jsonb_build_object('id',req,'reference','REF-'||gen_random_uuid(),'note','Verified refund sent to customer'));
  perform pg_temp.assert_ok((public.managed_booking_summary(booking)->>'net_paid')::numeric=9000,'refund reduces net money received');
  perform pg_temp.expect_denied(booking,'admin_record_refund',jsonb_build_object('id',req,'reference','DUP','note','Repeat settlement must be rejected'));
  perform pg_temp.assert_ok((public.managed_operations_report('2900-01-01',null)->>'bookings')::integer=0,'report date cohort aggregation');
  -- Simulate already-verified gateway facts at the private server boundary; no external money moves.
  insert into public.payments(booking_id,kind,purpose,amount,processing_fee,checkout_session_id,gateway_checkout_claimed_at)
    values(booking,'balance','balance',1500,25,'cs_SYNTHETIC_'||booking,null) returning id into payment;
  perform pg_temp.as_user(customer);
  perform pg_temp.expect_denied(booking,'manual_payment',jsonb_build_object('purpose','balance','amount',500,'method','cash','reference','LEGACY-OVERLAP','key',gen_random_uuid()));
  perform set_config('request.jwt.claims','{"role":"service_role"}',true);
  perform pg_temp.expect_sql_denied(format('select public.confirm_managed_gateway_payment(%L,%L,1525,''USD'',''card'')',payment,'pay_SYNTHETIC_'||payment));
  perform public.confirm_managed_gateway_payment(payment,'pay_SYNTHETIC_'||payment,1525,'PHP','card');
  perform pg_temp.as_user(customer);
  result:=public.managed_booking_action(booking,'customer_request',jsonb_build_object('kind','refund','note','Refund synthetic gateway principal','paymentId',payment,'amount',1500,'key',gen_random_uuid()));req:=(result->>'id')::uuid;
  perform pg_temp.as_user(admin);
  perform public.managed_booking_action(booking,'admin_resolve_request',jsonb_build_object('id',req,'approve',true,'note','Approved full synthetic principal refund'));
  perform pg_temp.expect_denied(booking,'admin_record_refund',jsonb_build_object('id',req,'reference','FAKE','note','Cannot manually mark a gateway refund settled'));
  perform set_config('request.jwt.claims','{"role":"service_role"}',true);
  perform public.settle_verified_gateway_refund(req,'ref_SYNTHETIC_'||req,'pay_SYNTHETIC_'||payment,1500,admin);
  perform public.settle_verified_gateway_refund(req,'ref_SYNTHETIC_'||req,'pay_SYNTHETIC_'||payment,1500,admin);
  perform public.confirm_managed_gateway_payment(payment,'pay_SYNTHETIC_'||payment,1525,'PHP','card');
  perform pg_temp.assert_ok((select status='refunded' and refunded_amount=1500 from public.payments where id=payment),'late paid webhook cannot resurrect refunded payment');
  perform pg_temp.assert_ok((select count(*)=1 from public.payment_events where payment_id=payment and kind='gateway_verified'),'gateway payment replay creates no duplicate ledger entries');
  perform pg_temp.as_user(admin);
  cancel_booking:=public.admin_create_managed_booking(customer,service,address,'Synthetic cancellable request',now()+interval '3 days','phone');
  insert into public.provider_assignments(booking_id,provider_id,assigned_by,trade,phase,starts_at,ends_at,expires_at,status)
    values(cancel_booking,worker,admin,'Plumber','inspection',now()+interval '3 days',now()+interval '3 days 2 hours',now()+interval '1 day','accepted');
  insert into public.provider_appointment_requests(booking_id,starts_at,ends_at,phase,requested_by)
    values(cancel_booking,now()+interval '3 days',now()+interval '3 days 2 hours','inspection',worker);
  perform pg_temp.as_user(customer);
  result:=public.managed_booking_action(cancel_booking,'customer_request',jsonb_build_object('kind','cancellation','note','Please cancel this requested service','key',gen_random_uuid()));req:=(result->>'id')::uuid;
  perform pg_temp.assert_ok((select status='accepted' from public.provider_assignments where booking_id=cancel_booking),'customer request alone does not silently release the team');
  perform pg_temp.as_user(admin);
  perform public.managed_booking_action(cancel_booking,'admin_resolve_request',jsonb_build_object('id',req,'approve',true,'note','MAZ approved cancellation without an automatic fee'));
  perform pg_temp.assert_ok((select status='withdrawn' from public.provider_assignments where booking_id=cancel_booking),'approved cancellation releases its active team reservation');
  perform pg_temp.assert_ok((select status='cancelled' from public.provider_appointment_requests where booking_id=cancel_booking),'cancelled appointment proposal no longer needs customer approval');
  perform pg_temp.assert_ok(public.provider_slot_available(worker,gen_random_uuid(),now()+interval '3 days',now()+interval '3 days 2 hours',0),'worker slot can be assigned after cancellation');
  perform pg_temp.as_user(stranger);
  perform pg_temp.expect_denied(booking,'portfolio_consent','{"allow":true}');
  perform pg_temp.as_user(worker);
  perform pg_temp.expect_denied(booking,'manual_payment',jsonb_build_object('purpose','balance','amount',1,'method','cash','reference','NOPE','key',gen_random_uuid()));
  insert into workflow_fixture_ids values(customer,worker,stranger,booking);
end $$;
-- These reads use the real authenticated role, not the database owner's RLS bypass.
set local role authenticated;
select pg_temp.as_user(stranger) from workflow_fixture_ids;
select pg_temp.assert_ok((select count(*)=0 from public.bookings where id=(select booking from workflow_fixture_ids)),'stranger cannot read booking');
select pg_temp.assert_ok((select count(*)=0 from public.payments where booking_id=(select booking from workflow_fixture_ids)),'stranger cannot read payments');
select pg_temp.as_user(worker) from workflow_fixture_ids;
select pg_temp.assert_ok((select count(*)>0 from public.project_documents where booking_id=(select booking from workflow_fixture_ids) and status='accepted'),'assigned worker can read approved scope');
select pg_temp.assert_ok((select count(*)=0 from public.manual_payment_claims where booking_id=(select booking from workflow_fixture_ids)),'worker cannot read customer payment proof claims');
select pg_temp.as_user(customer) from workflow_fixture_ids;
select pg_temp.assert_ok((select count(*)=1 from public.bookings where id=(select booking from workflow_fixture_ids)),'customer reads own booking');
select pg_temp.assert_ok((select count(*)=1 from public.company_reviews where booking_id=(select booking from workflow_fixture_ids)),'customer reads own company review');
reset role;
