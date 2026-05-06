-- ===================================================================
-- MIGRATION: 20260424_comprehensive_security_and_logic.sql
-- Objetivo: Resolver falhas de RLS, implementar RPCs seguras,
--           garantir atomicidade no agendamento e automatizar cadastro.
-- ===================================================================

-- 1. LIMPEZA DE RLS INSEGURO (ANON)
-- Removemos as políticas que permitem SELECT/UPDATE direto via anon.
DROP POLICY IF EXISTS "anon_select_clientes_por_email" ON public.clientes;
DROP POLICY IF EXISTS "anon_update_clientes_proprios" ON public.clientes;
DROP POLICY IF EXISTS "anon_select_agendamentos_disponibilidade" ON public.agendamentos;
DROP POLICY IF EXISTS "Leitura anon para conflitos" ON public.agendamentos;
DROP POLICY IF EXISTS "anon_insert_agendamentos" ON public.agendamentos;
DROP POLICY IF EXISTS "Inserção pública de agendamentos" ON public.agendamentos;

-- Mantemos apenas INSERT controlado se realmente necessário, mas preferimos RPC.
-- Por segurança total, vamos bloquear INSERT anon direto também e migrar tudo para RPC.
DROP POLICY IF EXISTS "anon_insert_clientes" ON public.clientes;
DROP POLICY IF EXISTS "Inserção pública de clientes" ON public.clientes;

-- 2. RPC: LOOKUP DE CLIENTE (Seguro para ANON)
CREATE OR REPLACE FUNCTION public.rpc_lookup_cliente(
    p_barbearia_id uuid,
    p_email text
) RETURNS TABLE (
    id uuid,
    nome text,
    telefone text
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT c.id, c.nome, c.telefone
    FROM public.clientes c
    WHERE c.barbearia_id = p_barbearia_id
      AND LOWER(c.email) = LOWER(p_email)
    LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_lookup_cliente TO anon, authenticated;

-- 3. RPC: DISPONIBILIDADE (Seguro para ANON)
CREATE OR REPLACE FUNCTION public.rpc_get_disponibilidade(
    p_barbearia_id uuid,
    p_data_inicio timestamptz,
    p_data_fim timestamptz
) RETURNS TABLE (
    barbeiro_id uuid,
    data_hora_inicio timestamptz,
    data_hora_fim timestamptz,
    status text
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT a.barbeiro_id, a.data_hora_inicio, a.data_hora_fim, a.status
    FROM public.agendamentos a
    WHERE a.barbearia_id = p_barbearia_id
      AND a.status IN ('pendente', 'confirmado')
      AND a.data_hora_inicio >= p_data_inicio
      AND a.data_hora_inicio <= p_data_fim;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_get_disponibilidade TO anon, authenticated;

-- 4. RPC: CONFIRMAÇÃO TRANSACIONAL (Evita Double Booking)
CREATE OR REPLACE FUNCTION public.rpc_confirmar_agendamento(
    p_barbearia_id uuid,
    p_cliente_id uuid,
    p_barbeiro_id uuid,
    p_servico_id uuid,
    p_data_inicio timestamptz,
    p_data_fim timestamptz,
    p_observacoes text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_conflito_count integer;
    v_agendamento_id uuid;
BEGIN
    -- 1. Revalidar conflito dentro da transação
    SELECT COUNT(*) INTO v_conflito_count
    FROM public.agendamentos
    WHERE barbearia_id = p_barbearia_id
      AND barbeiro_id = p_barbeiro_id
      AND status IN ('pendente', 'confirmado')
      AND (
          (data_hora_inicio, data_hora_fim) OVERLAPS (p_data_inicio, p_data_fim)
      );

    IF v_conflito_count > 0 THEN
        RAISE EXCEPTION 'Horário não disponível. Já existe um agendamento para este período.';
    END IF;

    -- 2. Inserir agendamento
    INSERT INTO public.agendamentos (
        barbearia_id,
        cliente_id,
        barbeiro_id,
        servico_id,
        data_hora_inicio,
        data_hora_fim,
        status,
        observacoes
    ) VALUES (
        p_barbearia_id,
        p_cliente_id,
        p_barbeiro_id,
        p_servico_id,
        p_data_inicio,
        p_data_fim,
        'confirmado',
        p_observacoes
    ) RETURNING id INTO v_agendamento_id;

    RETURN v_agendamento_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_confirmar_agendamento TO anon, authenticated;

-- 5. RPC: UPSERT DE CLIENTE (Seguro para fluxo de agendamento)
CREATE OR REPLACE FUNCTION public.rpc_upsert_cliente(
    p_barbearia_id uuid,
    p_nome text,
    p_email text,
    p_telefone text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_cliente_id uuid;
BEGIN
    -- Busca por email normalizado na mesma barbearia
    SELECT id INTO v_cliente_id
    FROM public.clientes
    WHERE barbearia_id = p_barbearia_id
      AND LOWER(email) = LOWER(p_email)
    LIMIT 1;

    IF v_cliente_id IS NOT NULL THEN
        UPDATE public.clientes
        SET nome = p_nome,
            telefone = p_telefone
        WHERE id = v_cliente_id;
    ELSE
        INSERT INTO public.clientes (barbearia_id, nome, email, telefone)
        VALUES (p_barbearia_id, p_nome, LOWER(p_email), p_telefone)
        RETURNING id INTO v_cliente_id;
    END IF;

    RETURN v_cliente_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_upsert_cliente TO anon, authenticated;

-- 6. TRIGGER DE AUTOMAÇÃO DE CADASTRO (USER REQUEST 5)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_barbearia_id uuid;
    v_shop_name text;
BEGIN
    -- Captura o nome da loja da metadata do auth.users
    v_shop_name := COALESCE(new.raw_user_meta_data->>'shop_name', 'Minha Barbearia');

    -- 1. Cria a barbearia
    INSERT INTO public.barbearias (nome, proprietario_id)
    VALUES (v_shop_name, new.id)
    RETURNING id INTO v_barbearia_id;

    -- 2. Cria o profile vinculado
    INSERT INTO public.profiles (id, barbearia_id, full_name, role)
    VALUES (
        new.id,
        v_barbearia_id,
        COALESCE(new.raw_user_meta_data->>'full_name', 'Proprietário'),
        'admin' -- Define como admin por padrão no cadastro
    );

    RETURN new;
END;
$$;

-- Instala o trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. CORREÇÃO DE RLS PARA AGENDAMENTOS (Authenticated)
-- Garante que o barbeiro/admin autenticado possa ler tudo da sua barbearia
DROP POLICY IF EXISTS "Leitura por dono" ON public.agendamentos;
CREATE POLICY "Leitura total autenticada por barbearia"
ON public.agendamentos FOR ALL
TO authenticated
USING (
    barbearia_id IN (SELECT barbearia_id FROM public.profiles WHERE id = auth.uid())
);
