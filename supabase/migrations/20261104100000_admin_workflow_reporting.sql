-- Reports aggregate every matching booking on the server, not a truncated API page.
create function public.managed_operations_report(p_from timestamptz default null,p_to timestamptz default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if not public.is_admin() then raise exception 'MAZ administrator required' using errcode='42501'; end if;
  if p_from>p_to then raise exception 'Start date must precede end date'; end if;
  with cohort as (
    select b.id,b.official_status,b.status,b.service_id,s.name,coalesce(b.quote_total,0) as gross,
      public.net_booking_paid(b.id) as paid,exists(select 1 from public.quotes q where q.booking_id=b.id and q.status='accepted') as approved
    from public.bookings b left join public.services s on s.id=b.service_id
    where b.status<>'draft' and (p_from is null or b.created_at>=p_from) and (p_to is null or b.created_at<=p_to)
  ) select jsonb_build_object(
    'bookings',count(*),'completed',count(*) filter(where official_status='Completed'),'cancelled',count(*) filter(where official_status='Cancelled'),
    'approved_gross',coalesce(sum(gross) filter(where approved and status<>'cancelled'),0),
    'net_verified',coalesce(sum(paid),0),
    'service_receivable',coalesce(sum(greatest(0,gross-paid)) filter(where approved and status<>'cancelled'),0),
    'by_status',(select coalesce(jsonb_agg(x),'[]') from (select official_status as status,count(*) as count from cohort group by official_status order by official_status) x),
    'by_service',(select coalesce(jsonb_agg(x),'[]') from (select coalesce(name,'Other service') as service,count(*) as bookings,count(*) filter(where official_status='Completed') as completed,coalesce(sum(paid),0) as net_verified from cohort group by service_id,name order by count(*) desc) x)
  ) into result from cohort;
  return result;
end $$;
revoke all on function public.managed_operations_report(timestamptz,timestamptz) from public,anon;
grant execute on function public.managed_operations_report(timestamptz,timestamptz) to authenticated;
