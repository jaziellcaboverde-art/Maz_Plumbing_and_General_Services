-- Provider onboarding: collect application details while keeping applicants as customers.
-- The application itself remains pending until an admin changes the profile role.

alter table public.provider_profiles
  add column if not exists service_area text,
  add column if not exists application_note text,
  add column if not exists document_consent_at timestamptz;

-- Applicants may update only application fields while their application is pending.
grant update (service_area, application_note) on public.provider_profiles to authenticated;

-- Keep an applicant's status visible on their own application page. Existing own/admin
-- read policy already allows this; only server-side admin actions may set review status.
