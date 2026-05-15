-- Individual professional access for barbers.
-- Barbers remain Supabase Auth users, but their professional scope is limited
-- to profiles.barbearia_id + profiles.barbeiro_id.

alter table public.profiles
  add column if not exists barbeiro_id uuid references public.barbeiros(id) on delete set null;

alter table public.team_invites
  add column if not exists barbeiro_id uuid references public.barbeiros(id) on delete set null;

create index if not exists idx_profiles_barbearia_barbeiro
  on public.profiles (barbearia_id, barbeiro_id);

create index if not exists idx_profiles_barbearia_role
  on public.profiles (barbearia_id, role);

create index if not exists idx_profiles_role
  on public.profiles (role);

create index if not exists idx_team_invites_barbearia_barbeiro
  on public.team_invites (barbearia_id, barbeiro_id);

create or replace function public.is_admin_role(p_role text)
returns boolean
language sql
stable
as $$
  select coalesce(p_role, '') in ('owner', 'admin', 'proprietario', 'gerente', 'platform_admin', 'super_admin')
$$;

create or replace function public.current_user_barbeiro_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.barbeiro_id
  from public.profiles p
  where p.id = auth.uid()
  limit 1
$$;

revoke all on function public.current_user_barbeiro_id() from public;
grant execute on function public.current_user_barbeiro_id() to authenticated;

drop policy if exists "team_invites_admin_insert_same_barbearia" on public.team_invites;

create policy "team_invites_admin_insert_same_barbearia"
on public.team_invites
for insert
to authenticated
with check (
  invited_by = auth.uid()
  and status = 'pending'
  and accepted_by is null
  and accepted_at is null
  and cancelled_at is null
  and expires_at > now()
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and public.is_admin_role(p.role)
      and p.barbearia_id = team_invites.barbearia_id
      and (
        team_invites.role not in ('owner', 'admin', 'proprietario')
        or p.role in ('owner', 'proprietario')
      )
      and (
        team_invites.role <> 'barbeiro'
        or exists (
          select 1
          from public.barbeiros b
          where b.id = team_invites.barbeiro_id
            and b.barbearia_id = team_invites.barbearia_id
            and coalesce(b.ativo, true) = true
        )
      )
  )
);

drop function if exists public.rpc_create_team_invite(text, text, text, text);

create or replace function public.rpc_create_team_invite(
  p_email text,
  p_nome text default null,
  p_telefone text default null,
  p_role text default 'barbeiro',
  p_barbeiro_id uuid default null
) returns table (
  id uuid,
  barbearia_id uuid,
  email text,
  nome text,
  telefone text,
  role text,
  token text,
  status text,
  expires_at timestamptz,
  created_at timestamptz,
  barbeiro_id uuid
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile record;
  v_email text := lower(trim(coalesce(p_email, '')));
  v_nome text := nullif(trim(coalesce(p_nome, '')), '');
  v_telefone text := nullif(trim(coalesce(p_telefone, '')), '');
  v_role text := lower(trim(coalesce(p_role, 'barbeiro')));
  v_barbeiro_id uuid := p_barbeiro_id;
  v_token text;
  v_invite public.team_invites%rowtype;
begin
  if v_auth_user_id is null then
    raise exception 'Login necessario.';
  end if;

  select id, barbearia_id, role
    into v_profile
  from public.profiles
  where id = v_auth_user_id;

  if v_profile.id is null or v_profile.barbearia_id is null or not public.is_admin_role(v_profile.role) then
    raise exception 'Voce nao tem permissao para convidar funcionarios.';
  end if;

  if v_email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' then
    raise exception 'E-mail invalido.';
  end if;

  if not public.is_professional_role(v_role) then
    raise exception 'Funcao invalida.';
  end if;

  if v_role in ('owner', 'admin', 'proprietario') and v_profile.role not in ('owner', 'proprietario') then
    raise exception 'Apenas owner/proprietario pode convidar administradores.';
  end if;

  if v_role = 'barbeiro' then
    if v_barbeiro_id is null then
      raise exception 'Selecione o barbeiro vinculado a este acesso.';
    end if;

    if not exists (
      select 1
      from public.barbeiros b
      where b.id = v_barbeiro_id
        and b.barbearia_id = v_profile.barbearia_id
        and coalesce(b.ativo, true) = true
    ) then
      raise exception 'Barbeiro invalido para esta barbearia.';
    end if;
  else
    v_barbeiro_id := null;
  end if;

  update public.team_invites
  set status = 'expired'
  where barbearia_id = v_profile.barbearia_id
    and status = 'pending'
    and expires_at <= now();

  v_token := encode(gen_random_bytes(32), 'hex');

  insert into public.team_invites (
    barbearia_id,
    invited_by,
    email,
    nome,
    telefone,
    role,
    token,
    status,
    expires_at,
    barbeiro_id
  )
  values (
    v_profile.barbearia_id,
    v_auth_user_id,
    v_email,
    v_nome,
    v_telefone,
    v_role,
    v_token,
    'pending',
    now() + interval '7 days',
    v_barbeiro_id
  )
  returning * into v_invite;

  return query
  select
    v_invite.id,
    v_invite.barbearia_id,
    v_invite.email,
    v_invite.nome,
    v_invite.telefone,
    v_invite.role,
    v_invite.token,
    v_invite.status,
    v_invite.expires_at,
    v_invite.created_at,
    v_invite.barbeiro_id;
end;
$$;

drop function if exists public.rpc_get_team_invite_by_token(text);

create or replace function public.rpc_get_team_invite_by_token(
  p_token text
) returns table (
  barbearia_nome text,
  email text,
  nome text,
  role text,
  status text,
  expires_at timestamptz,
  barbeiro_id uuid,
  barbeiro_nome text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_token text := trim(coalesce(p_token, ''));
begin
  update public.team_invites
  set status = 'expired'
  where token = v_token
    and status = 'pending'
    and expires_at <= now();

  return query
  select
    b.nome as barbearia_nome,
    ti.email,
    ti.nome,
    ti.role,
    ti.status,
    ti.expires_at,
    ti.barbeiro_id,
    bb.nome as barbeiro_nome
  from public.team_invites ti
  join public.barbearias b on b.id = ti.barbearia_id
  left join public.barbeiros bb on bb.id = ti.barbeiro_id and bb.barbearia_id = ti.barbearia_id
  where ti.token = v_token
  limit 1;
end;
$$;

create or replace function public.rpc_accept_team_invite(
  p_token text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_auth_email text;
  v_token text := trim(coalesce(p_token, ''));
  v_invite public.team_invites%rowtype;
begin
  if v_auth_user_id is null then
    raise exception 'Login necessario.';
  end if;

  select lower(email)
    into v_auth_email
  from auth.users
  where id = v_auth_user_id;

  select *
    into v_invite
  from public.team_invites
  where token = v_token
  for update;

  if v_invite.id is null then
    raise exception 'Convite invalido.';
  end if;

  if v_invite.status <> 'pending' then
    raise exception 'Convite indisponivel.';
  end if;

  if v_invite.expires_at <= now() then
    update public.team_invites
    set status = 'expired'
    where id = v_invite.id;
    raise exception 'Convite expirado.';
  end if;

  if lower(v_invite.email) <> v_auth_email then
    raise exception 'Este convite foi enviado para outro email.';
  end if;

  if v_invite.role = 'barbeiro' then
    if v_invite.barbeiro_id is null then
      raise exception 'Este convite nao esta vinculado a um barbeiro.';
    end if;

    if not exists (
      select 1
      from public.barbeiros b
      where b.id = v_invite.barbeiro_id
        and b.barbearia_id = v_invite.barbearia_id
        and coalesce(b.ativo, true) = true
    ) then
      raise exception 'O barbeiro vinculado a este convite esta indisponivel.';
    end if;
  end if;

  insert into public.profiles (
    id,
    barbearia_id,
    barbeiro_id,
    full_name,
    role
  )
  values (
    v_auth_user_id,
    v_invite.barbearia_id,
    case when v_invite.role = 'barbeiro' then v_invite.barbeiro_id else null end,
    coalesce(v_invite.nome, split_part(v_auth_email, '@', 1)),
    v_invite.role
  )
  on conflict (id) do update
  set barbearia_id = excluded.barbearia_id,
      barbeiro_id = excluded.barbeiro_id,
      full_name = coalesce(nullif(public.profiles.full_name, ''), excluded.full_name),
      role = excluded.role;

  update public.team_invites
  set status = 'accepted',
      accepted_by = v_auth_user_id,
      accepted_at = now()
  where id = v_invite.id;

  return jsonb_build_object(
    'success', true,
    'barbearia_id', v_invite.barbearia_id,
    'barbeiro_id', v_invite.barbeiro_id,
    'role', v_invite.role
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

  select id, barbearia_id, role, barbeiro_id
  into v_profile
  from public.profiles
  where id = auth.uid()
  limit 1;

  if v_profile.id is null or v_profile.barbearia_id is null then
    return jsonb_build_object('success', false, 'message', 'Perfil profissional invalido.');
  end if;

  if coalesce(v_profile.role, '') = 'barbeiro' and v_profile.barbeiro_id is null then
    return jsonb_build_object('success', false, 'message', 'Seu acesso profissional ainda nao esta vinculado a um barbeiro.');
  end if;

  select *
  into v_agendamento
  from public.agendamentos
  where id = p_agendamento_id
    and barbearia_id = v_profile.barbearia_id
    and (
      coalesce(v_profile.role, '') in ('owner', 'proprietario', 'admin', 'gerente', 'funcionario')
      or (coalesce(v_profile.role, '') = 'barbeiro' and barbeiro_id = v_profile.barbeiro_id)
      or public.current_user_is_platform_admin()
    )
  for update;

  if v_agendamento.id is null then
    return jsonb_build_object('success', false, 'message', 'Agendamento nao encontrado para o seu acesso.');
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
    and a.status in ('aceito', 'confirmado', 'concluido', 'realizado', 'atendido')
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
      and (
        coalesce(p.role, '') in ('owner', 'proprietario', 'admin', 'gerente', 'funcionario')
        or (coalesce(p.role, '') = 'barbeiro' and p.barbeiro_id = agendamentos.barbeiro_id)
      )
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
      and (
        coalesce(p.role, '') in ('owner', 'proprietario', 'admin', 'gerente', 'funcionario')
        or (coalesce(p.role, '') = 'barbeiro' and p.barbeiro_id = agendamentos.barbeiro_id)
      )
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
      and (
        coalesce(p.role, '') in ('owner', 'proprietario', 'admin', 'gerente', 'funcionario')
        or (coalesce(p.role, '') = 'barbeiro' and p.barbeiro_id = agendamentos.barbeiro_id)
      )
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.barbearia_id = agendamentos.barbearia_id
      and (
        coalesce(p.role, '') in ('owner', 'proprietario', 'admin', 'gerente', 'funcionario')
        or (coalesce(p.role, '') = 'barbeiro' and p.barbeiro_id = agendamentos.barbeiro_id)
      )
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
      and (
        coalesce(p.role, '') in ('owner', 'proprietario', 'admin', 'gerente', 'funcionario')
        or (coalesce(p.role, '') = 'barbeiro' and p.barbeiro_id = agendamentos.barbeiro_id)
      )
  )
);

do $$
declare
  v_policy record;
begin
  for v_policy in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'bloqueios'
      and policyname <> 'platform_admin_all_bloqueios'
  loop
    execute format('drop policy if exists %I on public.bloqueios', v_policy.policyname);
  end loop;
end $$;

create policy "bloqueios_select_profissional"
on public.bloqueios
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.barbearia_id = bloqueios.barbearia_id
      and (
        coalesce(p.role, '') in ('owner', 'proprietario', 'admin', 'gerente', 'funcionario')
        or (coalesce(p.role, '') = 'barbeiro' and p.barbeiro_id = bloqueios.barbeiro_id)
      )
  )
);

create policy "bloqueios_insert_profissional"
on public.bloqueios
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.barbearia_id = bloqueios.barbearia_id
      and (
        coalesce(p.role, '') in ('owner', 'proprietario', 'admin', 'gerente', 'funcionario')
        or (coalesce(p.role, '') = 'barbeiro' and p.barbeiro_id = bloqueios.barbeiro_id)
      )
  )
);

create policy "bloqueios_update_profissional"
on public.bloqueios
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.barbearia_id = bloqueios.barbearia_id
      and (
        coalesce(p.role, '') in ('owner', 'proprietario', 'admin', 'gerente', 'funcionario')
        or (coalesce(p.role, '') = 'barbeiro' and p.barbeiro_id = bloqueios.barbeiro_id)
      )
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.barbearia_id = bloqueios.barbearia_id
      and (
        coalesce(p.role, '') in ('owner', 'proprietario', 'admin', 'gerente', 'funcionario')
        or (coalesce(p.role, '') = 'barbeiro' and p.barbeiro_id = bloqueios.barbeiro_id)
      )
  )
);

create policy "bloqueios_delete_profissional"
on public.bloqueios
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.barbearia_id = bloqueios.barbearia_id
      and (
        coalesce(p.role, '') in ('owner', 'proprietario', 'admin', 'gerente', 'funcionario')
        or (coalesce(p.role, '') = 'barbeiro' and p.barbeiro_id = bloqueios.barbeiro_id)
      )
  )
);

do $$
declare
  v_policy record;
begin
  for v_policy in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'barbeiros'
      and policyname not in ('platform_admin_all_barbeiros', 'anon_select_barbeiros', 'anon_select_barbeiros_ativos')
  loop
    execute format('drop policy if exists %I on public.barbeiros', v_policy.policyname);
  end loop;
end $$;

create policy "barbeiros_select_profissional"
on public.barbeiros
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.barbearia_id = barbeiros.barbearia_id
      and (
        coalesce(p.role, '') in ('owner', 'proprietario', 'admin', 'gerente', 'funcionario')
        or (coalesce(p.role, '') = 'barbeiro' and p.barbeiro_id = barbeiros.id)
      )
  )
);

create policy "barbeiros_insert_admin"
on public.barbeiros
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.barbearia_id = barbeiros.barbearia_id
      and coalesce(p.role, '') in ('owner', 'proprietario', 'admin', 'gerente')
  )
);

create policy "barbeiros_update_admin"
on public.barbeiros
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.barbearia_id = barbeiros.barbearia_id
      and coalesce(p.role, '') in ('owner', 'proprietario', 'admin', 'gerente')
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.barbearia_id = barbeiros.barbearia_id
      and coalesce(p.role, '') in ('owner', 'proprietario', 'admin', 'gerente')
  )
);

create policy "barbeiros_delete_admin"
on public.barbeiros
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.barbearia_id = barbeiros.barbearia_id
      and coalesce(p.role, '') in ('owner', 'proprietario', 'admin', 'gerente')
  )
);

drop policy if exists "membros_ver_clientes" on public.clientes;

create policy "membros_ver_clientes"
on public.clientes
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.barbearia_id = clientes.barbearia_id
      and coalesce(p.role, '') in ('owner', 'proprietario', 'admin', 'gerente', 'funcionario')
  )
);

drop policy if exists "transacoes_barbeiro_select_own" on public.transacoes;
create policy "transacoes_barbeiro_select_own"
on public.transacoes
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'barbeiro'
      and p.barbearia_id = transacoes.barbearia_id
      and p.barbeiro_id = transacoes.barbeiro_id
  )
);

drop policy if exists "caixinhas_barbeiro_select_own" on public.caixinhas;
create policy "caixinhas_barbeiro_select_own"
on public.caixinhas
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'barbeiro'
      and p.barbearia_id = caixinhas.barbearia_id
      and p.barbeiro_id = caixinhas.barbeiro_id
  )
);

drop policy if exists "venda_produtos_barbeiro_select_own" on public.venda_produtos;
create policy "venda_produtos_barbeiro_select_own"
on public.venda_produtos
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'barbeiro'
      and p.barbearia_id = venda_produtos.barbearia_id
      and p.barbeiro_id = venda_produtos.barbeiro_id
  )
);

create or replace function public.rpc_barbeiro_atualizar_meu_perfil(
  p_foto_url text default null,
  p_telefone text default null,
  p_titulo text default null,
  p_especialidade text default null,
  p_tags text[] default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile record;
begin
  if auth.uid() is null then
    raise exception 'Login necessario.';
  end if;

  select id, role, barbearia_id, barbeiro_id
    into v_profile
  from public.profiles
  where id = auth.uid();

  if v_profile.id is null
    or v_profile.role <> 'barbeiro'
    or v_profile.barbearia_id is null
    or v_profile.barbeiro_id is null then
    raise exception 'Perfil de barbeiro invalido.';
  end if;

  update public.barbeiros
  set foto_url = nullif(trim(coalesce(p_foto_url, '')), ''),
      telefone = nullif(trim(coalesce(p_telefone, '')), ''),
      titulo = nullif(trim(coalesce(p_titulo, '')), ''),
      especialidade = nullif(trim(coalesce(p_especialidade, '')), ''),
      tags = coalesce(p_tags, tags)
  where id = v_profile.barbeiro_id
    and barbearia_id = v_profile.barbearia_id;

  return jsonb_build_object('success', true, 'barbeiro_id', v_profile.barbeiro_id);
end;
$$;

revoke all on function public.rpc_create_team_invite(text, text, text, text, uuid) from public;
revoke all on function public.rpc_get_team_invite_by_token(text) from public;
revoke all on function public.rpc_accept_team_invite(text) from public;
revoke all on function public.rpc_profissional_responder_agendamento(uuid, text, text) from public;
revoke all on function public.rpc_barbeiro_atualizar_meu_perfil(text, text, text, text, text[]) from public;

grant execute on function public.rpc_create_team_invite(text, text, text, text, uuid) to authenticated;
grant execute on function public.rpc_get_team_invite_by_token(text) to anon, authenticated;
grant execute on function public.rpc_accept_team_invite(text) to authenticated;
grant execute on function public.rpc_profissional_responder_agendamento(uuid, text, text) to authenticated;
grant execute on function public.rpc_barbeiro_atualizar_meu_perfil(text, text, text, text, text[]) to authenticated;
