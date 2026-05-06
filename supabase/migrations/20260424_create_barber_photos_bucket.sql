-- Create and harden the public-read barber photo bucket.
-- Public read is intentional because barber photos appear on the public booking page.
-- Writes stay restricted by barbearia folder through storage.objects policies.

INSERT INTO storage.buckets (id, name, public)
VALUES ('barber-photos', 'barber-photos', true)
ON CONFLICT (id) DO UPDATE
SET public = true;

DROP POLICY IF EXISTS "barber_photos_public_read" ON storage.objects;
CREATE POLICY "barber_photos_public_read"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'barber-photos');

DROP POLICY IF EXISTS "barber_photos_authenticated_upload" ON storage.objects;
CREATE POLICY "barber_photos_authenticated_upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'barber-photos'
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (storage.foldername(name))[1] = p.barbearia_id::text
  )
);

DROP POLICY IF EXISTS "barber_photos_authenticated_update" ON storage.objects;
CREATE POLICY "barber_photos_authenticated_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'barber-photos'
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (storage.foldername(name))[1] = p.barbearia_id::text
  )
)
WITH CHECK (
  bucket_id = 'barber-photos'
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (storage.foldername(name))[1] = p.barbearia_id::text
  )
);

DROP POLICY IF EXISTS "barber_photos_authenticated_delete" ON storage.objects;
CREATE POLICY "barber_photos_authenticated_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'barber-photos'
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (storage.foldername(name))[1] = p.barbearia_id::text
  )
);
