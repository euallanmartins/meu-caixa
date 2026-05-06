-- Migration: 20260424_fix_booking_timezone_sao_paulo.sql

-- 1. Recriar rpc_get_disponibilidade
CREATE OR REPLACE FUNCTION public.rpc_get_disponibilidade(p_barbearia_id uuid, p_data date)
 RETURNS TABLE(ref_id uuid, tipo text, barbeiro_id uuid, inicio timestamp with time zone, fim timestamp with time zone, subtipo text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
        CASE 
            WHEN b.tipo = 'dia' THEN p_data::timestamp AT TIME ZONE 'America/Sao_Paulo' 
            ELSE (p_data::timestamp + b.hora_inicio) AT TIME ZONE 'America/Sao_Paulo' 
        END,
        CASE 
            WHEN b.tipo = 'dia' THEN ((p_data + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo')
            ELSE (p_data::timestamp + b.hora_fim) AT TIME ZONE 'America/Sao_Paulo' 
        END,
        b.tipo
    FROM public.bloqueios b
    WHERE b.barbearia_id = p_barbearia_id
      AND b.data = p_data;
END;
$function$;

-- 2. Recriar rpc_confirmar_agendamento_multi
CREATE OR REPLACE FUNCTION public.rpc_confirmar_agendamento_multi(p_barbearia_id uuid, p_cliente_id uuid, p_barbeiro_id uuid, p_servicos jsonb, p_data_inicio timestamp with time zone, p_observacoes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
    v_data_local date;
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

    v_data_local := (p_data_inicio AT TIME ZONE 'America/Sao_Paulo')::date;

    v_lock_key := hashtext('booking_' || p_barbearia_id::text || '_' || v_data_local::text);
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
                  AND data = v_data_local
                  AND (
                    tipo = 'dia'
                    OR (
                      tipo = 'horario'
                      AND ((p_data_inicio AT TIME ZONE 'America/Sao_Paulo')::time, (v_atual_fim AT TIME ZONE 'America/Sao_Paulo')::time)
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
          AND data = v_data_local
          AND (
            tipo = 'dia'
            OR (
              tipo = 'horario'
              AND ((p_data_inicio AT TIME ZONE 'America/Sao_Paulo')::time, (v_atual_fim AT TIME ZONE 'America/Sao_Paulo')::time)
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

    RETURN jsonb_build_object('success', true, 'ids', v_agendamento_ids, 'barbeiro_id', v_final_barbeiro_id);
END;
$function$;

-- 3. Reaplicar GRANTs
GRANT EXECUTE ON FUNCTION public.rpc_get_disponibilidade(uuid, date) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_confirmar_agendamento_multi(uuid, uuid, uuid, jsonb, timestamp with time zone, text) TO anon, authenticated;
