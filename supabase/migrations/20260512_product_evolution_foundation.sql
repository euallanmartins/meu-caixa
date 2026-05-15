-- Product evolution foundation for Meu Caixa Premium.
-- Incremental and idempotent: extends the current schema without duplicating existing flows.

create extension if not exists pgcrypto;

alter table public.barbearias
  add column if not exists onboarding_completed boolean not null default false,
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists slug text;

create unique index if not exists idx_barbearias_slug_unique
  on public.barbearias (lower(slug))
  where slug is not null and btrim(slug) <> '';

update public.barbearias
set onboarding_completed = true,
    onboarding_completed_at = coalesce(onboarding_completed_at, now())
where coalesce(status, 'active') = 'active'
  and coalesce(ativo, true) = true
  and onboarding_completed = false;

alter table public.servicos
  add column if not exists categoria text,
  add column if not exists descricao text,
  add column if not exists foto_url text,
  add column if not exists ativo boolean not null default true;

alter table public.clientes
  add column if not exists observacoes_internas text,
  add column if not exists preferencias jsonb not null default '{}'::jsonb,
  add column if not exists barbeiro_favorito_id uuid references public.barbeiros(id),
  add column if not exists bloqueado boolean not null default false,
  add column if not exists motivo_bloqueio text,
  add column if not exists bloqueado_em timestamptz,
  add column if not exists bloqueado_por uuid references auth.users(id);

alter table public.agendamentos
  add column if not exists cancelado_em timestamptz,
  add column if not exists cancelado_por uuid references auth.users(id),
  add column if not exists cancelamento_origem text,
  add column if not exists reagendado_em timestamptz,
  add column if not exists reagendado_por uuid references auth.users(id),
  add column if not exists reagendado_de_inicio timestamptz,
  add column if not exists reagendado_de_fim timestamptz,
  add column if not exists cliente_confirmou boolean not null default false,
  add column if not exists cliente_confirmou_em timestamptz,
  add column if not exists lembrete_enviado_em timestamptz,
  add column if not exists ultimo_webhook_evento text;

alter table public.avaliacoes
  add column if not exists agendamento_id uuid references public.agendamentos(id) on delete set null,
  add column if not exists barbeiro_id uuid references public.barbeiros(id) on delete set null,
  add column if not exists verificada boolean not null default false,
  add column if not exists resposta_barbearia text,
  add column if not exists respondida_em timestamptz,
  add column if not exists respondida_por uuid references auth.users(id) on delete set null;

alter table public.team_invites
  add column if not exists email_status text not null default 'nao_enviado',
  add column if not exists email_sent_to_n8n_at timestamptz,
  add column if not exists email_last_error text;

alter table public.platform_owner_invites
  add column if not exists email_status text not null default 'nao_enviado',
  add column if not exists email_sent_to_n8n_at timestamptz,
  add column if not exists email_last_error text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'team_invites_email_status_check'
  ) then
    alter table public.team_invites
      add constraint team_invites_email_status_check
      check (email_status in ('nao_enviado', 'enviado_para_automacao', 'erro'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'platform_owner_invites_email_status_check'
  ) then
    alter table public.platform_owner_invites
      add constraint platform_owner_invites_email_status_check
      check (email_status in ('nao_enviado', 'enviado_para_automacao', 'erro'));
  end if;
end $$;

create table if not exists public.waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  barbearia_id uuid not null references public.barbearias(id) on delete cascade,
  cliente_id uuid references public.clientes(id) on delete set null,
  cliente_nome text not null,
  cliente_telefone text not null,
  cliente_email text,
  barbeiro_id uuid references public.barbeiros(id) on delete set null,
  servico_ids uuid[] not null default '{}'::uuid[],
  data_preferida date,
  periodo_preferido text not null default 'qualquer',
  observacao text,
  status text not null default 'aguardando',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint waitlist_entries_periodo_check check (periodo_preferido in ('manha', 'tarde', 'noite', 'qualquer')),
  constraint waitlist_entries_status_check check (status in ('aguardando', 'avisado', 'convertido', 'cancelado', 'expirado'))
);

create index if not exists idx_waitlist_entries_barbearia_id on public.waitlist_entries(barbearia_id);
create index if not exists idx_waitlist_entries_cliente_id on public.waitlist_entries(cliente_id);
create index if not exists idx_waitlist_entries_status on public.waitlist_entries(status);
create index if not exists idx_waitlist_entries_data_preferida on public.waitlist_entries(data_preferida);

create table if not exists public.cliente_tags (
  id uuid primary key default gen_random_uuid(),
  barbearia_id uuid not null references public.barbearias(id) on delete cascade,
  nome text not null,
  cor text,
  created_at timestamptz not null default now(),
  unique (barbearia_id, nome)
);

create table if not exists public.cliente_tag_links (
  id uuid primary key default gen_random_uuid(),
  barbearia_id uuid not null references public.barbearias(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  tag_id uuid not null references public.cliente_tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (barbearia_id, cliente_id, tag_id)
);

create table if not exists public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  barbearia_id uuid not null references public.barbearias(id) on delete cascade,
  titulo text not null,
  mensagem text not null,
  publico_tipo text not null,
  publico_filtros jsonb not null default '{}'::jsonb,
  status text not null default 'rascunho',
  created_by uuid references auth.users(id) on delete set null,
  sent_to_n8n_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketing_campaigns_status_check check (status in ('rascunho', 'enviada_para_automacao', 'cancelada'))
);

create table if not exists public.marketing_campaign_audience_snapshot (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.marketing_campaigns(id) on delete cascade,
  barbearia_id uuid not null references public.barbearias(id) on delete cascade,
  cliente_id uuid references public.clientes(id) on delete set null,
  cliente_nome text,
  cliente_telefone text,
  cliente_email text,
  created_at timestamptz not null default now()
);

create table if not exists public.promocoes (
  id uuid primary key default gen_random_uuid(),
  barbearia_id uuid not null references public.barbearias(id) on delete cascade,
  titulo text not null,
  descricao text,
  servico_id uuid references public.servicos(id) on delete set null,
  barbeiro_id uuid references public.barbeiros(id) on delete set null,
  data_inicio date not null,
  data_fim date not null,
  horario_inicio time,
  horario_fim time,
  status text not null default 'ativo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint promocoes_status_check check (status in ('ativo', 'inativo')),
  constraint promocoes_periodo_check check (data_fim >= data_inicio)
);

create table if not exists public.servico_adicionais (
  id uuid primary key default gen_random_uuid(),
  barbearia_id uuid not null references public.barbearias(id) on delete cascade,
  servico_id uuid not null references public.servicos(id) on delete cascade,
  nome text not null,
  descricao text,
  valor numeric not null default 0,
  duracao_extra_minutos integer not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.servico_profissionais (
  id uuid primary key default gen_random_uuid(),
  barbearia_id uuid not null references public.barbearias(id) on delete cascade,
  servico_id uuid not null references public.servicos(id) on delete cascade,
  barbeiro_id uuid not null references public.barbeiros(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (barbearia_id, servico_id, barbeiro_id)
);

create table if not exists public.servico_combo_items (
  id uuid primary key default gen_random_uuid(),
  barbearia_id uuid not null references public.barbearias(id) on delete cascade,
  combo_servico_id uuid not null references public.servicos(id) on delete cascade,
  item_servico_id uuid not null references public.servicos(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (barbearia_id, combo_servico_id, item_servico_id)
);

create table if not exists public.custom_forms (
  id uuid primary key default gen_random_uuid(),
  barbearia_id uuid not null references public.barbearias(id) on delete cascade,
  titulo text not null,
  descricao text,
  servico_id uuid references public.servicos(id) on delete set null,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.custom_form_fields (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.custom_forms(id) on delete cascade,
  label text not null,
  type text not null,
  required boolean not null default false,
  options jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint custom_form_fields_type_check check (type in ('text', 'textarea', 'select', 'checkbox', 'radio'))
);

create table if not exists public.custom_form_responses (
  id uuid primary key default gen_random_uuid(),
  barbearia_id uuid not null references public.barbearias(id) on delete cascade,
  agendamento_id uuid references public.agendamentos(id) on delete cascade,
  cliente_id uuid references public.clientes(id) on delete set null,
  form_id uuid not null references public.custom_forms(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  barbearia_id uuid not null references public.barbearias(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  assunto text not null,
  mensagem text not null,
  status text not null default 'aberto',
  created_at timestamptz not null default now(),
  constraint support_tickets_status_check check (status in ('aberto', 'em_andamento', 'resolvido', 'fechado'))
);

alter table public.waitlist_entries enable row level security;
alter table public.cliente_tags enable row level security;
alter table public.cliente_tag_links enable row level security;
alter table public.marketing_campaigns enable row level security;
alter table public.marketing_campaign_audience_snapshot enable row level security;
alter table public.promocoes enable row level security;
alter table public.servico_adicionais enable row level security;
alter table public.servico_profissionais enable row level security;
alter table public.servico_combo_items enable row level security;
alter table public.custom_forms enable row level security;
alter table public.custom_form_fields enable row level security;
alter table public.custom_form_responses enable row level security;
alter table public.support_tickets enable row level security;

create or replace function public.same_barbearia_or_platform(p_barbearia_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.current_user_is_platform_admin()
    or (
      public.current_user_barbearia_id() is not null
      and public.current_user_barbearia_id() = p_barbearia_id
    )
$$;

revoke all on function public.same_barbearia_or_platform(uuid) from public;
grant execute on function public.same_barbearia_or_platform(uuid) to authenticated;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'waitlist_entries',
    'cliente_tags',
    'cliente_tag_links',
    'marketing_campaigns',
    'marketing_campaign_audience_snapshot',
    'promocoes',
    'servico_adicionais',
    'servico_profissionais',
    'servico_combo_items',
    'custom_forms',
    'custom_form_responses',
    'support_tickets'
  ] loop
    execute format('drop policy if exists %I on public.%I', v_table || '_tenant_all', v_table);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.same_barbearia_or_platform(barbearia_id)) with check (public.same_barbearia_or_platform(barbearia_id))',
      v_table || '_tenant_all',
      v_table
    );
  end loop;
end $$;

drop policy if exists custom_form_fields_tenant_all on public.custom_form_fields;
create policy custom_form_fields_tenant_all
on public.custom_form_fields
for all
to authenticated
using (
  exists (
    select 1 from public.custom_forms f
    where f.id = custom_form_fields.form_id
      and public.same_barbearia_or_platform(f.barbearia_id)
  )
)
with check (
  exists (
    select 1 from public.custom_forms f
    where f.id = custom_form_fields.form_id
      and public.same_barbearia_or_platform(f.barbearia_id)
  )
);

drop policy if exists waitlist_entries_client_select_own on public.waitlist_entries;
create policy waitlist_entries_client_select_own
on public.waitlist_entries
for select
to authenticated
using (
  cliente_id in (
    select ca.cliente_id
    from public.cliente_accounts ca
    where ca.auth_user_id = auth.uid()
      and ca.barbearia_id = waitlist_entries.barbearia_id
  )
);

drop policy if exists promocoes_public_active_select on public.promocoes;
create policy promocoes_public_active_select
on public.promocoes
for select
to anon, authenticated
using (
  status = 'ativo'
  and current_date between data_inicio and data_fim
  and exists (
    select 1
    from public.barbearias b
    where b.id = promocoes.barbearia_id
      and coalesce(b.ativo, true) = true
      and coalesce(b.status, 'active') = 'active'
  )
);

drop policy if exists custom_forms_public_active_select on public.custom_forms;
create policy custom_forms_public_active_select
on public.custom_forms
for select
to anon, authenticated
using (ativo = true);

drop policy if exists custom_form_fields_public_select on public.custom_form_fields;
create policy custom_form_fields_public_select
on public.custom_form_fields
for select
to anon, authenticated
using (
  exists (
    select 1 from public.custom_forms f
    where f.id = custom_form_fields.form_id
      and f.ativo = true
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
    on conflict (auth_user_id, barbearia_id) do update
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

create or replace function public.rpc_cliente_cancelar_agendamento(
  p_agendamento_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ag record;
  v_ids uuid[];
begin
  if auth.uid() is null then
    raise exception 'Login necessario.';
  end if;

  select a.*
    into v_ag
  from public.agendamentos a
  join public.cliente_accounts ca
    on ca.cliente_id = a.cliente_id
   and ca.barbearia_id = a.barbearia_id
   and ca.auth_user_id = auth.uid()
  where a.id = p_agendamento_id
  for update;

  if v_ag.id is null then
    raise exception 'Agendamento nao encontrado.';
  end if;

  if v_ag.status in ('concluido', 'realizado', 'atendido', 'recusado', 'cancelado') then
    return jsonb_build_object('success', false, 'message', 'Este agendamento nao pode ser cancelado.');
  end if;

  if v_ag.data_hora_inicio <= now() + interval '2 hours' then
    return jsonb_build_object('success', false, 'message', 'Cancelamento indisponivel com menos de 2 horas de antecedencia.');
  end if;

  select array_agg(a.id order by a.data_hora_inicio)
    into v_ids
  from public.agendamentos a
  where a.barbearia_id = v_ag.barbearia_id
    and a.cliente_id = v_ag.cliente_id
    and (
      (v_ag.idempotency_key is not null and a.idempotency_key = v_ag.idempotency_key)
      or a.id = v_ag.id
    )
    and a.status not in ('concluido', 'realizado', 'atendido', 'recusado', 'cancelado');

  update public.agendamentos a
  set status = 'cancelado',
      cancelado_em = now(),
      cancelado_por = auth.uid(),
      cancelamento_origem = 'cliente',
      ultimo_webhook_evento = 'appointment_cancelled_by_client'
  where a.id = any(v_ids);

  return jsonb_build_object('success', true, 'ids', v_ids);
end;
$$;

create or replace function public.rpc_cliente_reagendar_agendamento(
  p_agendamento_id uuid,
  p_novo_inicio timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ag record;
  v_item record;
  v_atual_inicio timestamptz;
  v_atual_fim timestamptz;
  v_conflicts int;
  v_ids uuid[];
begin
  if auth.uid() is null then
    raise exception 'Login necessario.';
  end if;

  if p_novo_inicio <= now() then
    return jsonb_build_object('success', false, 'message', 'Escolha um horario futuro.');
  end if;

  select a.*
    into v_ag
  from public.agendamentos a
  join public.cliente_accounts ca
    on ca.cliente_id = a.cliente_id
   and ca.barbearia_id = a.barbearia_id
   and ca.auth_user_id = auth.uid()
  where a.id = p_agendamento_id
  for update;

  if v_ag.id is null then
    raise exception 'Agendamento nao encontrado.';
  end if;

  if v_ag.status in ('concluido', 'realizado', 'atendido', 'recusado', 'cancelado') then
    return jsonb_build_object('success', false, 'message', 'Este agendamento nao pode ser reagendado.');
  end if;

  select array_agg(a.id order by a.data_hora_inicio)
    into v_ids
  from public.agendamentos a
  where a.barbearia_id = v_ag.barbearia_id
    and a.cliente_id = v_ag.cliente_id
    and (
      (v_ag.idempotency_key is not null and a.idempotency_key = v_ag.idempotency_key)
      or a.id = v_ag.id
    )
    and a.status not in ('concluido', 'realizado', 'atendido', 'recusado', 'cancelado');

  v_atual_inicio := p_novo_inicio;

  for v_item in
    select a.id, a.barbeiro_id, a.data_hora_inicio, a.data_hora_fim,
           greatest(extract(epoch from (a.data_hora_fim - a.data_hora_inicio)) / 60, 1)::int as duracao_min
    from public.agendamentos a
    where a.id = any(v_ids)
    order by a.data_hora_inicio
  loop
    v_atual_fim := v_atual_inicio + (v_item.duracao_min || ' minutes')::interval;

    select count(*)
      into v_conflicts
    from public.agendamentos a
    where a.barbearia_id = v_ag.barbearia_id
      and a.barbeiro_id = v_item.barbeiro_id
      and a.id <> all(v_ids)
      and a.status in ('aceito', 'confirmado', 'concluido', 'realizado', 'atendido')
      and a.data_hora_inicio < v_atual_fim
      and a.data_hora_fim > v_atual_inicio;

    if v_conflicts > 0 then
      return jsonb_build_object('success', false, 'message', 'Esse horario acabou de ser ocupado. Escolha outro horario.');
    end if;

    if to_regclass('public.bloqueios') is not null then
      select count(*)
        into v_conflicts
      from public.bloqueios b
      where b.barbearia_id = v_ag.barbearia_id
        and (b.barbeiro_id is null or b.barbeiro_id = v_item.barbeiro_id)
        and (
          (b.tipo = 'dia' and b.data = (v_atual_inicio at time zone 'America/Sao_Paulo')::date)
          or (
            b.tipo = 'horario'
            and b.data = (v_atual_inicio at time zone 'America/Sao_Paulo')::date
            and ((v_atual_inicio at time zone 'America/Sao_Paulo')::time, (v_atual_fim at time zone 'America/Sao_Paulo')::time)
              overlaps (b.hora_inicio, b.hora_fim)
          )
        );

      if v_conflicts > 0 then
        return jsonb_build_object('success', false, 'message', 'Esse horario acabou de ser ocupado. Escolha outro horario.');
      end if;
    end if;

    update public.agendamentos
    set data_hora_inicio = v_atual_inicio,
        data_hora_fim = v_atual_fim,
        reagendado_em = now(),
        reagendado_por = auth.uid(),
        reagendado_de_inicio = v_item.data_hora_inicio,
        reagendado_de_fim = v_item.data_hora_fim,
        ultimo_webhook_evento = 'appointment_rescheduled_by_client'
    where id = v_item.id;

    v_atual_inicio := v_atual_fim;
  end loop;

  return jsonb_build_object('success', true, 'ids', v_ids);
end;
$$;

create or replace function public.rpc_create_waitlist_entry(
  p_barbearia_id uuid,
  p_cliente_nome text,
  p_cliente_telefone text,
  p_cliente_email text default null,
  p_barbeiro_id uuid default null,
  p_servico_ids uuid[] default '{}'::uuid[],
  p_data_preferida date default null,
  p_periodo_preferido text default 'qualquer',
  p_observacao text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cliente_id uuid;
  v_email text := nullif(lower(trim(coalesce(p_cliente_email, ''))), '');
  v_periodo text := coalesce(nullif(p_periodo_preferido, ''), 'qualquer');
begin
  if p_barbearia_id is null then
    raise exception 'Barbearia invalida.';
  end if;

  if not exists (
    select 1 from public.barbearias b
    where b.id = p_barbearia_id
      and coalesce(b.ativo, true) = true
      and coalesce(b.status, 'active') = 'active'
      and coalesce(b.agendamentos_pausados, false) = false
  ) then
    return jsonb_build_object('success', false, 'message', 'Agendamentos indisponiveis no momento.');
  end if;

  if p_barbeiro_id is not null and not exists (
    select 1 from public.barbeiros bb
    where bb.id = p_barbeiro_id
      and bb.barbearia_id = p_barbearia_id
      and coalesce(bb.ativo, true) = true
  ) then
    raise exception 'Profissional invalido.';
  end if;

  if cardinality(coalesce(p_servico_ids, '{}'::uuid[])) > 0 and exists (
    select 1
    from unnest(p_servico_ids) sid
    left join public.servicos s on s.id = sid and s.barbearia_id = p_barbearia_id
    where s.id is null
  ) then
    raise exception 'Servico invalido.';
  end if;

  if auth.uid() is not null then
    select ca.cliente_id
      into v_cliente_id
    from public.cliente_accounts ca
    where ca.auth_user_id = auth.uid()
      and ca.barbearia_id = p_barbearia_id
    limit 1;
  end if;

  if v_cliente_id is null and v_email is not null then
    select c.id
      into v_cliente_id
    from public.clientes c
    where c.barbearia_id = p_barbearia_id
      and lower(c.email) = v_email
    order by c.created_at desc nulls last
    limit 1;
  end if;

  insert into public.waitlist_entries (
    barbearia_id,
    cliente_id,
    cliente_nome,
    cliente_telefone,
    cliente_email,
    barbeiro_id,
    servico_ids,
    data_preferida,
    periodo_preferido,
    observacao,
    status
  )
  values (
    p_barbearia_id,
    v_cliente_id,
    nullif(trim(p_cliente_nome), ''),
    nullif(trim(p_cliente_telefone), ''),
    v_email,
    p_barbeiro_id,
    coalesce(p_servico_ids, '{}'::uuid[]),
    p_data_preferida,
    v_periodo,
    nullif(trim(coalesce(p_observacao, '')), ''),
    'aguardando'
  );

  return jsonb_build_object('success', true, 'message', 'Voce entrou na lista de espera.');
end;
$$;

create or replace function public.rpc_waitlist_update_status(
  p_waitlist_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_entry record;
begin
  if p_status not in ('aguardando', 'avisado', 'convertido', 'cancelado', 'expirado') then
    raise exception 'Status invalido.';
  end if;

  select *
    into v_entry
  from public.waitlist_entries
  where id = p_waitlist_id
  for update;

  if v_entry.id is null then
    raise exception 'Entrada nao encontrada.';
  end if;

  if not public.same_barbearia_or_platform(v_entry.barbearia_id) then
    raise exception 'Acesso negado.';
  end if;

  update public.waitlist_entries
  set status = p_status,
      updated_at = now()
  where id = p_waitlist_id;

  return jsonb_build_object('success', true);
end;
$$;

create or replace function public.rpc_mark_onboarding_completed(
  p_barbearia_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_barbearia_id is null then
    raise exception 'Barbearia invalida.';
  end if;

  if not public.same_barbearia_or_platform(p_barbearia_id) then
    raise exception 'Acesso negado.';
  end if;

  update public.barbearias
  set onboarding_completed = true,
      onboarding_completed_at = now()
  where id = p_barbearia_id;

  return jsonb_build_object('success', true);
end;
$$;

create or replace function public.prevent_blocked_cliente_booking()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (
    select 1
    from public.clientes c
    where c.id = new.cliente_id
      and c.barbearia_id = new.barbearia_id
      and coalesce(c.bloqueado, false) = true
  ) then
    raise exception 'Agendamentos indisponiveis para este cadastro.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_blocked_cliente_booking on public.agendamentos;
create trigger trg_prevent_blocked_cliente_booking
before insert on public.agendamentos
for each row execute function public.prevent_blocked_cliente_booking();

create or replace function public.rpc_save_custom_form_response(
  p_barbearia_id uuid,
  p_agendamento_id uuid,
  p_cliente_id uuid,
  p_form_id uuid,
  p_answers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1
    from public.agendamentos a
    where a.id = p_agendamento_id
      and a.barbearia_id = p_barbearia_id
      and a.cliente_id = p_cliente_id
  ) then
    raise exception 'Agendamento invalido.';
  end if;

  if not exists (
    select 1
    from public.custom_forms f
    where f.id = p_form_id
      and f.barbearia_id = p_barbearia_id
      and f.ativo = true
  ) then
    raise exception 'Formulario invalido.';
  end if;

  insert into public.custom_form_responses (
    barbearia_id,
    agendamento_id,
    cliente_id,
    form_id,
    answers
  ) values (
    p_barbearia_id,
    p_agendamento_id,
    p_cliente_id,
    p_form_id,
    coalesce(p_answers, '{}'::jsonb)
  )
  on conflict do nothing;

  return jsonb_build_object('success', true);
end;
$$;

revoke all on function public.rpc_cliente_meus_agendamentos_auth(uuid) from public;
revoke all on function public.rpc_cliente_cancelar_agendamento(uuid) from public;
revoke all on function public.rpc_cliente_reagendar_agendamento(uuid, timestamptz) from public;
revoke all on function public.rpc_create_waitlist_entry(uuid, text, text, text, uuid, uuid[], date, text, text) from public;
revoke all on function public.rpc_waitlist_update_status(uuid, text) from public;
revoke all on function public.rpc_mark_onboarding_completed(uuid) from public;
revoke all on function public.prevent_blocked_cliente_booking() from public;
revoke all on function public.rpc_save_custom_form_response(uuid, uuid, uuid, uuid, jsonb) from public;

grant execute on function public.rpc_cliente_meus_agendamentos_auth(uuid) to authenticated;
grant execute on function public.rpc_cliente_cancelar_agendamento(uuid) to authenticated;
grant execute on function public.rpc_cliente_reagendar_agendamento(uuid, timestamptz) to authenticated;
grant execute on function public.rpc_create_waitlist_entry(uuid, text, text, text, uuid, uuid[], date, text, text) to anon, authenticated;
grant execute on function public.rpc_waitlist_update_status(uuid, text) to authenticated;
grant execute on function public.rpc_mark_onboarding_completed(uuid) to authenticated;
grant execute on function public.rpc_save_custom_form_response(uuid, uuid, uuid, uuid, jsonb) to anon, authenticated;

grant select, insert, update, delete on public.waitlist_entries to authenticated;
grant select, insert, update, delete on public.cliente_tags to authenticated;
grant select, insert, update, delete on public.cliente_tag_links to authenticated;
grant select, insert, update, delete on public.marketing_campaigns to authenticated;
grant select, insert, update, delete on public.marketing_campaign_audience_snapshot to authenticated;
grant select on public.promocoes to anon, authenticated;
grant insert, update, delete on public.promocoes to authenticated;
grant select on public.custom_forms to anon, authenticated;
grant select on public.custom_form_fields to anon, authenticated;
grant insert, update, delete on public.custom_forms to authenticated;
grant insert, update, delete on public.custom_form_fields to authenticated;
grant select, insert, update, delete on public.custom_form_responses to authenticated;
grant select, insert, update, delete on public.support_tickets to authenticated;
