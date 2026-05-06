-- ===================================================================
-- MIGRATION: 20260424_atomic_multi_scheduling_refined.sql
-- Objetivo: Refinar RPC multi-serviço para suportar auto-barbeiro.
-- ===================================================================

CREATE OR REPLACE FUNCTION public.rpc_confirmar_agendamento_multi(
    p_barbearia_id uuid,
    p_cliente_id uuid,
    p_barbeiro_id uuid, -- Pode ser NULL para atribuição automática
    p_servicos jsonb,
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
    v_final_barbeiro_id uuid := p_barbeiro_id;
    v_cand_barbeiro_id uuid;
BEGIN
    -- 1. Calcular duração total
    FOR v_servico IN SELECT * FROM jsonb_to_recordset(p_servicos) AS x(id uuid, duracao int, valor decimal)
    LOOP
        v_duracao_total := v_duracao_total + v_servico.duracao;
    END LOOP;

    v_atual_fim := p_data_inicio + (v_duracao_total || ' minutes')::interval;

    -- 2. Atribuição automática de barbeiro se necessário
    IF v_final_barbeiro_id IS NULL THEN
        -- Tenta encontrar um barbeiro sem conflitos (agendamentos ou bloqueios)
        FOR v_cand_barbeiro_id IN 
            SELECT id FROM public.barbeiros 
            WHERE barbearia_id = p_barbearia_id AND ativo = true
        LOOP
            -- Verifica agendamentos
            SELECT COUNT(*) INTO v_conflito_count
            FROM public.agendamentos
            WHERE barbearia_id = p_barbearia_id
              AND barbeiro_id = v_cand_barbeiro_id
              AND status IN ('pendente', 'confirmado')
              AND (
                  (data_hora_inicio, data_hora_fim) OVERLAPS (p_data_inicio, v_atual_fim)
              );
            
            IF v_conflito_count = 0 THEN
                -- Verifica bloqueios
                SELECT COUNT(*) INTO v_conflito_count
                FROM public.bloqueios
                WHERE barbearia_id = p_barbearia_id
                  AND (barbeiro_id = v_cand_barbeiro_id OR barbeiro_id IS NULL)
                  AND data = (p_data_inicio AT TIME ZONE 'UTC')::date
                  AND (
                      tipo = 'dia' OR
                      (tipo = 'horario' AND (
                          (
                              (p_data_inicio AT TIME ZONE 'UTC')::time, 
                              (v_atual_fim AT TIME ZONE 'UTC')::time
                          ) OVERLAPS (hora_inicio, hora_fim)
                      ))
                  );

                IF v_conflito_count = 0 THEN
                    v_final_barbeiro_id := v_cand_barbeiro_id;
                    EXIT; -- Encontrou
                END IF;
            END IF;
        END LOOP;

        IF v_final_barbeiro_id IS NULL THEN
            RETURN jsonb_build_object('success', false, 'message', 'Nenhum profissional disponível para este horário.');
        END IF;
    ELSE
        -- Validar conflito para o barbeiro informado
        SELECT COUNT(*) INTO v_conflito_count
        FROM public.agendamentos
        WHERE barbearia_id = p_barbearia_id
          AND barbeiro_id = v_final_barbeiro_id
          AND status IN ('pendente', 'confirmado')
          AND (
              (data_hora_inicio, data_hora_fim) OVERLAPS (p_data_inicio, v_atual_fim)
          );

        IF v_conflito_count > 0 THEN
            RETURN jsonb_build_object('success', false, 'message', 'O profissional escolhido já possui um compromisso neste horário.');
        END IF;
    END IF;

    -- 3. Inserir serviços um por um
    FOR v_servico IN SELECT * FROM jsonb_to_recordset(p_servicos) AS x(id uuid, duracao int, valor decimal)
    LOOP
        v_atual_fim := v_atual_inicio + (v_servico.duracao || ' minutes')::interval;
        
        INSERT INTO public.agendamentos (
            barbearia_id, cliente_id, barbeiro_id, servico_id,
            data_hora_inicio, data_hora_fim, valor_estimado, status, observacoes
        ) VALUES (
            p_barbearia_id, p_cliente_id, v_final_barbeiro_id, v_servico.id,
            v_atual_inicio, v_atual_fim, v_servico.valor, 'confirmado', p_observacoes
        ) RETURNING id INTO v_cand_barbeiro_id; -- reuso variável

        v_agendamento_ids := v_agendamento_ids || (v_cand_barbeiro_id::text::uuid);
        v_atual_inicio := v_atual_fim;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'ids', v_agendamento_ids);
END;
$$;
