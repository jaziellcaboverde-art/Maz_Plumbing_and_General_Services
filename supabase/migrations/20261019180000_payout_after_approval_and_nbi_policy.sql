-- Collect provider payout details only after approval. Remove details previously
-- submitted by applicants who are not approved.
update public.provider_profiles
set payout_method = null,
    payout_account_name = null,
    payout_account_number = null
where status <> 'approved';

-- NBI is not collected unless an administrator enables it for the active hiring policy.
insert into public.config (key, value, description)
values (
  'provider.nbi_clearance_required',
  'false'::jsonb,
  'Require NBI clearance for provider applications according to the current hiring policy'
)
on conflict (key) do nothing;
