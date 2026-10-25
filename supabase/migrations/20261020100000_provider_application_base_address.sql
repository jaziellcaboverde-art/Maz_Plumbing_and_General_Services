alter table public.provider_profiles
  add column if not exists base_address text;
