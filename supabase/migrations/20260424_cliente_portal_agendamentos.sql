-- Portal do cliente: consulta segura de agendamentos por e-mail + telefone.
-- A funcao e SECURITY DEFINER para nao abrir SELECT anon direto em clientes/agendamentos.

CREATE OR REPLACE FUNCTION public.rpc_cliente_meus_agendamentos(
  p_barbearia_id uuid,
  p_email text,
  p_telefone text
) RETURNS TABLE (
  agendamento_id uuid,
  data_hora_inicio timestamptz,
  data_hora_fim timestamptz,
  status text,
  valor_estimado numeric,
  observacoes text,
  servico_nome text,
  barbeiro_nome text,
  barbearia_nome text
) LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_email text := lower(trim(p_email));
  v_phone_digits text := regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g');
BEGIN
  IF v_email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RAISE EXCEPTION 'E-mail invalido.';
  END IF;

  IF length(v_phone_digits) < 10 THEN
    RAISE EXCEPTION 'Telefone invalido.';
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
  FROM public.clientes c
  JOIN public.agendamentos a
    ON a.cliente_id = c.id
   AND a.barbearia_id = c.barbearia_id
  LEFT JOIN public.servicos s ON s.id = a.servico_id
  LEFT JOIN public.barbeiros b ON b.id = a.barbeiro_id
  LEFT JOIN public.barbearias ba ON ba.id = a.barbearia_id
  WHERE c.barbearia_id = p_barbearia_id
    AND lower(c.email) = v_email
    AND regexp_replace(coalesce(c.telefone, ''), '\D', '', 'g') = v_phone_digits
  ORDER BY a.data_hora_inicio DESC
  LIMIT 100;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_cliente_meus_agendamentos(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_cliente_meus_agendamentos(uuid, text, text) TO anon, authenticated;
