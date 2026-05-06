-- Client Google OAuth support for multi-tenant scheduling.
-- A single auth user can be linked to one customer record per barbearia.

ALTER TABLE public.cliente_accounts
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();

UPDATE public.cliente_accounts
SET id = gen_random_uuid()
WHERE id IS NULL;

ALTER TABLE public.cliente_accounts
  ALTER COLUMN id SET NOT NULL;

ALTER TABLE public.cliente_accounts
  DROP CONSTRAINT IF EXISTS cliente_accounts_pkey;

ALTER TABLE public.cliente_accounts
  ADD CONSTRAINT cliente_accounts_pkey PRIMARY KEY (id);

ALTER TABLE public.cliente_accounts
  DROP CONSTRAINT IF EXISTS cliente_accounts_auth_user_id_barbearia_id_key;

ALTER TABLE public.cliente_accounts
  DROP CONSTRAINT IF EXISTS cliente_accounts_barbearia_id_cliente_id_key;

ALTER TABLE public.cliente_accounts
  ADD CONSTRAINT cliente_accounts_auth_user_id_barbearia_id_key UNIQUE (auth_user_id, barbearia_id);

ALTER TABLE public.cliente_accounts
  ADD CONSTRAINT cliente_accounts_barbearia_id_cliente_id_key UNIQUE (barbearia_id, cliente_id);

ALTER TABLE public.cliente_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cliente_account_select_self" ON public.cliente_accounts;
DROP POLICY IF EXISTS "cliente_account_insert_self" ON public.cliente_accounts;
DROP POLICY IF EXISTS "cliente_account_update_self" ON public.cliente_accounts;
DROP POLICY IF EXISTS "cliente_account_delete_self" ON public.cliente_accounts;

CREATE POLICY "cliente_account_select_self"
ON public.cliente_accounts
FOR SELECT
TO authenticated
USING (auth.uid() = auth_user_id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_barbearia_id uuid;
  v_cliente_id uuid;
  v_shop_name text;
  v_provider text;
BEGIN
  IF new.raw_user_meta_data->>'account_type' = 'cliente' THEN
    v_barbearia_id := NULLIF(new.raw_user_meta_data->>'barbearia_id', '')::uuid;
    v_cliente_id := NULLIF(new.raw_user_meta_data->>'cliente_id', '')::uuid;

    IF v_barbearia_id IS NOT NULL AND v_cliente_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1
        FROM public.clientes c
        WHERE c.id = v_cliente_id
          AND c.barbearia_id = v_barbearia_id
          AND lower(c.email) = lower(new.email)
      ) THEN
        RAISE EXCEPTION 'Dados de cliente invalidos para criar conta.';
      END IF;

      INSERT INTO public.cliente_accounts (auth_user_id, cliente_id, barbearia_id)
      VALUES (new.id, v_cliente_id, v_barbearia_id)
      ON CONFLICT (auth_user_id, barbearia_id) DO UPDATE
      SET cliente_id = excluded.cliente_id;
    END IF;

    RETURN new;
  END IF;

  v_provider := COALESCE(new.raw_app_meta_data->>'provider', '');
  v_shop_name := NULLIF(new.raw_user_meta_data->>'shop_name', '');

  -- Google client accounts arrive without shop_name. Do not create a professional profile.
  -- They will be linked to cliente_accounts through rpc_vincular_cliente_auth.
  IF v_shop_name IS NULL AND v_provider = 'google' THEN
    RETURN new;
  END IF;

  v_shop_name := COALESCE(v_shop_name, 'Minha Barbearia');

  INSERT INTO public.barbearias (nome, proprietario_id)
  VALUES (v_shop_name, new.id)
  RETURNING id INTO v_barbearia_id;

  INSERT INTO public.profiles (id, barbearia_id, full_name, role)
  VALUES (
    new.id,
    v_barbearia_id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'Proprietario'),
    'admin'
  );

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.rpc_vincular_cliente_auth(
  p_barbearia_id uuid,
  p_nome text,
  p_email text,
  p_telefone text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_auth_user_id uuid := auth.uid();
  v_auth_email text;
  v_email text;
  v_phone_digits text := regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g');
  v_cliente_id uuid;
BEGIN
  IF v_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'Login necessario.';
  END IF;

  SELECT lower(email)
  INTO v_auth_email
  FROM auth.users
  WHERE id = v_auth_user_id;

  v_email := lower(trim(coalesce(v_auth_email, p_email)));

  IF v_email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RAISE EXCEPTION 'E-mail invalido.';
  END IF;

  IF length(v_phone_digits) < 10 THEN
    RAISE EXCEPTION 'Telefone invalido.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.barbearias WHERE id = p_barbearia_id) THEN
    RAISE EXCEPTION 'Barbearia invalida.';
  END IF;

  SELECT id
  INTO v_cliente_id
  FROM public.clientes
  WHERE barbearia_id = p_barbearia_id
    AND lower(email) = v_email
  LIMIT 1;

  IF v_cliente_id IS NULL THEN
    INSERT INTO public.clientes (barbearia_id, nome, email, telefone)
    VALUES (p_barbearia_id, trim(p_nome), v_email, trim(p_telefone))
    RETURNING id INTO v_cliente_id;
  ELSE
    UPDATE public.clientes
    SET nome = trim(p_nome),
        telefone = trim(p_telefone)
    WHERE id = v_cliente_id
      AND barbearia_id = p_barbearia_id;
  END IF;

  INSERT INTO public.cliente_accounts (auth_user_id, cliente_id, barbearia_id)
  VALUES (v_auth_user_id, v_cliente_id, p_barbearia_id)
  ON CONFLICT (auth_user_id, barbearia_id) DO UPDATE
  SET cliente_id = excluded.cliente_id;

  RETURN v_cliente_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_vincular_cliente_auth(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_vincular_cliente_auth(uuid, text, text, text) TO authenticated;
