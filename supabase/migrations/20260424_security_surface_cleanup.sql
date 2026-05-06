-- Security surface cleanup for public scheduling and barber photo storage.
-- 1. Remove obsolete public RPCs that are no longer used by the frontend.
-- 2. Harden client lookup to require email + phone, reducing account enumeration.
-- 3. Restrict barber photo writes to authenticated users of the same barbearia.

DROP FUNCTION IF EXISTS public.rpc_confirmar_agendamento(
  uuid,
  uuid,
  uuid,
  uuid,
  timestamptz,
  timestamptz,
  text
);

DROP FUNCTION IF EXISTS public.rpc_get_disponibilidade(uuid, timestamptz, timestamptz);
DROP FUNCTION IF EXISTS public.rpc_lookup_cliente(uuid, text);

CREATE OR REPLACE FUNCTION public.rpc_lookup_cliente(
  p_barbearia_id uuid,
  p_email text,
  p_telefone text
) RETURNS TABLE (
  id uuid,
  nome text,
  telefone text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_email text := lower(trim(coalesce(p_email, '')));
  v_phone_digits text := regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g');
BEGIN
  IF v_email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RETURN;
  END IF;

  IF length(v_phone_digits) < 10 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT c.id, c.nome, c.telefone
  FROM public.clientes c
  WHERE c.barbearia_id = p_barbearia_id
    AND lower(c.email) = v_email
    AND regexp_replace(coalesce(c.telefone, ''), '\D', '', 'g') = v_phone_digits
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_lookup_cliente(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_lookup_cliente(uuid, text, text) TO anon, authenticated;

DROP POLICY IF EXISTS "barber_photos_authenticated_upload" ON storage.objects;
DROP POLICY IF EXISTS "barber_photos_authenticated_update" ON storage.objects;
DROP POLICY IF EXISTS "barber_photos_authenticated_delete" ON storage.objects;

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
