-- Requires demo identities. All writes, including storage metadata and temporary service settings, roll back. No API notifications are sent.
begin;
do $$
declare admin_id uuid; customer_id uuid; outsider_id uuid; provider_id uuid; fixture public.bookings%rowtype;
 bid uuid; manual_id uuid; work_id uuid; completion_id uuid; claim_id uuid; result jsonb; photo text; seen integer;
begin
 select p.id into admin_id from public.profiles p join auth.users u on u.id=p.id where u.email='maz-demo-admin@example.com';
 select p.id into outsider_id from public.profiles p join auth.users u on u.id=p.id where u.email='maz-demo-customer-02@example.com';
 select b.* into fixture from public.bookings b join auth.users u on u.id=b.customer_id where u.email='maz-demo-customer-01@example.com'
 and exists(select 1 from public.provider_services ps join public.provider_profiles pp on pp.profile_id=ps.provider_id join auth.users pu on pu.id=ps.provider_id where ps.service_id=b.service_id and pp.status='approved' and pu.email like 'maz-demo-provider-%@example.com') limit 1;
 customer_id:=fixture.customer_id;
 select ps.provider_id into provider_id from public.provider_services ps join public.provider_profiles pp on pp.profile_id=ps.provider_id join auth.users u on u.id=ps.provider_id where ps.service_id=fixture.service_id and pp.status='approved' and u.email like 'maz-demo-provider-%@example.com' limit 1;
 if admin_id is null or customer_id is null or provider_id is null or outsider_id is null then raise exception 'Isolated demo identities missing'; end if;
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 manual_id:=public.admin_create_manual_booking('Workflow audit sample','09123456789','Audit sample address only',fixture.service_id,'Rolled back manual request validation',now()+interval '2 days','phone');
 if (select manual_customer_name from public.bookings where id=manual_id)<>'Workflow audit sample' then raise exception 'Manual request details missing'; end if;
 insert into public.bookings(customer_id,service_id,address_id,description,preferred_start,status,admin_accepted_at,inspection_required,contract_required)
 values(customer_id,fixture.service_id,fixture.address_id,'Rolled back complete role workflow audit',now()+interval '3 days','draft',now(),false,false) returning id into bid;
 perform public.change_booking_status(bid,'open','Rolled-back workflow check');
 perform public.managed_booking_action(bid,'admin_quote',jsonb_build_object('note','Imported audit receipt for service labor','items',jsonb_build_array(jsonb_build_object('description','Service labor','quantity',1,'unitPrice',100)),'deposit',999,'gatewayFee',0,'expiresAt',now()+interval '7 days'));
 perform public.assign_provider_team(bid,jsonb_build_array(jsonb_build_object('providerId',provider_id,'trade','Service worker')),'execution',gen_random_uuid());
 if (select official_status from public.bookings where id=bid)<>'Assigned' then raise exception 'Assignment status not connected'; end if;
 perform set_config('request.jwt.claim.sub',customer_id::text,true);
 result:=public.managed_booking_summary(bid);
 if jsonb_array_length(result->'team')<>1 then raise exception 'Customer cannot see assigned team'; end if;
 perform set_config('request.jwt.claim.sub',outsider_id::text,true);
 begin perform public.managed_booking_summary(bid); raise exception 'Unrelated customer read booking'; exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 perform public.confirm_maz_team_appointment(bid,array[provider_id]);
 update public.bookings set scheduled_start=now()-interval '10 minutes' where id=bid;
 perform public.managed_booking_action(bid,'admin_start','{}');
 perform set_config('request.jwt.claim.sub',provider_id::text,true);
 work_id:=public.submit_provider_work_update(bid,'progress','Rolled-back progress evidence visibility test','{}',null,gen_random_uuid());
 perform set_config('request.jwt.claim.sub',customer_id::text,true);
 execute 'set local role authenticated';
 select count(*) into seen from public.provider_work_updates where id=work_id;
 execute 'reset role';
 if seen<>0 then raise exception 'Unreviewed provider evidence exposed to customer'; end if;
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 perform public.review_provider_work_update(work_id,true,'Reviewed test progress');
 perform set_config('request.jwt.claim.sub',customer_id::text,true);
 execute 'set local role authenticated';
 select count(*) into seen from public.provider_work_updates where id=work_id;
 execute 'reset role';
 if seen<>1 then raise exception 'Reviewed evidence not visible to customer'; end if;
 photo:=bid::text||'/'||provider_id::text||'/rolled-back-audit.jpg';
 -- Storage metadata exists only inside this rolled-back transaction; no real evidence is created.
 insert into storage.objects(bucket_id,name,owner_id) values('proof-photos',photo,provider_id::text);
 perform set_config('request.jwt.claim.sub',provider_id::text,true);
 result:=public.submit_provider_completion(bid,'Rolled-back completion review workflow',array[photo]);
 completion_id:=(result->>'update_id')::uuid;
 perform set_config('request.jwt.claim.sub',customer_id::text,true);
 execute 'set local role authenticated'; select count(*) into seen from storage.objects where bucket_id='proof-photos' and name=photo; execute 'reset role';
 if seen<>0 then raise exception 'Unreviewed provider photo exposed to customer'; end if;
 if (select status from public.bookings where id=bid)<>'in_progress' then raise exception 'Provider completion closed the project without MAZ'; end if;
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 perform public.review_provider_work_update(completion_id,true,'Completion evidence checked in isolated test');
 perform set_config('request.jwt.claim.sub',customer_id::text,true);
 execute 'set local role authenticated'; select count(*) into seen from storage.objects where bucket_id='proof-photos' and name=photo; execute 'reset role';
 if seen<>1 then raise exception 'Approved provider photo unavailable to customer'; end if;
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 perform public.approve_provider_project_completion(bid);
 perform set_config('request.jwt.claim.sub',customer_id::text,true);
 perform public.managed_booking_action(bid,'turnover',jsonb_build_object('note','Rolled-back customer turnover acknowledgment'));
 result:=public.managed_booking_action(bid,'manual_payment',jsonb_build_object('purpose','balance','amount',100,'method','cash','reference','ROLLED-BACK-TEST-ONLY','key',gen_random_uuid()));
 claim_id:=(result->>'id')::uuid;
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 perform public.managed_booking_action(bid,'admin_verify_payment',jsonb_build_object('id',claim_id,'approve',true,'note','Rolled-back test only; no actual funds received'));
 perform public.managed_booking_action(bid,'admin_close','{}');
 if (select status from public.bookings where id=bid)<>'completed' then raise exception 'Settled project did not close'; end if;
 result:=public.managed_booking_summary(bid);
 if (result->>'net_paid')::numeric<>100 or (result->>'balance_due')::numeric<>0 then raise exception 'Final verified financial position is incorrect'; end if;
end $$;

do $$
declare admin_id uuid; customer_id uuid; provider_id uuid; fixture public.bookings%rowtype; bid uuid; claim uuid; doc uuid; work uuid; req uuid; payment uuid; result jsonb;
begin
 select p.id into admin_id from public.profiles p join auth.users u on u.id=p.id where u.email='maz-demo-admin@example.com';
 select b.* into fixture from public.bookings b join auth.users u on u.id=b.customer_id where u.email='maz-demo-customer-01@example.com'
 and exists(select 1 from public.provider_services ps join public.provider_profiles pp on pp.profile_id=ps.provider_id join auth.users pu on pu.id=ps.provider_id where ps.service_id=b.service_id and pp.status='approved' and pu.email like 'maz-demo-provider-%@example.com') limit 1;
 customer_id:=fixture.customer_id;
 select ps.provider_id into provider_id from public.provider_services ps join public.provider_profiles pp on pp.profile_id=ps.provider_id join auth.users u on u.id=ps.provider_id where ps.service_id=fixture.service_id and pp.status='approved' and u.email like 'maz-demo-provider-%@example.com' limit 1;
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 -- Chargeable-service configuration exists only in this rolled-back test.
 update public.services set inspection_policy='chargeable' where id=fixture.service_id;
 insert into public.bookings(customer_id,service_id,address_id,description,preferred_start,status,admin_accepted_at,inspection_required,inspection_fee,inspection_pay_before_visit,contract_required)
 values(customer_id,fixture.service_id,fixture.address_id,'Rolled back contract inspection refund audit',now()+interval '4 days','draft',now(),true,1500,true,true) returning id into bid;
 perform public.change_booking_status(bid,'open','Rolled-back inspection workflow audit');
 perform public.assign_provider_team(bid,jsonb_build_array(jsonb_build_object('providerId',provider_id,'trade','Inspector')),'inspection',gen_random_uuid());
 perform set_config('request.jwt.claim.sub',customer_id::text,true);
 result:=public.managed_booking_action(bid,'manual_payment',jsonb_build_object('purpose','inspection','amount',1500,'method','cash','reference','ROLLED-BACK-INSPECTION','key',gen_random_uuid())); claim:=(result->>'id')::uuid;
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 perform public.managed_booking_action(bid,'admin_verify_payment',jsonb_build_object('id',claim,'approve',true,'note','Rolled-back verification only, no actual funds'));
 perform public.confirm_maz_team_appointment(bid,array[provider_id]);
 perform set_config('request.jwt.claim.sub',provider_id::text,true);
 work:=public.submit_provider_work_update(bid,'inspection','Rolled-back inspection findings for contract quotation','{}',null,gen_random_uuid());
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 perform public.review_provider_work_update(work,true,'Inspection reviewed in rolled-back audit');
 perform public.managed_booking_action(bid,'admin_quote',jsonb_build_object('note','Imported receipt for inspected contract service','items',jsonb_build_array(jsonb_build_object('description','Contract service labor','quantity',1,'unitPrice',5000)),'deposit',1,'gatewayFee',0,'expiresAt',now()+interval '7 days'));
 result:=public.managed_booking_summary(bid);
 if (result->>'deposit_due')::numeric<>1000 or (result->>'net_paid')::numeric<>1500 then raise exception 'Inspection credit or automatic 50 percent contract deposit is wrong'; end if;
 result:=public.managed_booking_action(bid,'admin_document',jsonb_build_object('kind','contract','title','Audit-only service contract','note','Rolled-back scope and responsibilities for inspected contract service','costDelta',0,'daysDelta',0)); doc:=(result->>'id')::uuid;
 perform set_config('request.jwt.claim.sub',customer_id::text,true);
 perform public.managed_booking_action(bid,'respond_document',jsonb_build_object('id',doc,'version',1,'accept',true));
 result:=public.managed_booking_action(bid,'manual_payment',jsonb_build_object('purpose','deposit','amount',1000,'method','cash','reference','ROLLED-BACK-DEPOSIT','key',gen_random_uuid())); claim:=(result->>'id')::uuid;
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 result:=public.managed_booking_action(bid,'admin_verify_payment',jsonb_build_object('id',claim,'approve',true,'note','Rolled-back verification only, no actual funds')); payment:=(result->>'id')::uuid;
 perform public.assign_provider_team(bid,jsonb_build_array(jsonb_build_object('providerId',provider_id,'trade','Service worker')),'execution',gen_random_uuid());
 perform public.confirm_maz_team_appointment(bid,array[provider_id]);
 result:=public.managed_booking_summary(bid);
 if (result->>'net_paid')::numeric<>2500 or (result->>'deposit_due')::numeric<>0 then raise exception 'Configured contract advance is incorrect'; end if;
 perform set_config('request.jwt.claim.sub',customer_id::text,true);
 result:=public.managed_booking_action(bid,'customer_request',jsonb_build_object('kind','cancellation','note','Rolled-back cancellation workflow check','key',gen_random_uuid())); req:=(result->>'id')::uuid;
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 perform public.managed_booking_action(bid,'admin_resolve_request',jsonb_build_object('id',req,'approve',true,'note','Rolled-back cancellation approved, refund remains separate'));
 if exists(select 1 from public.provider_assignments where booking_id=bid and status in ('accepted','offered','withdrawal_requested')) then raise exception 'Cancelled booking still reserves its workers'; end if;
 perform set_config('request.jwt.claim.sub',customer_id::text,true);
 result:=public.managed_booking_action(bid,'customer_request',jsonb_build_object('kind','refund','note','Rolled-back request to return the execution deposit','paymentId',payment,'amount',1000,'key',gen_random_uuid())); req:=(result->>'id')::uuid;
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 perform public.managed_booking_action(bid,'admin_resolve_request',jsonb_build_object('id',req,'approve',true,'note','Rolled-back refund request approved for separate settlement'));
 if (public.managed_booking_summary(bid)->>'net_paid')::numeric<>2500 then raise exception 'Refund approval incorrectly moved money'; end if;
 perform public.managed_booking_action(bid,'admin_record_refund',jsonb_build_object('id',req,'note','Rolled-back refund settlement only, no money moved','reference','ROLLED-BACK-REFUND'));
 if (public.managed_booking_summary(bid)->>'net_paid')::numeric<>1500 then raise exception 'Refund did not reconcile net verified payments exactly once'; end if;
end $$;

select true as all_roles_connected_and_financial_lifecycle_passed, true as inspection_contract_cancellation_refund_passed;
rollback;