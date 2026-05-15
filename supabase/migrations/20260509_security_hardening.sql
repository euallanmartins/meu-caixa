-- Security hardening for public booking/reviews and tenant-safe media uploads.

alter table public.agendamentos
  add column if not exists idempotency_key uuid;

create index if not exists idx_agendamentos_idempotency_lookup
  on public.agendamentos (barbearia_id, idempotency_key)
  where idempotency_key is not null;

create unique index if not exists idx_agendamentos_idempotency_items
  on public.agendamentos (barbearia_id, idempotency_key, servico_id, data_hora_inicio)
  where idempotency_key is not null;

create or replace function public.trg_prevent_agendamento_overlap()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.status in ('aceito', 'confirmado', 'concluido', 'realizado', 'atendido')
     and new.barbearia_id is not null
     and new.barbeiro_id is not null then
    if exists (
      select 1
      from public.agendamentos a
      where a.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
        and a.barbearia_id = new.barbearia_id
        and a.barbeiro_id = new.barbeiro_id
        and a.status in ('aceito', 'confirmado', 'concluido', 'realizado', 'atendido')
        and (a.data_hora_inicio, a.data_hora_fim) overlaps (new.data_hora_inicio, new.data_hora_fim)
    ) then
      raise exception 'Horario ocupado para este profissional.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_agendamento_overlap on public.agendamentos;
create trigger prevent_agendamento_overlap
before insert or update of barbearia_id, barbeiro_id, data_hora_inicio, data_hora_fim, status
on public.agendamentos
for each row
execute function public.trg_prevent_agendamento_overlap();

drop function if exists public.rpc_confirmar_agendamento_multi(uuid, uuid, uuid, jsonb, timestamptz, text);

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
begin
  if p_idempotency_key is not null then
    select coalesce(array_agg(id order by data_hora_inicio), '{}'::uuid[])
      into v_agendamento_ids
    from public.agendamentos
    where barbearia_id = p_barbearia_id
      and idempotency_key = p_idempotency_key;

    if array_length(v_agendamento_ids, 1) is not null then
      return jsonb_build_object(
        'success', true,
        'ids', v_agendamento_ids,
        'status', 'pendente',
        'idempotent', true,
        'message', 'Agendamento ja processado.'
      );
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

  return jsonb_build_object(
    'success', true,
    'ids', v_agendamento_ids,
    'status', 'pendente',
    'message', 'Agendamento enviado e aguardando confirmacao da barbearia.'
  );
end;
$$;

revoke all on function public.rpc_confirmar_agendamento_multi(uuid, uuid, uuid, jsonb, timestamptz, text, uuid) from public;
grant execute on function public.rpc_confirmar_agendamento_multi(uuid, uuid, uuid, jsonb, timestamptz, text, uuid) to anon, authenticated;

create or replace function public.rpc_criar_avaliacao(
  p_avaliacao_id uuid,
  p_barbearia_id uuid,
  p_nome_cliente text,
  p_nota integer,
  p_depoimento text,
  p_fotos text[] default '{}'::text[]
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_nome text := nullif(trim(coalesce(p_nome_cliente, '')), '');
  v_depoimento text := nullif(trim(coalesce(p_depoimento, '')), '');
  v_fotos text[] := coalesce(p_fotos, '{}'::text[]);
  v_id uuid := coalesce(p_avaliacao_id, gen_random_uuid());
  v_foto text;
  v_expected_prefix text;
begin
  if not exists (select 1 from public.barbearias where id = p_barbearia_id and ativo = true) then
    raise exception 'Barbearia nao encontrada.';
  end if;

  if v_nome is null then
    raise exception 'Informe seu nome.';
  end if;

  if p_nota is null or p_nota < 1 or p_nota > 5 then
    raise exception 'Nota invalida.';
  end if;

  if v_depoimento is null then
    raise exception 'Depoimento obrigatorio.';
  end if;

  if array_length(v_fotos, 1) > 4 then
    raise exception 'Limite maximo de 4 fotos.';
  end if;

  v_expected_prefix := '/storage/v1/object/public/barber-photos/barbearias/' || p_barbearia_id::text || '/avaliacoes/' || v_id::text || '/';

  foreach v_foto in array v_fotos loop
    if v_foto !~* '^https://[^/]+\.supabase\.co/storage/v1/object/public/barber-photos/barbearias/' then
      raise exception 'URL de foto invalida.';
    end if;

    if position(v_expected_prefix in v_foto) = 0 then
      raise exception 'Foto fora do escopo desta avaliacao.';
    end if;

    if v_foto !~* '\.(jpg|jpeg|png|webp)(\?.*)?$' then
      raise exception 'Tipo de foto nao permitido.';
    end if;
  end loop;

  insert into public.avaliacoes (
    id,
    barbearia_id,
    nome_cliente,
    nota,
    depoimento,
    fotos,
    status
  )
  values (
    v_id,
    p_barbearia_id,
    v_nome,
    p_nota,
    v_depoimento,
    v_fotos,
    'pendente'
  );

  return v_id;
end;
$$;

revoke all on function public.rpc_criar_avaliacao(uuid, uuid, text, integer, text, text[]) from public;
grant execute on function public.rpc_criar_avaliacao(uuid, uuid, text, integer, text, text[]) to anon, authenticated;

drop policy if exists "barber_photos_anon_review_upload" on storage.objects;
create policy "barber_photos_anon_review_upload"
on storage.objects
for insert
to anon, authenticated
with check (
  bucket_id = 'barber-photos'
  and (storage.foldername(name))[1] = 'barbearias'
  and (storage.foldername(name))[3] = 'avaliacoes'
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
  and exists (
    select 1
    from public.barbearias b
    where b.id::text = (storage.foldername(name))[2]
      and b.ativo = true
  )
);
