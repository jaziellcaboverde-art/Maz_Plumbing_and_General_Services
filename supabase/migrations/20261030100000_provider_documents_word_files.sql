-- Provider documents: allow Word files, and the two optional document kinds the application form already sends.
-- Before this, the kind check did not list 'resume' or 'medical_certificate', so an application that
-- included either one would have been refused by the database.

alter table public.provider_documents drop constraint if exists provider_documents_kind_check;
alter table public.provider_documents add constraint provider_documents_kind_check
  check (kind in (
    'government_id', 'selfie', 'nbi_clearance', 'proof_of_address',
    'skill_certificate', 'resume', 'medical_certificate'
  ));

-- The private "ids" bucket also accepts .doc and .docx. Selfies stay image-only.
update storage.buckets
set allowed_mime_types = array[
  'image/jpeg', 'image/png', 'image/webp', 'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]
where id = 'ids';
