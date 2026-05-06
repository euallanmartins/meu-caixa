-- ===================================================================
-- MIGRATION: 20260506_privacidade_cliente_agendamentos.sql
-- Objetivo:
--   - Cliente autenticado ve somente os proprios agendamentos.
--   - Profissional/dono ve e gerencia somente agendamentos do seu tenant.
--   - Anon nao le nem escreve diretamente em agendamentos; fluxo publico usa RPC.
-- ===================================================================

alter table public.agendamentos enable row level security;

drop policy if exists "anon_select_agendamentos_disponibilidade" on public.agendamentos;
drop policy if exists "anon_insert_agendamentos" on public.agendamentos;
drop policy if exists "Inserção pública de agendamentos" on public.agendamentos;
drop policy if exists "Leitura anon para conflitos" on public.agendamentos;
drop policy if exists "Leitura por dono" on public.agendamentos;
drop policy if exists "Update por dono" on public.agendamentos;
drop policy if exists "Delete por dono" on public.agendamentos;
drop policy if exists "Leitura total autenticada por barbearia" on public.agendamentos;
drop policy if exists "admin_agendamentos_all" on public.agendamentos;
drop policy if exists "barbeiro_ver_agendamentos" on public.agendamentos;
drop policy if exists "agendamentos_select_profissional_ou_cliente" on public.agendamentos;
drop policy if exists "agendamentos_insert_profissional" on public.agendamentos;
drop policy if exists "agendamentos_update_profissional" on public.agendamentos;
drop policy if exists "agendamentos_delete_profissional" on public.agendamentos;

create policy "agendamentos_select_profissional_ou_cliente"
on public.agendamentos
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.barbearia_id = agendamentos.barbearia_id
      and coalesce(p.role, '') in ('admin', 'barbeiro', 'funcionario', 'gerente')
  )
  or exists (
    select 1
    from public.cliente_accounts ca
    where ca.auth_user_id = auth.uid()
      and ca.barbearia_id = agendamentos.barbearia_id
      and ca.cliente_id = agendamentos.cliente_id
  )
);

create policy "agendamentos_insert_profissional"
on public.agendamentos
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.barbearia_id = agendamentos.barbearia_id
      and coalesce(p.role, '') in ('admin', 'barbeiro', 'funcionario', 'gerente')
  )
);

create policy "agendamentos_update_profissional"
on public.agendamentos
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.barbearia_id = agendamentos.barbearia_id
      and coalesce(p.role, '') in ('admin', 'barbeiro', 'funcionario', 'gerente')
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.barbearia_id = agendamentos.barbearia_id
      and coalesce(p.role, '') in ('admin', 'barbeiro', 'funcionario', 'gerente')
  )
);

create policy "agendamentos_delete_profissional"
on public.agendamentos
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.barbearia_id = agendamentos.barbearia_id
      and coalesce(p.role, '') in ('admin', 'barbeiro', 'funcionario', 'gerente')
  )
);

drop function if exists public.rpc_cliente_meus_agendamentos_auth(uuid);

create or replace function public.rpc_cliente_meus_agendamentos_auth(
  p_barbearia_id uuid default null
)
returns table (
  agendamento_id uuid,
  barbearia_id uuid,
  data_hora_inicio timestamptz,
  data_hora_fim timestamptz,
  status text,
  valor_estimado numeric,
  observacoes text,
  servico_nome text,
  barbeiro_nome text,
  barbearia_nome text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_auth_email text;
begin
  if auth.uid() is null then
    raise exception 'Login necessario.';
  end if;

  select lower(email)
  into v_auth_email
  from auth.users
  where id = auth.uid();

  if v_auth_email is not null then
    insert into public.cliente_accounts (auth_user_id, cliente_id, barbearia_id)
    select auth.uid(), matched_cliente.id, matched_cliente.barbearia_id
    from (
      select distinct on (c.barbearia_id) c.id, c.barbearia_id
      from public.clientes c
      where lower(c.email) = v_auth_email
        and (p_barbearia_id is null or c.barbearia_id = p_barbearia_id)
      order by c.barbearia_id, c.created_at desc nulls last, c.id
    ) matched_cliente
    on conflict (auth_user_id, barbearia_id) do update
    set cliente_id = excluded.cliente_id;
  end if;

  return query
  select
    a.id::uuid as agendamento_id,
    a.barbearia_id::uuid as barbearia_id,
    a.data_hora_inicio::timestamptz as data_hora_inicio,
    a.data_hora_fim::timestamptz as data_hora_fim,
    a.status::text as status,
    a.valor_estimado::numeric as valor_estimado,
    a.observacoes::text as observacoes,
    s.nome::text as servico_nome,
    b.nome::text as barbeiro_nome,
    ba.nome::text as barbearia_nome
  from public.cliente_accounts ca
  join public.agendamentos a
    on a.cliente_id = ca.cliente_id
   and a.barbearia_id = ca.barbearia_id
  left join public.servicos s
    on s.id = a.servico_id
   and s.barbearia_id = a.barbearia_id
  left join public.barbeiros b
    on b.id = a.barbeiro_id
   and b.barbearia_id = a.barbearia_id
  left join public.barbearias ba
    on ba.id = a.barbearia_id
  where ca.auth_user_id = auth.uid()
    and (p_barbearia_id is null or ca.barbearia_id = p_barbearia_id)
    and (p_barbearia_id is null or a.barbearia_id = p_barbearia_id)
    and a.cliente_id = ca.cliente_id
  order by a.data_hora_inicio desc
  limit 100;
end;
$$;

revoke all on function public.rpc_cliente_meus_agendamentos_auth(uuid) from public;
grant execute on function public.rpc_cliente_meus_agendamentos_auth(uuid) to authenticated;
