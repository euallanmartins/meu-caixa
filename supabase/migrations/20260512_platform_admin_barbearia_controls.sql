alter table public.barbearias
  add column if not exists agendamentos_pausados boolean not null default false,
  add column if not exists agendamentos_pausados_em timestamptz,
  add column if not exists agendamentos_pausados_por uuid references auth.users(id),
  add column if not exists acesso_proprietario_bloqueado boolean not null default false,
  add column if not exists acesso_bloqueado_motivo text,
  add column if not exists acesso_bloqueado_em timestamptz,
  add column if not exists acesso_bloqueado_por uuid references auth.users(id);

create or replace function public.rpc_set_barbearia_agendamentos_pausados(
  p_barbearia_id uuid,
  p_pausado boolean
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile record;
begin
  if v_auth_user_id is null then
    raise exception 'Login necessario.';
  end if;

  select id, role into v_profile
  from public.profiles
  where id = v_auth_user_id;

  if v_profile.id is null or not public.is_platform_admin_role(v_profile.role) then
    raise exception 'Acesso restrito ao admin da plataforma.';
  end if;

  update public.barbearias
  set agendamentos_pausados = coalesce(p_pausado, false),
      agendamentos_pausados_em = case when coalesce(p_pausado, false) then now() else null end,
      agendamentos_pausados_por = case when coalesce(p_pausado, false) then v_auth_user_id else null end
  where id = p_barbearia_id;

  if not found then
    raise exception 'Barbearia invalida.';
  end if;

  return jsonb_build_object('success', true, 'agendamentos_pausados', coalesce(p_pausado, false));
end;
$$;

create or replace function public.rpc_set_barbearia_owner_access_blocked(
  p_barbearia_id uuid,
  p_bloqueado boolean,
  p_motivo text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile record;
begin
  if v_auth_user_id is null then
    raise exception 'Login necessario.';
  end if;

  select id, role into v_profile
  from public.profiles
  where id = v_auth_user_id;

  if v_profile.id is null or not public.is_platform_admin_role(v_profile.role) then
    raise exception 'Acesso restrito ao admin da plataforma.';
  end if;

  update public.barbearias
  set acesso_proprietario_bloqueado = coalesce(p_bloqueado, false),
      acesso_bloqueado_motivo = case when coalesce(p_bloqueado, false) then nullif(trim(coalesce(p_motivo, '')), '') else null end,
      acesso_bloqueado_em = case when coalesce(p_bloqueado, false) then now() else null end,
      acesso_bloqueado_por = case when coalesce(p_bloqueado, false) then v_auth_user_id else null end
  where id = p_barbearia_id;

  if not found then
    raise exception 'Barbearia invalida.';
  end if;

  return jsonb_build_object('success', true, 'acesso_proprietario_bloqueado', coalesce(p_bloqueado, false));
end;
$$;

create or replace function public.rpc_confirmar_agendamento_multi(
  p_barbearia_id uuid,
  p_cliente_id uuid,
  p_barbeiro_id uuid,
  p_servicos jsonb,
  p_data_inicio timestamptz,
  p_observacoes text default null,
  p_idempotency_key uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
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
  v_barbearia_aceita_agendamentos boolean;
begin
  select exists (
    select 1
    from public.barbearias b
    where b.id = p_barbearia_id
      and coalesce(b.ativo, true) = true
      and b.status = 'active'
      and coalesce(b.agendamentos_pausados, false) = false
  ) into v_barbearia_aceita_agendamentos;

  if not v_barbearia_aceita_agendamentos then
    return jsonb_build_object('success', false, 'message', 'Os agendamentos desta barbearia estao temporariamente pausados.');
  end if;

  if p_idempotency_key is not null then
    select coalesce(array_agg(id order by data_hora_inicio), '{}'::uuid[])
      into v_agendamento_ids
    from public.agendamentos
    where barbearia_id = p_barbearia_id
      and idempotency_key = p_idempotency_key;

    if array_length(v_agendamento_ids, 1) is not null then
      return jsonb_build_object('success', true, 'ids', v_agendamento_ids, 'status', 'pendente', 'idempotent', true, 'message', 'Agendamento ja processado.');
    end if;
  end if;

  if p_servicos is null or jsonb_typeof(p_servicos) <> 'array' or jsonb_array_length(p_servicos) = 0 then
    return jsonb_build_object('success', false, 'message', 'Selecione ao menos um servico.');
  end if;

  select exists (
    select 1
    from public.clientes
    where id = p_cliente_id
      and barbearia_id = p_barbearia_id
  ) into v_cliente_valido;

  if not v_cliente_valido then
    return jsonb_build_object('success', false, 'message', 'Dados do cliente invalidos ou inconsistentes.');
  end if;

  if p_barbeiro_id is not null then
    select exists (
      select 1
      from public.barbeiros
      where id = p_barbeiro_id
        and barbearia_id = p_barbearia_id
        and ativo = true
    ) into v_barbeiro_valido;

    if not v_barbeiro_valido then
      return jsonb_build_object('success', false, 'message', 'O profissional escolhido nao esta disponivel.');
    end if;
  end if;

  for v_servico_id in
    select (value->>'id')::uuid
    from jsonb_array_elements(p_servicos)
  loop
    select id, duracao_minutos, valor, barbearia_id
    into v_serv_record
    from public.servicos
    where id = v_servico_id;

    if v_serv_record.id is null or v_serv_record.barbearia_id <> p_barbearia_id then
      return jsonb_build_object('success', false, 'message', 'Um ou mais servicos sao invalidos para esta barbearia.');
    end if;

    v_duracao_total := v_duracao_total + coalesce(v_serv_record.duracao_minutos, 30);
  end loop;

  v_atual_fim := p_data_inicio + (v_duracao_total || ' minutes')::interval;
  v_lock_key := hashtext('booking_' || p_barbearia_id::text || '_' || (p_data_inicio at time zone 'America/Sao_Paulo')::date::text);
  perform pg_advisory_xact_lock(v_lock_key);

  if p_idempotency_key is not null then
    select coalesce(array_agg(id order by data_hora_inicio), '{}'::uuid[])
      into v_agendamento_ids
    from public.agendamentos
    where barbearia_id = p_barbearia_id
      and idempotency_key = p_idempotency_key;

    if array_length(v_agendamento_ids, 1) is not null then
      return jsonb_build_object('success', true, 'ids', v_agendamento_ids, 'status', 'pendente', 'idempotent', true);
    end if;
  end if;

  if v_final_barbeiro_id is null then
    for v_cand_barbeiro_id in
      select id
      from public.barbeiros
      where barbearia_id = p_barbearia_id
        and ativo = true
      order by nome, id
    loop
      select count(*) into v_conflito_count
      from public.agendamentos
      where barbearia_id = p_barbearia_id
        and barbeiro_id = v_cand_barbeiro_id
        and status in ('aceito', 'confirmado', 'concluido', 'realizado', 'atendido')
        and (data_hora_inicio, data_hora_fim) overlaps (p_data_inicio, v_atual_fim);

      if v_conflito_count = 0 then
        select count(*) into v_conflito_count
        from public.bloqueios
        where barbearia_id = p_barbearia_id
          and (barbeiro_id = v_cand_barbeiro_id or barbeiro_id is null)
          and data = (p_data_inicio at time zone 'America/Sao_Paulo')::date
          and (
            tipo = 'dia'
            or (
              tipo = 'horario'
              and ((p_data_inicio at time zone 'America/Sao_Paulo')::time, (v_atual_fim at time zone 'America/Sao_Paulo')::time)
                overlaps (hora_inicio, hora_fim)
            )
          );

        if v_conflito_count = 0 then
          v_final_barbeiro_id := v_cand_barbeiro_id;
          exit;
        end if;
      end if;
    end loop;

    if v_final_barbeiro_id is null then
      return jsonb_build_object('success', false, 'message', 'Nao ha profissionais disponiveis para este intervalo.');
    end if;
  else
    select count(*) into v_conflito_count
    from public.agendamentos
    where barbearia_id = p_barbearia_id
      and barbeiro_id = v_final_barbeiro_id
      and status in ('aceito', 'confirmado', 'concluido', 'realizado', 'atendido')
      and (data_hora_inicio, data_hora_fim) overlaps (p_data_inicio, v_atual_fim);

    if v_conflito_count > 0 then
      return jsonb_build_object('success', false, 'message', 'Horario ocupado ou indisponivel.');
    end if;

    select count(*) into v_conflito_count
    from public.bloqueios
    where barbearia_id = p_barbearia_id
      and (barbeiro_id = v_final_barbeiro_id or barbeiro_id is null)
      and data = (p_data_inicio at time zone 'America/Sao_Paulo')::date
      and (
        tipo = 'dia'
        or (
          tipo = 'horario'
          and ((p_data_inicio at time zone 'America/Sao_Paulo')::time, (v_atual_fim at time zone 'America/Sao_Paulo')::time)
            overlaps (hora_inicio, hora_fim)
        )
      );

    if v_conflito_count > 0 then
      return jsonb_build_object('success', false, 'message', 'Este profissional possui um bloqueio no horario selecionado.');
    end if;
  end if;

  v_agendamento_ids := '{}';
  v_atual_inicio := p_data_inicio;

  for v_servico_id in
    select (value->>'id')::uuid
    from jsonb_array_elements(p_servicos)
  loop
    select id, duracao_minutos, valor, barbearia_id
    into v_serv_record
    from public.servicos
    where id = v_servico_id
      and barbearia_id = p_barbearia_id;

    if v_serv_record.id is null then
      return jsonb_build_object('success', false, 'message', 'Servico invalido durante a confirmacao.');
    end if;

    v_atual_fim := v_atual_inicio + (coalesce(v_serv_record.duracao_minutos, 30) || ' minutes')::interval;

    insert into public.agendamentos (
      barbearia_id,
      cliente_id,
      barbeiro_id,
      servico_id,
      data_hora_inicio,
      data_hora_fim,
      valor_estimado,
      status,
      observacoes,
      idempotency_key
    ) values (
      p_barbearia_id,
      p_cliente_id,
      v_final_barbeiro_id,
      v_servico_id,
      v_atual_inicio,
      v_atual_fim,
      v_serv_record.valor,
      'pendente',
      nullif(trim(coalesce(p_observacoes, '')), ''),
      p_idempotency_key
    ) returning id into v_cand_barbeiro_id;

    v_agendamento_ids := v_agendamento_ids || v_cand_barbeiro_id;
    v_atual_inicio := v_atual_fim;
  end loop;

  return jsonb_build_object('success', true, 'ids', v_agendamento_ids, 'status', 'pendente', 'message', 'Agendamento enviado e aguardando confirmacao da barbearia.');
end;
$$;

create or replace function public.rpc_get_disponibilidade(p_barbearia_id uuid, p_data date)
returns table(ref_id uuid, tipo text, barbeiro_id uuid, inicio timestamp with time zone, fim timestamp with time zone, subtipo text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (
    select 1
    from public.barbearias b
    where b.id = p_barbearia_id
      and (b.status <> 'active' or coalesce(b.ativo, true) = false or coalesce(b.agendamentos_pausados, false) = true)
  ) then
    return;
  end if;

  return query
  select
    a.id,
    'agendamento'::text,
    a.barbeiro_id,
    a.data_hora_inicio,
    a.data_hora_fim,
    a.status
  from public.agendamentos a
  where a.barbearia_id = p_barbearia_id
    and a.status in ('aceito', 'confirmado', 'concluido', 'realizado', 'atendido')
    and (
      (a.data_hora_inicio at time zone 'America/Sao_Paulo')::date = p_data
      or (a.data_hora_fim at time zone 'America/Sao_Paulo')::date = p_data
    );

  return query
  select
    b.id,
    'bloqueio'::text,
    b.barbeiro_id,
    case
      when b.tipo = 'dia' then ((p_data::timestamp + time '00:00') at time zone 'America/Sao_Paulo')
      else ((p_data::timestamp + b.hora_inicio) at time zone 'America/Sao_Paulo')
    end,
    case
      when b.tipo = 'dia' then ((p_data::timestamp + time '23:59') at time zone 'America/Sao_Paulo')
      else ((p_data::timestamp + b.hora_fim) at time zone 'America/Sao_Paulo')
    end,
    b.tipo
  from public.bloqueios b
  where b.barbearia_id = p_barbearia_id
    and b.data = p_data;
end;
$$;

revoke all on function public.rpc_set_barbearia_agendamentos_pausados(uuid, boolean) from public;
revoke all on function public.rpc_set_barbearia_owner_access_blocked(uuid, boolean, text) from public;
grant execute on function public.rpc_set_barbearia_agendamentos_pausados(uuid, boolean) to authenticated;
grant execute on function public.rpc_set_barbearia_owner_access_blocked(uuid, boolean, text) to authenticated;
