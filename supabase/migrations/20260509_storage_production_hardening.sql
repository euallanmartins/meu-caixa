-- Production hardening for authenticated barber-photos uploads.
-- Keeps the same tenant paths, but enforces the same image extension allowlist at Storage policy level.

update storage.buckets
set
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'barber-photos';

drop policy if exists "barber_photos_authenticated_upload" on storage.objects;
create policy "barber_photos_authenticated_upload"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'barber-photos'
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
  and (
    (
      (storage.foldername(name))[1] = 'barbearias'
      and (storage.foldername(name))[2] in (
        select p.barbearia_id::text
        from public.profiles p
        where p.id = auth.uid()
      )
    )
    or (storage.foldername(name))[1] in (
      select p.barbearia_id::text
      from public.profiles p
      where p.id = auth.uid()
    )
  )
);

drop policy if exists "barber_photos_authenticated_update" on storage.objects;
create policy "barber_photos_authenticated_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'barber-photos'
  and (
    (
      (storage.foldername(name))[1] = 'barbearias'
      and (storage.foldername(name))[2] in (
        select p.barbearia_id::text
        from public.profiles p
        where p.id = auth.uid()
      )
    )
    or (storage.foldername(name))[1] in (
      select p.barbearia_id::text
      from public.profiles p
      where p.id = auth.uid()
    )
  )
)
with check (
  bucket_id = 'barber-photos'
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
  and (
    (
      (storage.foldername(name))[1] = 'barbearias'
      and (storage.foldername(name))[2] in (
        select p.barbearia_id::text
        from public.profiles p
        where p.id = auth.uid()
      )
    )
    or (storage.foldername(name))[1] in (
      select p.barbearia_id::text
      from public.profiles p
      where p.id = auth.uid()
    )
  )
);
