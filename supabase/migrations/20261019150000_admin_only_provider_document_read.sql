-- Q20: provider documents are visible to admins only. Providers may upload their
-- own ID/selfie files, but cannot read the database rows or download the files.

drop policy if exists "provider_documents: read own or admin" on public.provider_documents;
create policy "provider_documents: admin reads" on public.provider_documents
  for select to authenticated
  using ((select public.is_admin()));

drop policy if exists "ids and selfies: owner or admin reads" on storage.objects;
create policy "ids and selfies: admin reads" on storage.objects
  for select to authenticated
  using (
    bucket_id in ('ids', 'selfies')
    and (select public.is_admin())
  );
