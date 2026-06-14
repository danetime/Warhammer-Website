-- ============================================================================
-- The Old World League — Storage policies
-- ============================================================================
-- storage.objects has its own Row Level Security (separate from the data
-- tables). The `photos` and `library-pdfs` buckets are public, so downloads
-- work via public URLs without a policy, but UPLOADS/UPDATES/DELETES need
-- these policies. Without them, photo upload fails with an RLS error.
--
-- Run this once in the Supabase SQL Editor. These let any signed-in member
-- write to the two buckets — appropriate for a members-only club; tighten in
-- Step 5 if desired.
-- ============================================================================

-- photos bucket -------------------------------------------------------------
drop policy if exists "photos insert" on storage.objects;
create policy "photos insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'photos');

drop policy if exists "photos update" on storage.objects;
create policy "photos update" on storage.objects
  for update to authenticated using (bucket_id = 'photos') with check (bucket_id = 'photos');

drop policy if exists "photos delete" on storage.objects;
create policy "photos delete" on storage.objects
  for delete to authenticated using (bucket_id = 'photos');

-- library-pdfs bucket -------------------------------------------------------
drop policy if exists "pdfs insert" on storage.objects;
create policy "pdfs insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'library-pdfs');

drop policy if exists "pdfs update" on storage.objects;
create policy "pdfs update" on storage.objects
  for update to authenticated using (bucket_id = 'library-pdfs') with check (bucket_id = 'library-pdfs');

drop policy if exists "pdfs delete" on storage.objects;
create policy "pdfs delete" on storage.objects
  for delete to authenticated using (bucket_id = 'library-pdfs');
