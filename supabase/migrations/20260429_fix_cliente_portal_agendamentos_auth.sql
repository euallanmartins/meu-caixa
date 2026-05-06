CREATE OR REPLACE FUNCTION public.rpc_cliente_meus_agendamentos_auth(
  p_barbearia_id uuid
)
RETURNS TABLE (
  agendamento_id uuid,
  barbearia_id uuid,
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
DECLARE
  v_auth_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Login necessario.';
  END IF;

  IF p_barbearia_id IS NULL THEN
    RAISE EXCEPTION 'Barbearia obrigatoria.';
  END IF;

  SELECT lower(email)
  INTO v_auth_email
  FROM auth.users
  WHERE id = auth.uid();

  IF v_auth_email IS NOT NULL THEN
    INSERT INTO public.cliente_accounts (auth_user_id, cliente_id, barbearia_id)
    SELECT auth.uid(), c.id, c.barbearia_id
    FROM public.clientes c
    WHERE c.barbearia_id = p_barbearia_id
      AND lower(c.email) = v_auth_email
    ON CONFLICT (auth_user_id, barbearia_id) DO UPDATE
    SET cliente_id = excluded.cliente_id;
  END IF;

  RETURN QUERY
  SELECT
    a.id::uuid AS agendamento_id,
    a.barbearia_id::uuid AS barbearia_id,
    a.data_hora_inicio::timestamptz AS data_hora_inicio,
    a.data_hora_fim::timestamptz AS data_hora_fim,
    a.status::text AS status,
    a.valor_estimado::numeric AS valor_estimado,
    a.observacoes::text AS observacoes,
    s.nome::text AS servico_nome,
    b.nome::text AS barbeiro_nome,
    ba.nome::text AS barbearia_nome
  FROM public.cliente_accounts ca
  JOIN public.agendamentos a
    ON a.cliente_id = ca.cliente_id
   AND a.barbearia_id = ca.barbearia_id
  LEFT JOIN public.servicos s
    ON s.id = a.servico_id
   AND s.barbearia_id = a.barbearia_id
  LEFT JOIN public.barbeiros b
    ON b.id = a.barbeiro_id
   AND b.barbearia_id = a.barbearia_id
  LEFT JOIN public.barbearias ba
    ON ba.id = a.barbearia_id
  WHERE ca.auth_user_id = auth.uid()
    AND ca.barbearia_id = p_barbearia_id
    AND a.barbearia_id = p_barbearia_id
  ORDER BY a.data_hora_inicio DESC
  LIMIT 100;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_cliente_meus_agendamentos_auth(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_cliente_meus_agendamentos_auth(uuid) TO authenticated;
