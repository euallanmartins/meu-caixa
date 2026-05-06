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
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Login necessario.';
  END IF;

  IF p_barbearia_id IS NULL THEN
    RAISE EXCEPTION 'Barbearia obrigatoria.';
  END IF;

  RETURN QUERY
  SELECT
    a.id,
    a.barbearia_id,
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
