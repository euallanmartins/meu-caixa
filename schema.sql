-- Habilitar extensões necessárias
create extension if not exists "uuid-ossp";

-- 1. Tabela de Barbearias (Tenant)
create table public.barbearias (
    id uuid primary key default uuid_generate_v4(),
    nome text not null,
    proprietario_id uuid references auth.users(id) not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Perfis de Usuários
create table public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    barbearia_id uuid references public.barbearias(id),
    full_name text,
    avatar_url text,
    role text default 'free',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Barbeiros (Equipe)
create table public.barbeiros (
    id uuid primary key default uuid_generate_v4(),
    barbearia_id uuid references public.barbearias(id) not null,
    nome text not null,
    comissao decimal(5,2) default 50, -- Por padrão 50%
    comissao_tipo text check (comissao_tipo in ('percentual', 'fixo')) default 'percentual',
    ativo boolean default true,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Serviços
create table public.servicos (
    id uuid primary key default uuid_generate_v4(),
    barbearia_id uuid references public.barbearias(id) not null,
    nome text not null,
    valor decimal(10,2) not null,
    duracao_minutos integer default 30,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Transações (Vendas)
create table public.transacoes (
    id uuid primary key default uuid_generate_v4(),
    barbearia_id uuid references public.barbearias(id) not null,
    cliente_nome text,
    barbeiro_id uuid references public.barbeiros(id) not null,
    servico_id uuid references public.servicos(id) not null,
    valor_total decimal(10,2) not null,
    data timestamp with time zone default timezone('utc'::text, now()) not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. Detalhes de Pagamento (Até 3 formas por transação)
create table public.transacao_pagamentos (
    id uuid primary key default uuid_generate_v4(),
    transacao_id uuid references public.transacoes(id) on delete cascade not null,
    metodo text check (metodo in ('dinheiro', 'cartao', 'pix')) not null,
    valor decimal(10,2) not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 7. Despesas (Saídas do Caixa Físico)
create table public.despesas (
    id uuid primary key default uuid_generate_v4(),
    barbearia_id uuid references public.barbearias(id) not null,
    descricao text not null,
    valor decimal(10,2) not null,
    data timestamp with time zone default timezone('utc'::text, now()) not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 8. Produtos
create table public.produtos (
    id uuid primary key default uuid_generate_v4(),
    barbearia_id uuid references public.barbearias(id) not null,
    nome text not null,
    valor_venda decimal(10,2) not null,
    comissao_valor decimal(10,2) default 0,
    comissao_tipo text check (comissao_tipo in ('percentual', 'fixo')) default 'fixo',
    estoque integer default 0,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 9. Vendas de Produtos
create table public.venda_produtos (
    id uuid primary key default uuid_generate_v4(),
    barbearia_id uuid references public.barbearias(id) not null,
    transacao_id uuid references public.transacoes(id) on delete cascade,
    produto_id uuid references public.produtos(id) not null,
    barbeiro_id uuid references public.barbeiros(id) not null,
    quantidade integer not null default 1,
    valor_unitario decimal(10,2) not null,
    valor_total decimal(10,2) not null,
    comissao_total decimal(10,2) not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 10. Caixinhas (Gorjetas)
create table public.caixinhas (
    id uuid primary key default uuid_generate_v4(),
    barbearia_id uuid references public.barbearias(id) not null,
    barbeiro_id uuid references public.barbeiros(id) not null,
    valor decimal(10,2) not null,
    metodo text check (metodo in ('dinheiro', 'cartao', 'pix')) not null,
    data timestamp with time zone default timezone('utc'::text, now()) not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- CONFIGURAR RLS (Row Level Security)

-- Habilitar RLS em todas as tabelas
alter table public.barbearias enable row level security;
alter table public.profiles enable row level security;
alter table public.barbeiros enable row level security;
alter table public.servicos enable row level security;
alter table public.transacoes enable row level security;
alter table public.transacao_pagamentos enable row level security;
alter table public.despesas enable row level security;
alter table public.produtos enable row level security;
alter table public.venda_produtos enable row level security;
alter table public.caixinhas enable row level security;

-- Políticas de Segurança (Exemplo: Usuário só vê dados da sua barbearia)

-- Políticas de Segurança (Exemplo: Usuário só vê dados da sua barbearia)

-- Barbearias
create policy "Usuários podem ver sua própria barbearia"
on public.barbearias for select
using (auth.uid() = proprietario_id);

create policy "Usuários podem inserir sua própria barbearia"
on public.barbearias for insert
with check (true);

create policy "Usuários podem atualizar sua própria barbearia"
on public.barbearias for update
using (auth.uid() = proprietario_id);

-- Perfis
create policy "Usuários podem ver seu próprio perfil"
on public.profiles for select
using (auth.uid() = id);

create policy "Usuários podem inserir seu próprio perfil"
on public.profiles for insert
with check (auth.uid() = id);

create policy "Usuários podem atualizar seu próprio perfil"
on public.profiles for update
using (auth.uid() = id);

create policy "Acesso por barbearia_id"
on public.barbeiros for all
using (barbearia_id in (select barbearia_id from public.profiles where id = auth.uid()));

create policy "Acesso por barbearia_id"
on public.servicos for all
using (barbearia_id in (select barbearia_id from public.profiles where id = auth.uid()));

create policy "Acesso por barbearia_id"
on public.transacoes for all
using (barbearia_id in (select barbearia_id from public.profiles where id = auth.uid()));

create policy "Acesso por transação da barbearia"
on public.transacao_pagamentos for all
using (transacao_id in (select id from public.transacoes where barbearia_id in (select barbearia_id from public.profiles where id = auth.uid())));

create policy "Acesso por barbearia_id"
on public.despesas for all
using (barbearia_id in (select barbearia_id from public.profiles where id = auth.uid()));

create policy "Acesso por barbearia_id"
on public.produtos for all
using (barbearia_id in (select barbearia_id from public.profiles where id = auth.uid()));

create policy "Acesso por barbearia_id"
on public.venda_produtos for all
using (barbearia_id in (select barbearia_id from public.profiles where id = auth.uid()));

create policy "Acesso por barbearia_id"
on public.caixinhas for all
using (barbearia_id in (select barbearia_id from public.profiles where id = auth.uid()));

-- 11. Clientes (Cadastro para Agendamento)
create table public.clientes (
    id uuid primary key default uuid_generate_v4(),
    barbearia_id uuid references public.barbearias(id) not null,
    nome text not null,
    email text not null,
    telefone text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.clientes enable row level security;

create policy "Inserção pública de clientes"
on public.clientes for insert
with check (true);

create policy "Leitura por dono da barbearia"
on public.clientes for select
using (barbearia_id in (select barbearia_id from public.profiles where id = auth.uid()));

-- 12. Agendamentos
create table public.agendamentos (
    id uuid primary key default uuid_generate_v4(),
    barbearia_id uuid references public.barbearias(id) not null,
    cliente_id uuid references public.clientes(id) not null,
    barbeiro_id uuid references public.barbeiros(id) not null,
    servico_id uuid references public.servicos(id) not null,
    data_hora_inicio timestamp with time zone not null,
    data_hora_fim timestamp with time zone not null,
    valor_estimado decimal(10,2),
    status text check (status in ('pendente', 'confirmado', 'atendido', 'cancelado')) default 'pendente',
    observacoes text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.agendamentos enable row level security;

create policy "Inserção pública de agendamentos"
on public.agendamentos for insert
with check (true);

create policy "Leitura por dono"
on public.agendamentos for select
using (barbearia_id in (select barbearia_id from public.profiles where id = auth.uid()));

create policy "Leitura anon para conflitos"
on public.agendamentos for select
using (auth.role() = 'anon');

create policy "Update por dono"
on public.agendamentos for update
using (barbearia_id in (select barbearia_id from public.profiles where id = auth.uid()));

create policy "Delete por dono"
on public.agendamentos for delete
using (barbearia_id in (select barbearia_id from public.profiles where id = auth.uid()));
