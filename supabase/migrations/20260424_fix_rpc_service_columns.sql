-- ===================================================================
-- MIGRATION: 20260424_fix_rpc_service_columns.sql
-- Objetivo: Corrigir a RPC hardened para usar as colunas reais de
--           public.servicos e manter compatibilidade com o frontend.
-- ===================================================================

DROP FUNCTION IF EXISTS public.rpc_confirmar_agendamento_multi(uuid, uuid, uuid, jsonb, timestamptz, text);

CREATE OR REPLACE FUNCTION public.rpc_confirmar_agendamento_multi(
    p_barbearia_id uuid,
    p_cliente_id uuid,
    p_barbeiro_id uuid,
    p_servicos jsonb, -- [{id: uuid}]
    p_data_inicio timestamptz,
    p_observacoes text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_servico_id uuid;
    v_serv_record record;
    v_atual_inicio timestamptz := p_data_inicio;
    v_atual_fim timestamptz;
    v_conflito_count integer;
    v_agendamento_ids uuid[] := '{}';
    v_duracao_total integer := 0;
    v_final_barbeiro_id uuid := p_barbeiro_id;
    v_cand_barbeiro_id uuid;
    v_lock_key bigint;
    v_cliente_valido boolean;
    v_barbeiro_valido boolean;
BEGIN
    IF p_servicos IS NULL OR jsonb_typeof(p_servicos) <> 'array' OR jsonb_array_length(p_servicos) = 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'Selecione ao menos um servico.');
    END IF;

    SELECT EXISTS (
        SELECT 1
        FROM public.clientes
        WHERE id = p_cliente_id
          AND barbearia_id = p_barbearia_id
    ) INTO v_cliente_valido;

    IF NOT v_cliente_valido THEN
        RETURN jsonb_build_object('success', false, 'message', 'Dados do cliente invalidos ou inconsistentes.');
    END IF;

    IF p_barbeiro_id IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1
            FROM public.barbeiros
            WHERE id = p_barbeiro_id
              AND barbearia_id = p_barbearia_id
              AND ativo = true
        ) INTO v_barbeiro_valido;

        IF NOT v_barbeiro_valido THEN
            RETURN jsonb_build_object('success', false, 'message', 'O profissional escolhido nao esta disponivel.');
        END IF;
    END IF;

    FOR v_servico_id IN
        SELECT (value->>'id')::uuid
        FROM jsonb_array_elements(p_servicos)
    LOOP
        SELECT id, duracao_minutos, valor, barbearia_id
        INTO v_serv_record
        FROM public.servicos
        WHERE id = v_servico_id;

        IF v_serv_record.id IS NULL OR v_serv_record.barbearia_id <> p_barbearia_id THEN
            RETURN jsonb_build_object('success', false, 'message', 'Um ou mais servicos sao invalidos para esta barbearia.');
        END IF;

        v_duracao_total := v_duracao_total + COALESCE(v_serv_record.duracao_minutos, 30);
    END LOOP;

    v_atual_fim := p_data_inicio + (v_duracao_total || ' minutes')::interval;

    v_lock_key := hashtext('booking_' || p_barbearia_id::text || '_' || (p_data_inicio AT TIME ZONE 'UTC')::date::text);
    PERFORM pg_advisory_xact_lock(v_lock_key);

    IF v_final_barbeiro_id IS NULL THEN
        FOR v_cand_barbeiro_id IN
            SELECT id
            FROM public.barbeiros
            WHERE barbearia_id = p_barbearia_id
              AND ativo = true
            ORDER BY nome, id
        LOOP
            SELECT COUNT(*) INTO v_conflito_count
            FROM public.agendamentos
            WHERE barbearia_id = p_barbearia_id
              AND barbeiro_id = v_cand_barbeiro_id
              AND status IN ('pendente', 'confirmado')
              AND (data_hora_inicio, data_hora_fim) OVERLAPS (p_data_inicio, v_atual_fim);

            IF v_conflito_count = 0 THEN
                SELECT COUNT(*) INTO v_conflito_count
                FROM public.bloqueios
                WHERE barbearia_id = p_barbearia_id
                  AND (barbeiro_id = v_cand_barbeiro_id OR barbeiro_id IS NULL)
                  AND data = (p_data_inicio AT TIME ZONE 'UTC')::date
                  AND (
                    tipo = 'dia'
                    OR (
                      tipo = 'horario'
                      AND ((p_data_inicio AT TIME ZONE 'UTC')::time, (v_atual_fim AT TIME ZONE 'UTC')::time)
                        OVERLAPS (hora_inicio, hora_fim)
                    )
                  );

                IF v_conflito_count = 0 THEN
                    v_final_barbeiro_id := v_cand_barbeiro_id;
                    EXIT;
                END IF;
            END IF;
        END LOOP;

        IF v_final_barbeiro_id IS NULL THEN
            RETURN jsonb_build_object('success', false, 'message', 'Nao ha profissionais disponiveis para este intervalo.');
        END IF;
    ELSE
        SELECT COUNT(*) INTO v_conflito_count
        FROM public.agendamentos
        WHERE barbearia_id = p_barbearia_id
          AND barbeiro_id = v_final_barbeiro_id
          AND status IN ('pendente', 'confirmado')
          AND (data_hora_inicio, data_hora_fim) OVERLAPS (p_data_inicio, v_atual_fim);

        IF v_conflito_count > 0 THEN
            RETURN jsonb_build_object('success', false, 'message', 'Horario ocupado ou indisponivel.');
        END IF;

        SELECT COUNT(*) INTO v_conflito_count
        FROM public.bloqueios
        WHERE barbearia_id = p_barbearia_id
          AND (barbeiro_id = v_final_barbeiro_id OR barbeiro_id IS NULL)
          AND data = (p_data_inicio AT TIME ZONE 'UTC')::date
          AND (
            tipo = 'dia'
            OR (
              tipo = 'horario'
              AND ((p_data_inicio AT TIME ZONE 'UTC')::time, (v_atual_fim AT TIME ZONE 'UTC')::time)
                OVERLAPS (hora_inicio, hora_fim)
            )
          );

        IF v_conflito_count > 0 THEN
            RETURN jsonb_build_object('success', false, 'message', 'Este profissional possui um bloqueio no horario selecionado.');
        END IF;
    END IF;

    FOR v_servico_id IN
        SELECT (value->>'id')::uuid
        FROM jsonb_array_elements(p_servicos)
    LOOP
        SELECT id, duracao_minutos, valor, barbearia_id
        INTO v_serv_record
        FROM public.servicos
        WHERE id = v_servico_id
          AND barbearia_id = p_barbearia_id;

        IF v_serv_record.id IS NULL THEN
            RETURN jsonb_build_object('success', false, 'message', 'Servico invalido durante a confirmacao.');
        END IF;

        v_atual_fim := v_atual_inicio + (COALESCE(v_serv_record.duracao_minutos, 30) || ' minutes')::interval;

        INSERT INTO public.agendamentos (
            barbearia_id,
            cliente_id,
            barbeiro_id,
            servico_id,
            data_hora_inicio,
            data_hora_fim,
            valor_estimado,
            status,
            observacoes
        ) VALUES (
            p_barbearia_id,
            p_cliente_id,
            v_final_barbeiro_id,
            v_servico_id,
            v_atual_inicio,
            v_atual_fim,
            v_serv_record.valor,
            'confirmado',
            NULLIF(TRIM(COALESCE(p_observacoes, '')), '')
        ) RETURNING id INTO v_cand_barbeiro_id;

        v_agendamento_ids := v_agendamento_ids || v_cand_barbeiro_id;
        v_atual_inicio := v_atual_fim;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'ids', v_agendamento_ids);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_confirmar_agendamento_multi(uuid, uuid, uuid, jsonb, timestamptz, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_get_disponibilidade(uuid, date) TO anon, authenticated;
