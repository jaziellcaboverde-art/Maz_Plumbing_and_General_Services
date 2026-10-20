-- Phase 5: temporary customer onboarding documents and an atomic profile/address/consent save.

insert into public.legal_versions (doc_type, version, body, published_at)
values
  ('terms', 'draft-2026-10-19',
   'Temporary Terms placeholder for the MAZ Plumbing and General Services development system. Creating an account does not create a service booking or payment obligation. Booking, cancellation, pricing, and payment terms must be reviewed and replaced before public launch. This draft is not legal advice.', now()),
  ('privacy', 'draft-2026-10-19',
   'Temporary Privacy Notice placeholder for the MAZ Plumbing and General Services development system. The system uses account details and a service address to provide home-service booking features. The service address is shared with the assigned provider for the booking. Do not enter sensitive information that is not requested. The final notice describing data rights, retention, and contact details must be reviewed and published before public launch. This draft is not legal advice.', now())
on conflict (doc_type, version) do nothing;

create function public.complete_customer_onboarding(
  p_first_name text,
  p_last_name text,
  p_birthday date,
  p_mobile text,
  p_account_type public.account_type,
  p_business_name text,
  p_line1 text,
  p_barangay text,
  p_city text,
  p_province text,
  p_landmark text,
  p_terms_version_id uuid,
  p_privacy_version_id uuid,
  p_terms_accepted boolean,
  p_privacy_accepted boolean,
  p_device text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_address_id uuid;
begin
  if v_user_id is null or auth.role() <> 'authenticated' then
    raise exception 'Sign in to finish setting up your account' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles p where p.id = v_user_id and p.role = 'customer') then
    raise exception 'Only customer accounts can complete customer onboarding' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_first_name, ''))) not between 1 and 100
    or length(btrim(coalesce(p_last_name, ''))) not between 1 and 100
    or p_birthday is null or p_birthday > (current_date - interval '18 years')::date
    or coalesce(p_mobile, '') !~ '^\+639[0-9]{9}$'
    or p_account_type is null
    or (p_account_type = 'business' and length(btrim(coalesce(p_business_name, ''))) not between 1 and 160)
    or length(btrim(coalesce(p_line1, ''))) not between 1 and 240
    or length(btrim(coalesce(p_city, ''))) not between 1 and 120
    or length(btrim(coalesce(p_barangay, ''))) > 120
    or length(btrim(coalesce(p_province, ''))) > 120
    or length(btrim(coalesce(p_landmark, ''))) > 300 then
    raise exception 'Check the required account and address details';
  end if;
  if not exists (
    select 1 from public.legal_versions v
    where v.id = p_terms_version_id and v.doc_type = 'terms' and v.published_at <= now()
  ) or not exists (
    select 1 from public.legal_versions v
    where v.id = p_privacy_version_id and v.doc_type = 'privacy' and v.published_at <= now()
  ) then
    raise exception 'The current Terms or Privacy Notice could not be found';
  end if;
  if p_terms_accepted is distinct from true or p_privacy_accepted is distinct from true then
    raise exception 'Accept the Terms and Privacy Notice to continue';
  end if;

  update public.profiles
  set first_name = btrim(p_first_name),
      last_name = btrim(p_last_name),
      birthday = p_birthday,
      mobile = btrim(p_mobile),
      account_type = p_account_type,
      business_name = case when p_account_type = 'business' then btrim(p_business_name) else null end
  where id = v_user_id;

  select a.id into v_address_id from public.addresses a
  where a.profile_id = v_user_id and a.label = 'Home'
  order by a.created_at limit 1;
  if v_address_id is null then
    insert into public.addresses (profile_id, label, line1, barangay, city, province, landmark)
    values (v_user_id, 'Home', btrim(p_line1), nullif(btrim(coalesce(p_barangay, '')), ''),
            btrim(p_city), nullif(btrim(coalesce(p_province, '')), ''), nullif(btrim(coalesce(p_landmark, '')), ''))
    returning id into v_address_id;
  else
    update public.addresses set line1 = btrim(p_line1),
      barangay = nullif(btrim(coalesce(p_barangay, '')), ''), city = btrim(p_city),
      province = nullif(btrim(coalesce(p_province, '')), ''), landmark = nullif(btrim(coalesce(p_landmark, '')), '')
    where id = v_address_id;
  end if;

  insert into public.consents (profile_id, legal_version_id, device)
  select v_user_id, version_id, left(coalesce(p_device, ''), 500)
  from unnest(array[p_terms_version_id, p_privacy_version_id]) as selected(version_id)
  where not exists (
    select 1 from public.consents c where c.profile_id = v_user_id and c.legal_version_id = selected.version_id
  );
  return v_address_id;
end;
$$;

revoke all on function public.complete_customer_onboarding(text, text, date, text, public.account_type, text, text, text, text, text, text, uuid, uuid, boolean, boolean, text) from public, anon;
grant execute on function public.complete_customer_onboarding(text, text, date, text, public.account_type, text, text, text, text, text, text, uuid, uuid, boolean, boolean, text) to authenticated;
