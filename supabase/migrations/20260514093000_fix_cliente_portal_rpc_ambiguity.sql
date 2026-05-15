-- Fix ambiguous OUT parameter names inside rpc_cliente_meus_agendamentos_auth.
-- The RETURNS TABLE column "barbearia_id" is a PL/pgSQL variable, so conflict
-- targets must use the constraint name instead of the raw column list.

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
  barbearia_nome text,
  idempotency_key uuid,
  servico_id uuid,
  barbeiro_id uuid,
  cliente_confirmou boolean,
  pode_cancelar boolean,
  pode_reagendar boolean,
  avaliacao_id uuid,
  avaliado boolean
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
    on conflict on constraint cliente_accounts_auth_user_id_barbearia_id_key do update
    set cliente_id = excluded.cliente_id;
  end if;

  return query
  select
    a.id::uuid,
    a.barbearia_id::uuid,
    a.data_hora_inicio::timestamptz,
    a.data_hora_fim::timestamptz,
    a.status::text,
    a.valor_estimado::numeric,
    a.observacoes::text,
    s.nome::text,
    bb.nome::text,
    ba.nome::text,
    a.idempotency_key::uuid,
    a.servico_id::uuid,
    a.barbeiro_id::uuid,
    coalesce(a.cliente_confirmou, false)::boolean,
    (
      a.status not in ('concluido', 'realizado', 'atendido', 'recusado', 'cancelado')
      and a.data_hora_inicio > now() + interval '2 hours'
    )::boolean,
    (
      a.status not in ('concluido', 'realizado', 'atendido', 'recusado', 'cancelado')
      and a.data_hora_inicio > now() + interval '2 hours'
    )::boolean,
    av.id::uuid,
    (av.id is not null)::boolean
  from public.cliente_accounts ca
  join public.agendamentos a
    on a.cliente_id = ca.cliente_id
   and a.barbearia_id = ca.barbearia_id
  left join public.servicos s
    on s.id = a.servico_id
   and s.barbearia_id = a.barbearia_id
  left join public.barbeiros bb
    on bb.id = a.barbeiro_id
   and bb.barbearia_id = a.barbearia_id
  left join public.barbearias ba
    on ba.id = a.barbearia_id
  left join public.avaliacoes av
    on av.agendamento_id = a.id
   and av.barbearia_id = a.barbearia_id
  where ca.auth_user_id = auth.uid()
    and (p_barbearia_id is null or ca.barbearia_id = p_barbearia_id)
    and (p_barbearia_id is null or a.barbearia_id = p_barbearia_id)
    and a.cliente_id = ca.cliente_id
  order by a.data_hora_inicio desc
  limit 200;
end;
$$;

revoke all on function public.rpc_cliente_meus_agendamentos_auth(uuid) from public;
grant execute on function public.rpc_cliente_meus_agendamentos_auth(uuid) to authenticated;
