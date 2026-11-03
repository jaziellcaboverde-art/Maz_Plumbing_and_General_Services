-- Provider accounts are provisioned by administrators. Preserve existing provider
-- records and history, but prevent client sessions from creating applicant records.
revoke execute on function public.register_provider_applicant(uuid) from anon, authenticated;
