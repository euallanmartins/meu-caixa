-- ===================================================================
-- MIGRATION: 20260424_ultimate_rpc_hardening.sql
-- Objetivo: Blindagem total no lado do servidor.
--           1. Validação de pertencimento (Barbearia/Cliente/Barbeiro/Serviços).
--           2. Recálculo interno de Preço/Duração (Zero confiança no JSON).
--           3. RPC unificada de disponibilidade (Agendamentos + Bloqueios).
-- ===================================================================

-- 1. DROP funções antigas para garantir nova assinatura/lógica
DROP FUNCTION IF EXISTS public.rpc_get_disponibilidade(uuid, timestamptz, timestamptz);
DROP FUNCTION IF EXISTS public.rpc_confirmar_agendamento_multi(uuid, uuid, uuid, jsonb, timestamptz, text);

-- 2. RPC UNIFICADA DE DISPONIBILIDADE (Agendamentos + Bloqueios do Dia)
CREATE OR REPLACE FUNCTION public.rpc_get_disponibilidade(
    p_barbearia_id uuid,
    p_data date -- Passamos apenas o dia para buscar tudo de uma vez
) RETURNS TABLE (
    ref_id uuid,
    tipo text, -- 'agendamento' ou 'bloqueio'
    barbeiro_id uuid,
    inicio timestamptz,
    fim timestamptz,
    subtipo text -- 'pendente', 'confirmado', 'dia', 'horario'
) LANGUAGE plpgsql SECURITY DEFINER 
SET search_path = public, pg_temp
AS $$
BEGIN
    -- Agendamentos
    RETURN QUERY
    SELECT a.id, 'agendamento'::text, a.barbeiro_id, a.data_hora_inicio, a.data_hora_fim, a.status
    FROM public.agendamentos a
    WHERE a.barbearia_id = p_barbearia_id
      AND a.status IN ('pendente', 'confirmado')
      AND (a.data_hora_inicio::date = p_data OR a.data_hora_fim::date = p_data);

    -- Bloqueios
    RETURN QUERY
    SELECT 
        b.id, 
        'bloqueio'::text, 
        b.barbeiro_id, 
        CASE WHEN b.tipo = 'dia' THEN (p_data + time '00:00')::timestamptz ELSE (p_data + b.hora_inicio)::timestamptz END,
        CASE WHEN b.tipo = 'dia' THEN (p_data + time '23:59')::timestamptz ELSE (p_data + b.hora_fim)::timestamptz END,
        b.tipo
    FROM public.bloqueios b
    WHERE b.barbearia_id = p_barbearia_id
      AND b.data = p_data;
END;
$$;

-- 3. RPC DE AGENDAMENTO HARDENED (Lógica de Negócio In-DB)
CREATE OR REPLACE FUNCTION public.rpc_confirmar_agendamento_multi(
    p_barbearia_id uuid,
    p_cliente_id uuid,
    p_barbeiro_id uuid,
    p_servicos_json jsonb, -- [{id: uuid}]
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
    -- 1. VALIDAÇÃO DE PERTENCIMENTO E SEGURANÇA
    -- 1.1 Cliente pertence à barbearia?
    SELECT EXISTS(SELECT 1 FROM public.clientes WHERE id = p_cliente_id AND barbearia_id = p_barbearia_id) INTO v_cliente_valido;
    IF NOT v_cliente_valido THEN
        RETURN jsonb_build_object('success', false, 'message', 'Dados do cliente inválidos ou inconsistentes.');
    END IF;

    -- 1.2 Barbeiro (se informado) pertence à barbearia e está ativo?
    IF p_barbeiro_id IS NOT NULL THEN
        SELECT EXISTS(SELECT 1 FROM public.barbeiros WHERE id = p_barbeiro_id AND barbearia_id = p_barbearia_id AND ativo = true) INTO v_barbeiro_valido;
        IF NOT v_barbeiro_valido THEN
            RETURN jsonb_build_object('success', false, 'message', 'O profissional escolhido não está disponível.');
        END IF;
    END IF;

    -- 1.3 Recalcular Duração Total baseado na TABELA SERVIÇOS (Não confia no JSON)
    FOR v_servico_id IN SELECT (value->>'id')::uuid FROM jsonb_array_elements(p_servicos_json)
    LOOP
        SELECT duracao, barbearia_id INTO v_serv_record FROM public.servicos WHERE id = v_servico_id;
        IF v_serv_record.id IS NULL OR v_serv_record.barbearia_id != p_barbearia_id THEN
            RETURN jsonb_build_object('success', false, 'message', 'Um ou mais serviços são inválidos para esta barbearia.');
        END IF;
        v_duracao_total := v_duracao_total + v_serv_record.duracao;
    END LOOP;
    
    v_atual_fim := p_data_inicio + (v_duracao_total || ' minutes')::interval;

    -- 2. ADVISORY LOCK (Serialização de agendamentos no dia)
    v_lock_key := hashtext('booking_' || p_barbearia_id::text || '_' || (p_data_inicio AT TIME ZONE 'UTC')::date::text);
    PERFORM pg_advisory_xact_lock(v_lock_key);

    -- 3. BUSCA/VALIDAÇÃO DE DISPONIBILIDADE
    IF v_final_barbeiro_id IS NULL THEN
        FOR v_cand_barbeiro_id IN SELECT id FROM public.barbeiros WHERE barbearia_id = p_barbearia_id AND ativo = true
        LOOP
            -- Conflitos agendamentos
            SELECT COUNT(*) INTO v_conflito_count FROM public.agendamentos
            WHERE barbearia_id = p_barbearia_id AND barbeiro_id = v_cand_barbeiro_id
              AND status IN ('pendente', 'confirmado')
              AND (data_hora_inicio, data_hora_fim) OVERLAPS (p_data_inicio, v_atual_fim);
            
            IF v_conflito_count = 0 THEN
                -- Conflitos bloqueios
                SELECT COUNT(*) INTO v_conflito_count FROM public.bloqueios
                WHERE barbearia_id = p_barbearia_id AND (barbeiro_id = v_cand_barbeiro_id OR barbeiro_id IS NULL)
                  AND data = (p_data_inicio AT TIME ZONE 'UTC')::date
                  AND (tipo = 'dia' OR (tipo = 'horario' AND ((p_data_inicio AT TIME ZONE 'UTC')::time, (v_atual_fim AT TIME ZONE 'UTC')::time) OVERLAPS (hora_inicio, hora_fim)));

                IF v_conflito_count = 0 THEN
                    v_final_barbeiro_id := v_cand_barbeiro_id;
                    EXIT;
                END IF;
            END IF;
        END LOOP;

        IF v_final_barbeiro_id IS NULL THEN
            RETURN jsonb_build_object('success', false, 'message', 'Não há profissionais disponíveis para este intervalo.');
        END IF;
    ELSE
        -- Validação específica
        SELECT COUNT(*) INTO v_conflito_count FROM public.agendamentos
        WHERE barbearia_id = p_barbearia_id AND barbeiro_id = v_final_barbeiro_id
          AND status IN ('pendente', 'confirmado')
          AND (data_hora_inicio, data_hora_fim) OVERLAPS (p_data_inicio, v_atual_fim);

        IF v_conflito_count > 0 THEN
            RETURN jsonb_build_object('success', false, 'message', 'Horário ocupado ou indisponível.');
        END IF;

        SELECT COUNT(*) INTO v_conflito_count FROM public.bloqueios
        WHERE barbearia_id = p_barbearia_id AND (barbeiro_id = v_final_barbeiro_id OR barbeiro_id IS NULL)
            AND data = (p_data_inicio AT TIME ZONE 'UTC')::date
            AND (tipo = 'dia' OR (tipo = 'horario' AND ((p_data_inicio AT TIME ZONE 'UTC')::time, (v_atual_fim AT TIME ZONE 'UTC')::time) OVERLAPS (hora_inicio, hora_fim)));
        
        IF v_conflito_count > 0 THEN
            RETURN jsonb_build_object('success', false, 'message', 'Este profissional possui um bloqueio no horário selecionado.');
        END IF;
    END IF;

    -- 4. INSERÇÃO ATÔMICA (DADOS DA TABELA SERVIÇOS)
    FOR v_servico_id IN SELECT (value->>'id')::uuid FROM jsonb_array_elements(p_servicos_json)
    LOOP
        SELECT duracao, valor INTO v_serv_record FROM public.servicos WHERE id = v_servico_id;
        v_atual_fim := v_atual_inicio + (v_serv_record.duracao || ' minutes')::interval;
        
        INSERT INTO public.agendamentos (
            barbearia_id, cliente_id, barbeiro_id, servico_id,
            data_hora_inicio, data_hora_fim, valor_estimado, status, observacoes
        ) VALUES (
            p_barbearia_id, p_cliente_id, v_final_barbeiro_id, v_servico_id,
            v_atual_inicio, v_atual_fim, v_serv_record.valor, 'confirmado', TRIM(p_observacoes)
        ) RETURNING id INTO v_cand_barbeiro_id; -- Reuso de variável para ID do novo agendamento

        v_agendamento_ids := v_agendamento_ids || v_cand_barbeiro_id;
        v_atual_inicio := v_atual_fim;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'ids', v_agendamento_ids);
END;
$$;
