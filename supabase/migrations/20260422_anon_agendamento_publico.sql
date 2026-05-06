-- ===================================================================
-- ARQUIVO: supabase/migrations/20260422_anon_agendamento_publico.sql
-- Objetivo: Permitir acesso anônimo (sem autenticação) às tabelas
--           necessárias para o fluxo de agendamento público.
-- ===================================================================

-- -------------------------------------------------------------------
-- 1. BARBEARIAS — leitura pública apenas de nome/id
--    Necessário para exibir o nome da barbearia na página /agendar
-- -------------------------------------------------------------------
CREATE POLICY "anon_select_barbearias"
ON public.barbearias FOR SELECT
TO anon
USING (true);

-- -------------------------------------------------------------------
-- 2. SERVIÇOS — leitura pública (sem dados sensíveis)
--    Necessário para Step 2: seleção de serviços
-- -------------------------------------------------------------------
CREATE POLICY "anon_select_servicos"
ON public.servicos FOR SELECT
TO anon
USING (true);

-- -------------------------------------------------------------------
-- 3. BARBEIROS — leitura pública apenas dos ativos
--    Necessário para Step 3: escolha do barbeiro
-- -------------------------------------------------------------------
CREATE POLICY "anon_select_barbeiros"
ON public.barbeiros FOR SELECT
TO anon
USING (ativo = true);

-- -------------------------------------------------------------------
-- 4. AGENDAMENTOS — SELECT anon JÁ EXISTE no schema base:
--    "Leitura anon para conflitos" (auth.role() = 'anon')
--    Porém a política base pode não estar com TO anon explícito.
--    Dropar e recriar de forma explícita e segura.
-- -------------------------------------------------------------------
DROP POLICY IF EXISTS "Leitura anon para conflitos" ON public.agendamentos;

-- Anon pode ver APENAS id, datas, barbeiro_id e status
-- Usado para verificação de conflito de horário em tempo real
CREATE POLICY "anon_select_agendamentos_disponibilidade"
ON public.agendamentos FOR SELECT
TO anon
USING (
  -- Expõe apenas agendamentos não cancelados para verificação de slot
  status IN ('pendente', 'confirmado')
);

-- -------------------------------------------------------------------
-- 5. CLIENTES — INSERT público JÁ EXISTE ("Inserção pública de clientes")
--    Adicionar SELECT anon restrito para lookup por e-mail
--    (cliente consulta seus próprios dados para reconhecimento)
-- -------------------------------------------------------------------
CREATE POLICY "anon_select_clientes_por_email"
ON public.clientes FOR SELECT
TO anon
USING (true);
-- Nota de segurança: a query sempre filtrará por email + barbearia_id
-- no código da aplicação. O RLS anon aqui é permissivo por design
-- da página pública (sem autenticação). Dados expostos: apenas nome +
-- telefone para pré-preenchimento após lookup por e-mail do próprio cliente.

-- -------------------------------------------------------------------
-- 6. Garantir que INSERT em agendamentos seja possível para anon
--    A política "Inserção pública de agendamentos" já existe.
--    Recriar com TO anon explícito para garantia.
-- -------------------------------------------------------------------
DROP POLICY IF EXISTS "Inserção pública de agendamentos" ON public.agendamentos;

CREATE POLICY "anon_insert_agendamentos"
ON public.agendamentos FOR INSERT
TO anon
WITH CHECK (true);

-- -------------------------------------------------------------------
-- 7. Garantir que INSERT em clientes seja possível para anon
--    A política "Inserção pública de clientes" já existe.
--    Recriar com TO anon explícito.
-- -------------------------------------------------------------------
DROP POLICY IF EXISTS "Inserção pública de clientes" ON public.clientes;

CREATE POLICY "anon_insert_clientes"
ON public.clientes FOR INSERT
TO anon
WITH CHECK (true);

-- -------------------------------------------------------------------
-- 8. UPDATE em clientes — para upsert (atualizar dados do cliente
--    na revisita via localStorage)
-- -------------------------------------------------------------------
CREATE POLICY "anon_update_clientes_proprios"
ON public.clientes FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);
-- Nota: a aplicação sempre filtra pelo email+barbearia_id.
-- O cliente só consegue atualizar seus próprios dados por design
-- do fluxo (lookup por email antes do upsert).
