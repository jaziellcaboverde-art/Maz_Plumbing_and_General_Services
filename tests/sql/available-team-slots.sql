-- Run with the pg_temp helpers from connected-workflow.sql, inside BEGIN/ROLLBACK.
do $$
declare admin uuid:=gen_random_uuid();customer uuid:=gen_random_uuid();one uuid:=gen_random_uuid();two uuid:=gen_random_uuid();empty_worker uuid:=gen_random_uuid();
  address uuid:=gen_random_uuid();service uuid:=gen_random_uuid();booking uuid;other_booking uuid;
  work_date date:=(now() at time zone 'Asia/Manila')::date+5;
  start_time timestamptz;end_time timestamptz;
begin
  insert into auth.users(id,email,raw_app_meta_data) values
    (admin,admin||'@slots.invalid','{"role":"admin"}'),(customer,customer||'@slots.invalid','{"role":"customer"}'),
    (one,one||'@slots.invalid','{"role":"provider"}'),(two,two||'@slots.invalid','{"role":"provider"}'),(empty_worker,empty_worker||'@slots.invalid','{"role":"provider"}');
  insert into public.provider_profiles(profile_id,status) values(one,'approved'),(two,'approved'),(empty_worker,'approved');
  insert into public.services(id,category,name) values(service,'Test','Available slots '||service);
  insert into public.provider_services(provider_id,service_id) values(one,service),(two,service),(empty_worker,service);
  insert into public.addresses(id,profile_id,line1,city,location) values(address,customer,'Synthetic slots address','Pasig',extensions.st_setsrid(extensions.st_makepoint(121.08,14.57),4326)::extensions.geography);
  perform pg_temp.as_user(admin);
  booking:=public.admin_create_managed_booking(customer,service,address,'Availability search scenario',now()+interval '5 days','phone');
  other_booking:=public.admin_create_managed_booking(customer,service,address,'Conflicting work scenario',now()+interval '5 days','phone');
  insert into public.provider_weekly_hours(provider_id,weekday,starts_at,ends_at) values
    (one,extract(dow from work_date),'08:00','17:00'),(two,extract(dow from work_date),'10:00','15:00');
  perform pg_temp.assert_ok((select count(*)=9 from public.admin_available_team_slots(booking,array[one,two],work_date,now()+interval '36 hours',1,60,30)), 'only shared working hours are selectable');
  perform pg_temp.assert_ok((select count(*)=0 from public.admin_available_team_slots(booking,array[empty_worker],work_date,now()+interval '36 hours',1,60,30)), 'no unpublished assumed availability');
  start_time:=(work_date+time '11:00') at time zone 'Asia/Manila';end_time:=start_time+interval '1 hour';
  insert into public.provider_assignments(booking_id,provider_id,assigned_by,trade,phase,starts_at,ends_at,expires_at,status,travel_minutes)
    values(other_booking,two,admin,'Plumber','execution',start_time,end_time,now()+interval '36 hours','accepted',30);
  perform pg_temp.assert_ok((select count(*)=3 from public.admin_available_team_slots(booking,array[one,two],work_date,now()+interval '36 hours',1,60,30)), 'existing work and both travel buffers are excluded');
  insert into public.provider_availability(provider_id,starts_at,ends_at,kind) values(one,(work_date+time '14:00') at time zone 'Asia/Manila',(work_date+time '15:00') at time zone 'Asia/Manila','unavailable');
  perform pg_temp.assert_ok((select count(*)=1 from public.admin_available_team_slots(booking,array[one,two],work_date,now()+interval '36 hours',1,60,30)), 'dated leave removes overlapping slots');
  insert into public.provider_availability(provider_id,starts_at,ends_at,kind) values
    (one,((work_date+1)+time '09:00') at time zone 'Asia/Manila',((work_date+1)+time '12:00') at time zone 'Asia/Manila','available'),
    (two,((work_date+1)+time '10:00') at time zone 'Asia/Manila',((work_date+1)+time '11:00') at time zone 'Asia/Manila','available');
  perform pg_temp.assert_ok((select count(*)=1 from public.admin_available_team_slots(booking,array[one,two],work_date+1,now()+interval '36 hours',1,60,30)), 'dated availability can supply an extra working day');
  perform pg_temp.assert_ok((select count(*)=0 from public.admin_available_team_slots(booking,array[one,two],work_date+1,now()+interval '36 hours',1,120,30)), 'full work duration must fit every worker');
  perform pg_temp.as_user(customer);
  perform pg_temp.expect_sql_denied(format('select * from public.admin_available_team_slots(%L,array[%L::uuid],%L,now(),1,60,30)',booking,one,work_date));
end $$;
