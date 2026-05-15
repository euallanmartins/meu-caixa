-- Secure team invitation flow.
-- Professional accounts are provisioned only by owner/admin/proprietario invites.

create extension if not exists pgcrypto;

create table if not exists public.team_invites (
  id uuid primary key default gen_random_uuid(),
  barbearia_id uuid not null references public.barbearias(id) on delete cascade,
  invited_by uuid not null references auth.users(id) on delete cascade,
  email text not null,
  nome text,
  telefone text,
  role text not null,
  token text not null unique,
  status text not null default 'pending',
  expires_at timestamptz not null,
  accepted_by uuid references auth.users(id),
  accepted_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint team_invites_role_check check (role in ('owner', 'admin', 'proprietario', 'barbeiro', 'funcionario', 'gerente')),
  constraint team_invites_status_check check (status in ('pending', 'accepted', 'expired', 'cancelled')),
  constraint team_invites_email_check check (position('@' in email) > 1)
);

create index if not exists idx_team_invites_token on public.team_invites(token);
create index if not exists idx_team_invites_barbearia_id on public.team_invites(barbearia_id);
create index if not exists idx_team_invites_email on public.team_invites(lower(email));
create index if not exists idx_team_invites_status on public.team_invites(status);

alter table public.team_invites enable row level security;

create or replace function public.touch_team_invites_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_team_invites_updated_at on public.team_invites;
create trigger trg_team_invites_updated_at
before update on public.team_invites
for each row execute function public.touch_team_invites_updated_at();

drop policy if exists "team_invites_admin_select_same_barbearia" on public.team_invites;
drop policy if exists "team_invites_admin_insert_same_barbearia" on public.team_invites;
drop policy if exists "team_invites_admin_cancel_same_barbearia" on public.team_invites;

create policy "team_invites_admin_select_same_barbearia"
on public.team_invites
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and public.is_admin_role(p.role)
      and p.barbearia_id = team_invites.barbearia_id
  )
);

create policy "team_invites_admin_insert_same_barbearia"
on public.team_invites
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and public.is_admin_role(p.role)
      and p.barbearia_id = team_invites.barbearia_id
  )
);

create policy "team_invites_admin_cancel_same_barbearia"
on public.team_invites
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and public.is_admin_role(p.role)
      and p.barbearia_id = team_invites.barbearia_id
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and public.is_admin_role(p.role)
      and p.barbearia_id = team_invites.barbearia_id
  )
);

create or replace function public.rpc_create_team_invite(
  p_email text,
  p_nome text default null,
  p_telefone text default null,
  p_role text default 'barbeiro'
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
  created_at timestamptz
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
    expires_at
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
    now() + interval '7 days'
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
    v_invite.created_at;
end;
$$;

create or replace function public.rpc_get_team_invite_by_token(
  p_token text
) returns table (
  barbearia_nome text,
  email text,
  nome text,
  role text,
  status text,
  expires_at timestamptz
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
    ti.expires_at
  from public.team_invites ti
  join public.barbearias b on b.id = ti.barbearia_id
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

  insert into public.profiles (
    id,
    barbearia_id,
    full_name,
    role
  )
  values (
    v_auth_user_id,
    v_invite.barbearia_id,
    coalesce(v_invite.nome, split_part(v_auth_email, '@', 1)),
    v_invite.role
  )
  on conflict (id) do update
  set barbearia_id = excluded.barbearia_id,
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
    'role', v_invite.role
  );
end;
$$;

create or replace function public.rpc_cancel_team_invite(
  p_invite_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile record;
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
    raise exception 'Voce nao tem permissao para cancelar convites.';
  end if;

  select *
    into v_invite
  from public.team_invites
  where id = p_invite_id
  for update;

  if v_invite.id is null or v_invite.barbearia_id <> v_profile.barbearia_id then
    raise exception 'Convite nao encontrado.';
  end if;

  if v_invite.status <> 'pending' then
    return jsonb_build_object('success', true, 'status', v_invite.status);
  end if;

  update public.team_invites
  set status = 'cancelled',
      cancelled_at = now()
  where id = v_invite.id;

  return jsonb_build_object('success', true, 'status', 'cancelled');
end;
$$;

revoke all on function public.rpc_create_team_invite(text, text, text, text) from public;
revoke all on function public.rpc_get_team_invite_by_token(text) from public;
revoke all on function public.rpc_accept_team_invite(text) from public;
revoke all on function public.rpc_cancel_team_invite(uuid) from public;

grant execute on function public.rpc_create_team_invite(text, text, text, text) to authenticated;
grant execute on function public.rpc_get_team_invite_by_token(text) to anon, authenticated;
grant execute on function public.rpc_accept_team_invite(text) to authenticated;
grant execute on function public.rpc_cancel_team_invite(uuid) to authenticated;
