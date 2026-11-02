-- Service card photos (admin services page). Photos are shown on public cards, so the bucket is
-- public for reading; only an admin can add, replace or remove files.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('service-photos', 'service-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

alter table public.services add column if not exists image_path text;

drop policy if exists "service-photos: admin adds" on storage.objects;
create policy "service-photos: admin adds" on storage.objects for insert to authenticated
  with check (bucket_id = 'service-photos' and (select public.is_admin()));
drop policy if exists "service-photos: admin replaces" on storage.objects;
create policy "service-photos: admin replaces" on storage.objects for update to authenticated
  using (bucket_id = 'service-photos' and (select public.is_admin()))
  with check (bucket_id = 'service-photos' and (select public.is_admin()));
drop policy if exists "service-photos: admin removes" on storage.objects;
create policy "service-photos: admin removes" on storage.objects for delete to authenticated
  using (bucket_id = 'service-photos' and (select public.is_admin()));
