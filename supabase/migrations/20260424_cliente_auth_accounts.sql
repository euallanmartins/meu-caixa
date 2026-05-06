-- Contas do cliente final separadas das contas profissionais.
-- Clientes usam auth.users, mas nao recebem profile/barbearia de empresa.

CREATE TABLE IF NOT EXISTS public.cliente_accounts (
  auth_user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  barbearia_id uuid NOT NULL REFERENCES public.barbearias(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (barbearia_id, cliente_id)
);

ALTER TABLE public.cliente_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cliente_account_select_self" ON public.cliente_accounts;
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
BEGIN
  IF new.raw_user_meta_data->>'account_type' = 'cliente' THEN
    v_barbearia_id := NULLIF(new.raw_user_meta_data->>'barbearia_id', '')::uuid;
    v_cliente_id := NULLIF(new.raw_user_meta_data->>'cliente_id', '')::uuid;

    IF v_barbearia_id IS NULL OR v_cliente_id IS NULL THEN
      RAISE EXCEPTION 'Conta de cliente sem vinculo de barbearia/cliente.';
    END IF;

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
    ON CONFLICT (auth_user_id) DO UPDATE
    SET cliente_id = excluded.cliente_id,
        barbearia_id = excluded.barbearia_id;

    RETURN new;
  END IF;

  v_shop_name := COALESCE(new.raw_user_meta_data->>'shop_name', 'Minha Barbearia');

  INSERT INTO public.barbearias (nome, proprietario_id)
  VALUES (v_shop_name, new.id)
  RETURNING id INTO v_barbearia_id;

  INSERT INTO public.profiles (id, barbearia_id, full_name, role)
  VALUES (
    new.id,
    v_barbearia_id,
    COALESCE(new.raw_user_meta_data->>'full_name', 'Proprietario'),
    'admin'
  );

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.rpc_cliente_meus_agendamentos_auth()
RETURNS TABLE (
  agendamento_id uuid,
  data_hora_inicio timestamptz,
  data_hora_fim timestamptz,
  status text,
  valor_estimado numeric,
  observacoes text,
  servico_nome text,
  barbeiro_nome text,
  barbearia_nome text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Login necessario.';
  END IF;

  RETURN QUERY
  SELECT
    a.id,
    a.data_hora_inicio,
    a.data_hora_fim,
    a.status,
    a.valor_estimado,
    a.observacoes,
    s.nome AS servico_nome,
    b.nome AS barbeiro_nome,
    ba.nome AS barbearia_nome
  FROM public.cliente_accounts ca
  JOIN public.agendamentos a
    ON a.cliente_id = ca.cliente_id
   AND a.barbearia_id = ca.barbearia_id
  LEFT JOIN public.servicos s ON s.id = a.servico_id
  LEFT JOIN public.barbeiros b ON b.id = a.barbeiro_id
  LEFT JOIN public.barbearias ba ON ba.id = a.barbearia_id
  WHERE ca.auth_user_id = auth.uid()
  ORDER BY a.data_hora_inicio DESC
  LIMIT 100;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_cliente_meus_agendamentos_auth() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_cliente_meus_agendamentos_auth() TO authenticated;
