-- Run after connected-workflow.sql, in the same rolled-back transaction.
do $$
declare admin uuid:=gen_random_uuid();customer uuid:=gen_random_uuid();first_worker uuid:=gen_random_uuid();second_worker uuid:=gen_random_uuid();unqualified uuid:=gen_random_uuid();
  address uuid:=gen_random_uuid();service uuid:=gen_random_uuid();booking uuid;legacy_booking uuid;quote uuid;proposal uuid;first_assignment uuid;second_assignment uuid;
  workers jsonb;result jsonb;request_key uuid:=gen_random_uuid();starts timestamptz:=now()+interval '3 days';ends timestamptz:=now()+interval '3 days 3 hours';expiry timestamptz:=now()+interval '25 hours';
begin
 insert into auth.users(id,email,raw_app_meta_data) values
  (admin,admin||'@team.invalid','{"role":"admin"}'),(customer,customer||'@team.invalid','{"role":"customer"}'),
  (first_worker,first_worker||'@team.invalid','{"role":"provider"}'),(second_worker,second_worker||'@team.invalid','{"role":"provider"}'),(unqualified,unqualified||'@team.invalid','{"role":"provider"}');
 insert into public.provider_profiles(profile_id,status) values(first_worker,'approved'),(second_worker,'approved'),(unqualified,'approved');
 insert into public.services(id,category,name) values(service,'Test','Team scenario '||service);
 insert into public.provider_services(provider_id,service_id) values(first_worker,service),(second_worker,service);
 insert into public.addresses(id,profile_id,line1,city,location) values(address,customer,'Synthetic team address','Pasig',extensions.st_setsrid(extensions.st_makepoint(121.08,14.57),4326)::extensions.geography);
 perform pg_temp.as_user(admin);
 booking:=public.admin_create_managed_booking(customer,service,address,'Repair requiring multiple workers',starts,'phone');
 perform public.managed_booking_action(booking,'admin_review','{"decision":"accept","note":"Reviewed multi-worker repair scope","inspectionRequired":false,"chargeInspection":false,"payInspectionBeforeVisit":false,"contractRequired":false}');
 perform public.managed_booking_action(booking,'admin_quote',jsonb_build_object('note','Agreed multi-worker repair with labor and parts','items','[{"description":"Repair","quantity":1,"unitPrice":8000}]'::jsonb,'deposit',0,'gatewayFee',0,'expiresAt',now()+interval '7 days'));
 select id into quote from public.quotes where booking_id=booking;
 perform pg_temp.as_user(customer);
 perform public.managed_booking_action(booking,'respond_quote',jsonb_build_object('id',quote,'version',1,'accept',true));
 perform pg_temp.as_user(admin);
 -- Earlier inspection acceptance must not be mistaken for the execution role.
 insert into public.provider_assignments(booking_id,provider_id,assigned_by,trade,phase,starts_at,ends_at,expires_at,status)
 values(booking,first_worker,admin,'Inspector','inspection',now()+interval '2 days',now()+interval '2 days 1 hour',expiry,'accepted');
 workers:=jsonb_build_array(jsonb_build_object('providerId',first_worker,'trade','Lead plumber'),jsonb_build_object('providerId',unqualified,'trade','Electrician'));
 perform pg_temp.expect_sql_denied(format('select public.offer_provider_team(%L,%L::jsonb,''execution'',%L,%L,%L,30,%L)',booking,workers,starts,ends,expiry,request_key));
 perform pg_temp.assert_ok((select count(*)=0 from public.provider_assignments where booking_id=booking and phase='execution'),'invalid second worker rolls back the whole team');
 workers:=jsonb_build_array(jsonb_build_object('providerId',first_worker,'trade','Lead plumber'),jsonb_build_object('providerId',second_worker,'trade','Electrician'));
 result:=public.offer_provider_team(booking,workers,'execution',starts,ends,expiry,30,request_key);
 perform pg_temp.assert_ok(jsonb_array_length(result->'assignments')=2,'team batch contains both workers');
 perform pg_temp.assert_ok(jsonb_array_length(result->'notify')=3,'one notification per worker and one appointment notice for customer');
 result:=public.offer_provider_team(booking,workers,'execution',starts,ends,expiry,30,request_key);
 perform pg_temp.assert_ok((result->>'replayed')::boolean,'same request reuses successful team offers');
 perform pg_temp.assert_ok((select count(*)=2 from public.provider_assignments where booking_id=booking and phase='execution'),'retry creates no duplicate offers');
 perform pg_temp.expect_sql_denied(format('select public.confirm_maz_appointment(%L,%L)',booking,first_worker));
 select id into first_assignment from public.provider_assignments where booking_id=booking and phase='execution' and provider_id=first_worker;
 select id into second_assignment from public.provider_assignments where booking_id=booking and phase='execution' and provider_id=second_worker;
 perform pg_temp.as_user(first_worker);perform public.respond_provider_assignment(first_assignment,true,null);
 perform pg_temp.as_user(admin);
 perform pg_temp.expect_sql_denied(format('select public.confirm_maz_appointment(%L,%L)',booking,first_worker));
 perform pg_temp.as_user(second_worker);perform public.respond_provider_assignment(second_assignment,true,null);
 perform pg_temp.as_user(customer);
 perform pg_temp.expect_sql_denied(format('select public.offer_provider_team(%L,%L::jsonb,''execution'',%L,%L,%L,30,%L)',booking,workers,starts,ends,expiry,gen_random_uuid()));
 select id into proposal from public.provider_appointment_requests where booking_id=booking and phase='execution';
 perform public.respond_provider_appointment(proposal,true);
 perform pg_temp.as_user(admin);perform public.confirm_maz_appointment(booking,first_worker);
 perform pg_temp.assert_ok((select official_status='Assigned' and scheduled_start=starts from public.bookings where id=booking),'confirmation uses accepted execution lead and full team, not earlier inspection');
 -- Legacy accepted offers remain usable when no phase-specific team role exists.
 insert into public.provider_services(provider_id,service_id) values(unqualified,service);
 legacy_booking:=public.admin_create_managed_booking(customer,service,address,'Legacy inspection acceptance scenario',now()+interval '5 days','phone');
 perform public.managed_booking_action(legacy_booking,'admin_review','{"decision":"accept","note":"Reviewed legacy inspection request","inspectionRequired":true,"chargeInspection":false,"payInspectionBeforeVisit":false,"contractRequired":false}');
 insert into public.offers(booking_id,provider_id,kind,status,expires_at) values(legacy_booking,unqualified,'admin_assign','accepted',expiry);
 update public.bookings set provider_id=unqualified where id=legacy_booking;
 perform public.confirm_maz_appointment(legacy_booking,unqualified);
 perform pg_temp.assert_ok((select official_status='Accepted' and schedule_confirmed_at is not null from public.bookings where id=legacy_booking),'accepted legacy lead can confirm inspection');
end $$;
