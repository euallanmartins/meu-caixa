-- ===================================================================
-- MIGRATION: 20260424_hardened_security_and_locking.sql
-- Objetivo: Blindagem de segurança (Search Path), prevenção de 
--           Race Conditions (Advisory Locks) e Refatoração de Clientes.
-- ===================================================================

-- 1. RPC: LOOKUP DE CLIENTE (Seguro & Hardened)
CREATE OR REPLACE FUNCTION public.rpc_lookup_cliente(
    p_barbearia_id uuid,
    p_email text
) RETURNS TABLE (
    id uuid,
    nome text,
    telefone text
) LANGUAGE plpgsql SECURITY DEFINER 
SET search_path = public, pg_temp 
AS $$
BEGIN
    RETURN QUERY
    SELECT c.id, c.nome, c.telefone
    FROM public.clientes c
    WHERE c.barbearia_id = p_barbearia_id
      AND LOWER(c.email) = LOWER(TRIM(p_email))
    LIMIT 1;
END;
$$;

-- 2. RPC: DISPONIBILIDADE (Hardened)
CREATE OR REPLACE FUNCTION public.rpc_get_disponibilidade(
    p_barbearia_id uuid,
    p_data_inicio timestamptz,
    p_data_fim timestamptz
) RETURNS TABLE (
    barbeiro_id uuid,
    data_hora_inicio timestamptz,
    data_hora_fim timestamptz,
    status text
) LANGUAGE plpgsql SECURITY DEFINER 
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN QUERY
    SELECT a.barbeiro_id, a.data_hora_inicio, a.data_hora_fim, a.status
    FROM public.agendamentos a
    WHERE a.barbearia_id = p_barbearia_id
      AND a.status IN ('pendente', 'confirmado')
      AND (a.data_hora_inicio, a.data_hora_fim) OVERLAPS (p_data_inicio, p_data_fim);
END;
$$;

-- 3. RPC: UPSERT DE CLIENTE (Hardened & Restricted)
-- Restrição: Anon pode criar ou atualizar APENAS se o cliente já pertencer àquela barbearia.
-- Impedimos alteração de e-mail e limitamos o que pode ser atualizado.
CREATE OR REPLACE FUNCTION public.rpc_upsert_cliente(
    p_barbearia_id uuid,
    p_nome text,
    p_email text,
    p_telefone text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER 
SET search_path = public, pg_temp
AS $$
DECLARE
    v_cliente_id uuid;
    v_clean_email text := LOWER(TRIM(p_email));
BEGIN
    -- Validação básica de formato de e-mail
    IF v_clean_email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
        RAISE EXCEPTION 'Formato de e-mail inválido.';
    END IF;

    -- Busca por email na mesma barbearia
    SELECT id INTO v_cliente_id
    FROM public.clientes
    WHERE barbearia_id = p_barbearia_id
      AND LOWER(email) = v_clean_email
    LIMIT 1;

    IF v_cliente_id IS NOT NULL THEN
        -- Atualização restrita: apenas nome e telefone
        UPDATE public.clientes
        SET nome = TRIM(p_nome),
            telefone = TRIM(p_telefone)
        WHERE id = v_cliente_id;
    ELSE
        -- Criação de novo cliente
        INSERT INTO public.clientes (barbearia_id, nome, email, telefone)
        VALUES (p_barbearia_id, TRIM(p_nome), v_clean_email, TRIM(p_telefone))
        RETURNING id INTO v_cliente_id;
    END IF;

    RETURN v_cliente_id;
END;
$$;

-- 4. RPC: CONFIRMAÇÃO MULTI-SERVIÇO (Advisory Locks para Race Conditions)
CREATE OR REPLACE FUNCTION public.rpc_confirmar_agendamento_multi(
    p_barbearia_id uuid,
    p_cliente_id uuid,
    p_barbeiro_id uuid, -- Pode ser NULL
    p_servicos jsonb,
    p_data_inicio timestamptz,
    p_observacoes text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER 
SET search_path = public, pg_temp
AS $$
DECLARE
    v_servico record;
    v_atual_inicio timestamptz := p_data_inicio;
    v_atual_fim timestamptz;
    v_conflito_count integer;
    v_agendamento_ids uuid[] := '{}';
    v_duracao_total integer := 0;
    v_final_barbeiro_id uuid := p_barbeiro_id;
    v_cand_barbeiro_id uuid;
    v_lock_key bigint;
BEGIN
    -- 1. Calcular período total do bloco
    FOR v_servico IN SELECT * FROM jsonb_to_recordset(p_servicos) AS x(id uuid, duracao int, valor decimal)
    LOOP
        v_duracao_total := v_duracao_total + v_servico.duracao;
    END LOOP;
    v_atual_fim := p_data_inicio + (v_duracao_total || ' minutes')::interval;

    -- 2. ADVISORY LOCK (Previne Race Condition)
    -- Criamos uma chave baseada na barbearia e na data/hora
    -- hashtext nos ajuda a converter strings em bigints para o lock.
    -- Bloqueamos o recurso "agendamento_barbearia" para evitar que 
    -- duas pessoas tentem pegar slots na MESMA barbearia no MESMO minuto.
    v_lock_key := hashtext('booking_' || p_barbearia_id::text || '_' || (p_data_inicio AT TIME ZONE 'UTC')::date::text);
    PERFORM pg_advisory_xact_lock(v_lock_key);

    -- 3. Atribuição automática ou Validação de Conflito
    IF v_final_barbeiro_id IS NULL THEN
        -- Busca barbeiro disponível respeitando bloqueios
        FOR v_cand_barbeiro_id IN 
            SELECT id FROM public.barbeiros 
            WHERE barbearia_id = p_barbearia_id AND ativo = true
        LOOP
            -- Check agendamentos
            SELECT COUNT(*) INTO v_conflito_count FROM public.agendamentos
            WHERE barbearia_id = p_barbearia_id AND barbeiro_id = v_cand_barbeiro_id
              AND status IN ('pendente', 'confirmado')
              AND (data_hora_inicio, data_hora_fim) OVERLAPS (p_data_inicio, v_atual_fim);
            
            IF v_conflito_count = 0 THEN
                -- Check bloqueios
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
            RETURN jsonb_build_object('success', false, 'message', 'Desculpe, não há mais profissionais disponíveis para este horário.');
        END IF;
    ELSE
        -- Validação para barbeiro específico
        SELECT COUNT(*) INTO v_conflito_count FROM public.agendamentos
        WHERE barbearia_id = p_barbearia_id AND barbeiro_id = v_final_barbeiro_id
          AND status IN ('pendente', 'confirmado')
          AND (data_hora_inicio, data_hora_fim) OVERLAPS (p_data_inicio, v_atual_fim);

        IF v_conflito_count > 0 THEN
            RETURN jsonb_build_object('success', false, 'message', 'O profissional escolhido acaba de ser ocupado. Escolha outro horário.');
        END IF;
    END IF;

    -- 4. Inserção Atômica
    FOR v_servico IN SELECT * FROM jsonb_to_recordset(p_servicos) AS x(id uuid, duracao int, valor decimal)
    LOOP
        v_atual_fim := v_atual_inicio + (v_servico.duracao || ' minutes')::interval;
        
        INSERT INTO public.agendamentos (
            barbearia_id, cliente_id, barbeiro_id, servico_id,
            data_hora_inicio, data_hora_fim, valor_estimado, status, observacoes
        ) VALUES (
            p_barbearia_id, p_cliente_id, v_final_barbeiro_id, v_servico.id,
            v_atual_inicio, v_atual_fim, v_servico.valor, 'confirmado', TRIM(p_observacoes)
        ) RETURNING id INTO v_cand_barbeiro_id;

        v_agendamento_ids := v_agendamento_ids || (v_cand_barbeiro_id::text::uuid);
        v_atual_inicio := v_atual_fim;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'ids', v_agendamento_ids);
END;
$$;
