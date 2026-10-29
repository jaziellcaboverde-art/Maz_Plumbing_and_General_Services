-- Provider application: more credible requirements.
-- New document kinds, years of experience, two references. NBI clearance is now required by default
-- (an admin can still switch it off in Config).

alter table public.provider_documents drop constraint if exists provider_documents_kind_check;
alter table public.provider_documents add constraint provider_documents_kind_check
  check (kind in ('government_id', 'selfie', 'nbi_clearance', 'proof_of_address', 'skill_certificate'));

alter table public.provider_profiles
  add column if not exists years_experience smallint check (years_experience is null or years_experience between 0 and 60),
  add column if not exists reference_1_name text,
  add column if not exists reference_1_phone text,
  add column if not exists reference_2_name text,
  add column if not exists reference_2_phone text;

insert into public.config (key, value, description)
values ('provider.nbi_clearance_required', 'true'::jsonb,
  'Require NBI clearance for provider applications according to the current hiring policy')
on conflict (key) do update set value = 'true'::jsonb
  where public.config.value = 'false'::jsonb;
