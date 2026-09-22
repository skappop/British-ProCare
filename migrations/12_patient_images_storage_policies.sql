-- Storage access policies for the patient-images bucket.
-- Run this in Supabase SQL Editor (Project -> SQL Editor -> New Query).
--
-- The bridge and agent reach storage with the service role, which bypasses RLS,
-- so uploads work without these. The web app does not: it creates signed URLs
-- as the signed-in user (imageActions.ts -> getSignedUrls), and manual uploads
-- go the same way. With no policies on the bucket both are denied, so the
-- gallery renders empty tiles even though the files and records exist.
--
-- Mirrors the authenticated_full_access shape used on the app's tables.
-- Keep the bucket PRIVATE: access is via short-lived signed URLs, and making it
-- public would expose patient images to anyone who guesses a path.

drop policy if exists "patient_images_select" on storage.objects;
create policy "patient_images_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'patient-images');

drop policy if exists "patient_images_insert" on storage.objects;
create policy "patient_images_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'patient-images');

drop policy if exists "patient_images_update" on storage.objects;
create policy "patient_images_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'patient-images')
  with check (bucket_id = 'patient-images');

drop policy if exists "patient_images_delete" on storage.objects;
create policy "patient_images_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'patient-images');
