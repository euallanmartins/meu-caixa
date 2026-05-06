-- ===================================================================
-- MIGRATION: 20260506_agendamento_aprovacao_profissional.sql
-- Objetivo:
--   - Agendamentos públicos entram como pendentes.
--   - Somente aceito/concluido bloqueiam disponibilidade.
--   - Profissional aceita/recusa via RPC transacional com checagem de tenant.
-- ===================================================================

alter table public.agendamentos
  add column if not exists motivo_recusa text,
  add column if not exists respondido_em timestamptz,
  add column if not exists respondido_por uuid;

do $$
declare
  r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    join pg_attribute a
      on a.attrelid = c.conrelid
     and a.attnum = any(c.conkey)
    where c.conrelid = 'public.agendamentos'::regclass
      and c.contype = 'c'
      and a.attname = 'status'
  loop
    execute format('alter table public.agendamentos drop constraint %I', r.conname);
  end loop;
end;
$$;

update public.agendamentos
set status = case
  when status = 'confirmado' then 'aceito'
  when status in ('atendido', 'realizado', 'concluído') then 'concluido'
  when status = 'cancelada' then 'cancelado'
  else status
end
where status in ('confirmado', 'atendido', 'realizado', 'concluído', 'cancelada');

alter table public.agendamentos
  alter column status set default 'pendente',
  add constraint agendamentos_status_check
    check (status in ('pendente', 'aceito', 'recusado', 'cancelado', 'concluido'));

create index if not exists idx_agendamentos_ocupados_barbeiro_periodo
  on public.agendamentos (barbearia_id, barbeiro_id, data_hora_inicio, data_hora_fim)
  where status in ('aceito', 'concluido');

create index if not exists idx_agendamentos_pendentes_barbeiro_periodo
  on public.agendamentos (barbearia_id, barbeiro_id, data_hora_inicio, data_hora_fim)
  where status = 'pendente';

drop function if exists public.rpc_get_disponibilidade(uuid, date);

create or replace function public.rpc_get_disponibilidade(
  p_barbearia_id uuid,
  p_data date
) returns table (
  ref_id uuid,
  tipo text,
  barbeiro_id uuid,
  inicio timestamptz,
  fim timestamptz,
  subtipo text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
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
    and a.status in ('aceito', 'concluido')
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
      when b.tipo = 'dia'
        then ((p_data::timestamp + time '00:00') at time zone 'America/Sao_Paulo')
      else ((p_data::timestamp + b.hora_inicio) at time zone 'America/Sao_Paulo')
    end,
    case
      when b.tipo = 'dia'
        then ((p_data::timestamp + time '23:59') at time zone 'America/Sao_Paulo')
      else ((p_data::timestamp + b.hora_fim) at time zone 'America/Sao_Paulo')
    end,
    b.tipo
  from public.bloqueios b
  where b.barbearia_id = p_barbearia_id
    and b.data = p_data;
end;
$$;

drop function if exists public.rpc_confirmar_agendamento_multi(uuid, uuid, uuid, jsonb, timestamptz, text);

create or replace function public.rpc_confirmar_agendamento_multi(
  p_barbearia_id uuid,
  p_cliente_id uuid,
  p_barbeiro_id uuid,
  p_servicos jsonb,
  p_data_inicio timestamptz,
  p_observacoes text default null
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
begin
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
        and status in ('aceito', 'concluido')
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
      and status in ('aceito', 'concluido')
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
      observacoes
    ) values (
      p_barbearia_id,
      p_cliente_id,
      v_final_barbeiro_id,
      v_servico_id,
      v_atual_inicio,
      v_atual_fim,
      v_serv_record.valor,
      'pendente',
      nullif(trim(coalesce(p_observacoes, '')), '')
    ) returning id into v_cand_barbeiro_id;

    v_agendamento_ids := v_agendamento_ids || v_cand_barbeiro_id;
    v_atual_inicio := v_atual_fim;
  end loop;

  return jsonb_build_object(
    'success', true,
    'ids', v_agendamento_ids,
    'status', 'pendente',
    'message', 'Agendamento enviado e aguardando confirmacao da barbearia.'
  );
end;
$$;

create or replace function public.rpc_profissional_responder_agendamento(
  p_agendamento_id uuid,
  p_novo_status text,
  p_motivo_recusa text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile record;
  v_agendamento record;
  v_conflito_id uuid;
  v_lock_key bigint;
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'message', 'Login profissional necessario.');
  end if;

  if p_novo_status not in ('aceito', 'recusado') then
    return jsonb_build_object('success', false, 'message', 'Resposta invalida para o agendamento.');
  end if;

  select id, barbearia_id
  into v_profile
  from public.profiles
  where id = auth.uid()
  limit 1;

  if v_profile.id is null or v_profile.barbearia_id is null then
    return jsonb_build_object('success', false, 'message', 'Perfil profissional invalido.');
  end if;

  select *
  into v_agendamento
  from public.agendamentos
  where id = p_agendamento_id
    and barbearia_id = v_profile.barbearia_id
  for update;

  if v_agendamento.id is null then
    return jsonb_build_object('success', false, 'message', 'Agendamento nao encontrado nesta barbearia.');
  end if;

  if v_agendamento.status not in ('pendente', 'aceito') then
    return jsonb_build_object('success', false, 'message', 'Este agendamento nao pode mais ser respondido.');
  end if;

  v_lock_key := hashtext('booking_' || v_agendamento.barbearia_id::text || '_' || (v_agendamento.data_hora_inicio at time zone 'America/Sao_Paulo')::date::text);
  perform pg_advisory_xact_lock(v_lock_key);

  if p_novo_status = 'recusado' then
    update public.agendamentos
    set status = 'recusado',
        motivo_recusa = nullif(trim(coalesce(p_motivo_recusa, '')), ''),
        respondido_em = now(),
        respondido_por = auth.uid()
    where id = v_agendamento.id;

    return jsonb_build_object('success', true, 'status', 'recusado');
  end if;

  select a.id
  into v_conflito_id
  from public.agendamentos a
  where a.barbearia_id = v_agendamento.barbearia_id
    and a.barbeiro_id = v_agendamento.barbeiro_id
    and a.id <> v_agendamento.id
    and a.status in ('aceito', 'concluido')
    and (a.data_hora_inicio, a.data_hora_fim) overlaps (v_agendamento.data_hora_inicio, v_agendamento.data_hora_fim)
  limit 1;

  if v_conflito_id is not null then
    return jsonb_build_object(
      'success', false,
      'message', 'Nao foi possivel aceitar: ja existe outro agendamento aceito neste horario.'
    );
  end if;

  update public.agendamentos
  set status = 'aceito',
      motivo_recusa = null,
      respondido_em = now(),
      respondido_por = auth.uid()
  where id = v_agendamento.id;

  update public.agendamentos a
  set status = 'recusado',
      motivo_recusa = 'Horario ocupado por outro agendamento aceito.',
      respondido_em = now(),
      respondido_por = auth.uid()
  where a.barbearia_id = v_agendamento.barbearia_id
    and a.barbeiro_id = v_agendamento.barbeiro_id
    and a.id <> v_agendamento.id
    and a.status = 'pendente'
    and (a.data_hora_inicio, a.data_hora_fim) overlaps (v_agendamento.data_hora_inicio, v_agendamento.data_hora_fim);

  return jsonb_build_object('success', true, 'status', 'aceito');
end;
$$;

revoke all on function public.rpc_get_disponibilidade(uuid, date) from public;
revoke all on function public.rpc_confirmar_agendamento_multi(uuid, uuid, uuid, jsonb, timestamptz, text) from public;
revoke all on function public.rpc_profissional_responder_agendamento(uuid, text, text) from public;

grant execute on function public.rpc_get_disponibilidade(uuid, date) to anon, authenticated;
grant execute on function public.rpc_confirmar_agendamento_multi(uuid, uuid, uuid, jsonb, timestamptz, text) to anon, authenticated;
grant execute on function public.rpc_profissional_responder_agendamento(uuid, text, text) to authenticated;
