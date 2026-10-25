-- Removing a provider's provider-only records preserves their shared login and booking history.
create function public.admin_remove_provider_details(p_actor uuid, p_provider uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.user_role;
begin
  select p.role into v_role
  from public.profiles p
  where p.id = p_actor
  for share;

  if v_role is distinct from 'admin'::public.user_role then
    raise exception 'Admin access required';
  end if;

  select p.role into v_role
  from public.profiles p
  where p.id = p_provider
  for update;

  if v_role is distinct from 'provider'::public.user_role then
    raise exception 'This account is not an active provider';
  end if;

  perform 1 from public.provider_profiles pp
  where pp.profile_id = p_provider
  for update;

  if not found then
    raise exception 'Provider details were already removed';
  end if;

  if exists (
    select 1 from public.bookings b
    where (b.provider_id = p_provider or b.picked_provider_id = p_provider)
      and b.status not in ('completed'::public.booking_status, 'cancelled'::public.booking_status)
  ) then
    raise exception 'Finish or reassign this provider''s active bookings before removing provider details';
  end if;

  update public.profiles set role = 'customer' where id = p_provider;
  update public.offers
    set status = 'cancelled', responded_at = now()
    where provider_id = p_provider and status = 'pending';
  delete from public.provider_services where provider_id = p_provider;
  delete from public.provider_documents where provider_id = p_provider;
  delete from public.provider_profiles where profile_id = p_provider;

  perform public.write_audit(
    p_actor, 'provider.resigned', 'profiles', p_provider::text,
    'Provider resignation', jsonb_build_object('provider_details_removed', true, 'account_role', 'customer')
  );
end;
$$;

revoke all on function public.admin_remove_provider_details(uuid, uuid) from public, anon, authenticated;
grant execute on function public.admin_remove_provider_details(uuid, uuid) to service_role;
