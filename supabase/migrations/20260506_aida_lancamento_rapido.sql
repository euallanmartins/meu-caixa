-- ===================================================================
-- MIGRATION: 20260506_aida_lancamento_rapido.sql
-- Objetivo:
--   - Criar a RPC transacional da AIDA para lancamento rapido.
--   - Validar tenant no banco via auth.uid() + profiles.barbearia_id.
--   - Registrar atendimento ja realizado como agendamento concluido + caixa.
-- ===================================================================

alter table public.transacao_pagamentos
  drop constraint if exists transacao_pagamentos_metodo_check;

alter table public.transacao_pagamentos
  add constraint transacao_pagamentos_metodo_check
    check (metodo in ('dinheiro', 'cartao', 'pix', 'nao_informado'));

create extension if not exists unaccent with schema extensions;

create or replace function public.aida_normalize(p_value text)
returns text
language sql
immutable
as $$
  select trim(regexp_replace(
    extensions.unaccent(lower(coalesce(p_value, ''))),
    '\s+',
    ' ',
    'g'
  ));
$$;

drop function if exists public.rpc_aida_lancamento_rapido(uuid, text);

create or replace function public.rpc_aida_lancamento_rapido(
  p_barbearia_id uuid,
  p_texto text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile record;
  v_text text := trim(coalesce(p_texto, ''));
  v_norm text;
  v_clean text;
  v_value_match text[];
  v_time_match text[];
  v_valor numeric;
  v_metodo text := 'nao_informado';
  v_inicio timestamptz;
  v_fim timestamptz;
  v_local_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_hour integer;
  v_minute integer;
  v_barbeiro record;
  v_barbeiro_count integer := 0;
  v_servico record;
  v_servico_count integer := 0;
  v_cliente_id uuid;
  v_agendamento_id uuid;
  v_transacao_id uuid;
  v_conflitos integer := 0;
  v_cliente_nome text := 'Cliente avulso';
  v_observacao text;
  v_service_query text;
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'message', 'Login profissional necessario.');
  end if;

  if p_barbearia_id is null then
    return jsonb_build_object('success', false, 'message', 'Barbearia obrigatoria.');
  end if;

  select id, barbearia_id, role
  into v_profile
  from public.profiles
  where id = auth.uid();

  if v_profile.id is null
    or v_profile.barbearia_id <> p_barbearia_id
    or coalesce(v_profile.role, '') not in ('admin', 'barbeiro', 'funcionario', 'gerente')
  then
    return jsonb_build_object('success', false, 'message', 'AIDA disponivel apenas para profissionais desta barbearia.');
  end if;

  if length(v_text) < 4 then
    return jsonb_build_object('success', false, 'message', 'Eu so faco lancamentos rapidos. Exemplo: ''Diego fez corte agora 30 reais''.');
  end if;

  v_norm := public.aida_normalize(v_text);

  if v_norm ~ '(^| )(como|quanto|qual|quais|relatorio|configuracao|configurar|criar profissional|criar servico|editar|apagar|excluir)( |$)'
    or position('?' in v_text) > 0
  then
    return jsonb_build_object('success', false, 'message', 'Eu so faco lancamentos rapidos. Exemplo: ''Diego fez corte agora 30 reais''.');
  end if;

  if v_norm ~ '(^| )(pix)( |$)' then
    v_metodo := 'pix';
  elsif v_norm ~ '(^| )(cartao|cartao de credito|credito|debito)( |$)' then
    v_metodo := 'cartao';
  elsif v_norm ~ '(^| )(dinheiro|cash)( |$)' then
    v_metodo := 'dinheiro';
  end if;

  v_time_match := regexp_match(v_norm, '(?:as|às|a)?\s*([0-2]?[0-9])\s*(?:h|:)\s*([0-5][0-9])?');
  if v_time_match is not null then
    v_hour := least(greatest(v_time_match[1]::integer, 0), 23);
    v_minute := coalesce(nullif(v_time_match[2], '')::integer, 0);
    v_inicio := (v_local_today + make_time(v_hour, v_minute, 0)) at time zone 'America/Sao_Paulo';
    v_norm := regexp_replace(v_norm, '(?:as|às|a)?\s*[0-2]?[0-9]\s*(?:h|:)\s*[0-5]?[0-9]?', ' ', 'g');
  else
    v_inicio := now();
  end if;

  v_value_match := regexp_match(v_norm, '([0-9]+(?:[,.][0-9]{1,2})?)\s*(?:reais|real)?\s*$');
  if v_value_match is null then
    v_value_match := regexp_match(v_norm, '(?:por|r\$)\s*([0-9]+(?:[,.][0-9]{1,2})?)');
  end if;

  if v_value_match is null then
    return jsonb_build_object('success', false, 'message', 'Qual foi o valor do servico?');
  end if;

  v_valor := replace(v_value_match[1], ',', '.')::numeric;
  if v_valor <= 0 then
    return jsonb_build_object('success', false, 'message', 'Qual foi o valor do servico?');
  end if;

  select b.*
  into v_barbeiro
  from public.barbeiros b
  where b.barbearia_id = p_barbearia_id
    and coalesce(b.ativo, true) = true
    and position(public.aida_normalize(b.nome) in v_norm) > 0
  order by length(public.aida_normalize(b.nome)) desc, b.nome
  limit 1;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Nao encontrei esse profissional nessa barbearia.');
  end if;

  select count(*)
  into v_barbeiro_count
  from public.barbeiros b
  where b.barbearia_id = p_barbearia_id
    and coalesce(b.ativo, true) = true
    and v_barbeiro.id is not null
    and split_part(public.aida_normalize(b.nome), ' ', 1) = split_part(public.aida_normalize(v_barbeiro.nome), ' ', 1);

  if v_barbeiro_count > 1 and not (v_norm like '%' || public.aida_normalize(v_barbeiro.nome) || '%') then
    return jsonb_build_object('success', false, 'message', 'Encontrei mais de um profissional parecido. Informe o nome completo.');
  end if;

  v_clean := v_norm;
  v_clean := replace(v_clean, public.aida_normalize(v_barbeiro.nome), ' ');
  v_clean := regexp_replace(v_clean, '([0-9]+(?:[,.][0-9]{1,2})?)\s*(?:reais|real)?', ' ', 'g');
  v_clean := regexp_replace(v_clean, '(^| )(agora|fez|cortou|corta|cortei|atendeu|atendimento|um|uma|de|do|da|no|na|em|por|r\$|pix|cartao|credito|debito|dinheiro|cash)( |$)', ' ', 'g');
  v_clean := regexp_replace(v_clean, '\s+', ' ', 'g');
  v_clean := trim(v_clean);

  v_cliente_nome := coalesce(nullif((regexp_match(v_norm, '(?:cliente|para)\s+([a-z ]{3,})(?:\s+fez|\s+cortou|\s+por|\s+[0-9]|$)'))[1], ''), 'Cliente avulso');

  if v_clean = '' then
    return jsonb_build_object('success', false, 'message', 'Nao consegui identificar o servico. Exemplo: ''Diego fez corte 30 reais''.');
  end if;

  if v_clean like '%cabelo%' then
    v_service_query := replace(v_clean, 'cabelo', 'corte');
  else
    v_service_query := v_clean;
  end if;

  with candidates as (
    select s.*,
      public.aida_normalize(s.nome) as norm_nome,
      coalesce(public.aida_normalize(s.categoria), '') as norm_categoria
    from public.servicos s
    where s.barbearia_id = p_barbearia_id
      and coalesce(s.ativo, true) = true
  ),
  ranked as (
    select c.*,
      case
        when c.norm_nome = v_service_query then 100
        when c.norm_nome like '%' || v_service_query || '%' then 80
        when v_service_query like '%corte%' and v_service_query like '%barba%' and c.norm_nome like '%corte%' and c.norm_nome like '%barba%' then 75
        when v_service_query like '%corte%' and v_service_query like '%masculino%' and c.norm_nome like '%corte%' and c.norm_nome like '%masculino%' then 70
        when v_service_query like '%infantil%' and c.norm_nome like '%infantil%' then 65
        when v_service_query like '%sobrancelha%' and c.norm_nome like '%sobrancelha%' then 65
        when v_service_query like '%barba%' and c.norm_nome like '%barba%' then 60
        when v_service_query like '%corte%' and (c.norm_nome like '%corte%' or c.norm_nome like '%cabelo%' or c.norm_categoria = 'corte') then 55
        else 0
      end as score
    from candidates c
  )
  select *
  into v_servico
  from ranked
  where score > 0
  order by score desc, coalesce(mais_vendido, false) desc, coalesce(ordem, 0), nome
  limit 1;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Nao consegui identificar o servico. Exemplo: ''Diego fez corte 30 reais''.');
  end if;

  with candidates as (
    select s.*,
      public.aida_normalize(s.nome) as norm_nome,
      coalesce(public.aida_normalize(s.categoria), '') as norm_categoria
    from public.servicos s
    where s.barbearia_id = p_barbearia_id
      and coalesce(s.ativo, true) = true
  ),
  ranked as (
    select c.*,
      case
        when c.norm_nome = v_service_query then 100
        when c.norm_nome like '%' || v_service_query || '%' then 80
        when v_service_query like '%corte%' and v_service_query like '%barba%' and c.norm_nome like '%corte%' and c.norm_nome like '%barba%' then 75
        when v_service_query like '%corte%' and v_service_query like '%masculino%' and c.norm_nome like '%corte%' and c.norm_nome like '%masculino%' then 70
        when v_service_query like '%infantil%' and c.norm_nome like '%infantil%' then 65
        when v_service_query like '%sobrancelha%' and c.norm_nome like '%sobrancelha%' then 65
        when v_service_query like '%barba%' and c.norm_nome like '%barba%' then 60
        when v_service_query like '%corte%' and (c.norm_nome like '%corte%' or c.norm_nome like '%cabelo%' or c.norm_categoria = 'corte') then 55
        else 0
      end as score
    from candidates c
  )
  select count(*)
  into v_servico_count
  from ranked
  where score = (
    select max(score)
    from ranked
  )
    and score > 0;

  if v_servico_count > 1 then
    return jsonb_build_object(
      'success', false,
      'message', 'Encontrei mais de um servico parecido. Informe o nome mais completo do servico.',
      'needs_confirmation', true
    );
  end if;

  v_fim := v_inicio + (coalesce(v_servico.duracao_minutos, 30) || ' minutes')::interval;

  select count(*)
  into v_conflitos
  from public.agendamentos a
  where a.barbearia_id = p_barbearia_id
    and a.barbeiro_id = v_barbeiro.id
    and a.status in ('aceito', 'concluido')
    and (a.data_hora_inicio, a.data_hora_fim) overlaps (v_inicio, v_fim);

  select c.id
  into v_cliente_id
  from public.clientes c
  where c.barbearia_id = p_barbearia_id
    and lower(c.email) = 'aida-avulso-' || p_barbearia_id::text || '@meucaixa.local'
  limit 1;

  if v_cliente_id is null then
    insert into public.clientes (barbearia_id, nome, email, telefone)
    values (
      p_barbearia_id,
      'Cliente avulso',
      'aida-avulso-' || p_barbearia_id::text || '@meucaixa.local',
      '00000000000'
    )
    returning id into v_cliente_id;
  end if;

  v_observacao := 'Lancamento rapido AIDA. Texto: ' || left(v_text, 220);

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
    v_cliente_id,
    v_barbeiro.id,
    v_servico.id,
    v_inicio,
    v_fim,
    v_valor,
    'concluido',
    v_observacao
  )
  returning id into v_agendamento_id;

  insert into public.transacoes (
    barbearia_id,
    cliente_nome,
    barbeiro_id,
    servico_id,
    valor_total,
    data
  ) values (
    p_barbearia_id,
    v_cliente_nome,
    v_barbeiro.id,
    v_servico.id,
    v_valor,
    v_inicio
  )
  returning id into v_transacao_id;

  insert into public.transacao_pagamentos (transacao_id, metodo, valor)
  values (v_transacao_id, v_metodo, v_valor);

  return jsonb_build_object(
    'success', true,
    'message',
      'Lancado: ' || v_barbeiro.nome || ' - ' || v_servico.nome || ' - ' ||
      to_char(v_valor, '"R$ "FM999G999G990D00') || ' - ' ||
      case when v_time_match is null then 'agora' else to_char(v_inicio at time zone 'America/Sao_Paulo', 'HH24:MI') end ||
      case when v_conflitos > 0 then '. Aviso: ja havia outro atendimento nesse horario.' else '.' end,
    'agendamento_id', v_agendamento_id,
    'transacao_id', v_transacao_id,
    'profissional_nome', v_barbeiro.nome,
    'servico_nome', v_servico.nome,
    'valor', v_valor,
    'forma_pagamento', v_metodo,
    'conflitos', v_conflitos
  );
end;
$$;

revoke all on function public.rpc_aida_lancamento_rapido(uuid, text) from public;
grant execute on function public.rpc_aida_lancamento_rapido(uuid, text) to authenticated;
