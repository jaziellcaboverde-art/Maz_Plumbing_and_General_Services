-- Step 2.15: private storage buckets with file type and size limits. Links are signed, never public.
-- Folder rules:
--   ids, selfies:                       first folder is the owner's user id
--   receipts, proof-photos, signatures: first folder is the booking id

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('ids',          'ids',          false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('selfies',      'selfies',      false,  5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('receipts',     'receipts',     false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('proof-photos', 'proof-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('signatures',   'signatures',   false,  1048576, array['image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ids and selfies: the owner and admin read. The owner uploads. Q20 (retention) is still open.
create policy "ids and selfies: owner or admin reads" on storage.objects
  for select to authenticated
  using (
    bucket_id in ('ids', 'selfies')
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin()))
  );
create policy "ids and selfies: owner uploads" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('ids', 'selfies')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- receipts and proof photos: both parties and admin read. Both parties upload.
create policy "receipts and proof photos: parties or admin read" on storage.objects
  for select to authenticated
  using (
    bucket_id in ('receipts', 'proof-photos')
    and ((select public.is_booking_party_text((storage.foldername(name))[1])) or (select public.is_admin()))
  );
create policy "receipts and proof photos: parties upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('receipts', 'proof-photos')
    and (select public.is_booking_party_text((storage.foldername(name))[1]))
  );

-- signatures: parties and admin read. No browser upload. Server code saves signatures,
-- so a saved signature cannot be swapped.
create policy "signatures: parties or admin read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'signatures'
    and ((select public.is_booking_party_text((storage.foldername(name))[1])) or (select public.is_admin()))
  );
