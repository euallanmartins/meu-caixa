-- ===================================================================
-- MIGRATION: 20260424_atomic_multi_scheduling.sql
-- Objetivo: Implementar agendamento multi-serviço atômico
--           e refinar a lógica de disponibilidade via RPC.
-- ===================================================================

-- 1. RPC: CONFIRMAÇÃO MULTI-SERVIÇO ATÔMICA
CREATE OR REPLACE FUNCTION public.rpc_confirmar_agendamento_multi(
    p_barbearia_id uuid,
    p_cliente_id uuid,
    p_barbeiro_id uuid,
    p_servicos jsonb, -- Array de {id: uuid, duracao: int, valor: decimal}
    p_data_inicio timestamptz,
    p_observacoes text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_servico record;
    v_atual_inicio timestamptz := p_data_inicio;
    v_atual_fim timestamptz;
    v_conflito_count integer;
    v_agendamento_ids uuid[] := '{}';
    v_duracao_total integer := 0;
BEGIN
    -- 1. Calcular duração total
    FOR v_servico IN SELECT * FROM jsonb_to_recordset(p_servicos) AS x(id uuid, duracao int, valor decimal)
    LOOP
        v_duracao_total := v_duracao_total + v_servico.duracao;
    END LOOP;

    v_atual_fim := p_data_inicio + (v_duracao_total || ' minutes')::interval;

    -- 2. Validar conflito para o bloco inteiro
    SELECT COUNT(*) INTO v_conflito_count
    FROM public.agendamentos
    WHERE barbearia_id = p_barbearia_id
      AND barbeiro_id = p_barbeiro_id
      AND status IN ('pendente', 'confirmado')
      AND (
          (data_hora_inicio, data_hora_fim) OVERLAPS (p_data_inicio, v_atual_fim)
      );

    IF v_conflito_count > 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'Um ou mais serviços conflitam com agendamentos existentes.');
    END IF;

    -- 3. Inserir serviços um por um
    FOR v_servico IN SELECT * FROM jsonb_to_recordset(p_servicos) AS x(id uuid, duracao int, valor decimal)
    LOOP
        v_atual_fim := v_atual_inicio + (v_servico.duracao || ' minutes')::interval;
        
        INSERT INTO public.agendamentos (
            barbearia_id, cliente_id, barbeiro_id, servico_id,
            data_hora_inicio, data_hora_fim, valor_estimado, status, observacoes
        ) VALUES (
            p_barbearia_id, p_cliente_id, p_barbeiro_id, v_servico.id,
            v_atual_inicio, v_atual_fim, v_servico.valor, 'confirmado', p_observacoes
        ) RETURNING id INTO v_conflito_count; -- reuso variável para id

        v_agendamento_ids := v_agendamento_ids || (v_conflito_count::text::uuid);
        v_atual_inicio := v_atual_fim;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'ids', v_agendamento_ids);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_confirmar_agendamento_multi TO anon, authenticated;
