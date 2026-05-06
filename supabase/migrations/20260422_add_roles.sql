-- === ARQUIVO: supabase/migrations/20260422_add_roles.sql ===

-- 1. Adicionar role na tabela profiles (compatível com coluna 'role' já existente com valor 'free')
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'barbeiro', 'free'));

ALTER TABLE public.profiles
ALTER COLUMN role SET DEFAULT 'barbeiro';

-- 2. RLS: agendamentos — substituir políticas antigas
DROP POLICY IF EXISTS "Leitura por dono" ON public.agendamentos;
DROP POLICY IF EXISTS "Update por dono" ON public.agendamentos;
DROP POLICY IF EXISTS "Delete por dono" ON public.agendamentos;

CREATE POLICY "admin_agendamentos_all" ON public.agendamentos
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
      AND barbearia_id = agendamentos.barbearia_id
  )
);

CREATE POLICY "barbeiro_ver_agendamentos" ON public.agendamentos
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'barbeiro'
      AND barbearia_id = agendamentos.barbearia_id
  )
);

-- 3. RLS: clientes — substituir política antiga
DROP POLICY IF EXISTS "Leitura por dono da barbearia" ON public.clientes;

CREATE POLICY "membros_ver_clientes" ON public.clientes
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND barbearia_id = clientes.barbearia_id
      AND role IN ('admin', 'barbeiro')
  )
);

-- 4. RLS: tabelas financeiras — SOMENTE ADMIN
DROP POLICY IF EXISTS "Acesso por barbearia_id" ON public.transacoes;

CREATE POLICY "admin_only_transacoes" ON public.transacoes
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
      AND barbearia_id = transacoes.barbearia_id
  )
);

DROP POLICY IF EXISTS "Acesso por barbearia_id" ON public.despesas;

CREATE POLICY "admin_only_despesas" ON public.despesas
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
      AND barbearia_id = despesas.barbearia_id
  )
);

DROP POLICY IF EXISTS "Acesso por barbearia_id" ON public.caixinhas;

CREATE POLICY "admin_only_caixinhas" ON public.caixinhas
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
      AND barbearia_id = caixinhas.barbearia_id
  )
);
