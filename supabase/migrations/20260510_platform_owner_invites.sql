-- Platform-admin owner onboarding flow.

create extension if not exists pgcrypto;

create or replace function public.is_platform_admin_role(p_role text)
returns boolean
language sql
stable
as $$
  select coalesce(p_role, '') in ('platform_admin', 'super_admin')
$$;

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in (
    'platform_admin',
    'super_admin',
    'owner',
    'admin',
    'proprietario',
    'barbeiro',
    'funcionario',
    'gerente',
    'free'
  ));

alter table public.barbearias
  add column if not exists status text not null default 'pending_setup',
  add column if not exists plan_name text,
  add column if not exists created_by uuid references auth.users(id);

update public.barbearias
set status = 'active'
where coalesce(ativo, true) = true
  and status = 'pending_setup';

alter table public.barbearias
  drop constraint if exists barbearias_status_check;

alter table public.barbearias
  add constraint barbearias_status_check
  check (status in ('pending_setup', 'pending_approval', 'active', 'suspended', 'inactive'));

create table if not exists public.platform_owner_invites (
  id uuid primary key default gen_random_uuid(),
  invited_by uuid not null references auth.users(id) on delete cascade,
  owner_name text,
  owner_email text not null,
  owner_phone text,
  barbearia_name text not null,
  plan_name text,
  internal_notes text,
  token text not null unique,
  status text not null default 'pending',
  expires_at timestamptz not null,
  accepted_by uuid references auth.users(id),
  accepted_at timestamptz,
  created_barbearia_id uuid references public.barbearias(id),
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_owner_invites_status_check check (status in ('pending', 'accepted', 'expired', 'cancelled')),
  constraint platform_owner_invites_email_check check (position('@' in owner_email) > 1)
);

create index if not exists idx_platform_owner_invites_token on public.platform_owner_invites(token);
create index if not exists idx_platform_owner_invites_owner_email on public.platform_owner_invites(lower(owner_email));
create index if not exists idx_platform_owner_invites_status on public.platform_owner_invites(status);
create index if not exists idx_platform_owner_invites_created_barbearia_id on public.platform_owner_invites(created_barbearia_id);

alter table public.platform_owner_invites enable row level security;

create or replace function public.touch_platform_owner_invites_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_platform_owner_invites_updated_at on public.platform_owner_invites;
create trigger trg_platform_owner_invites_updated_at
before update on public.platform_owner_invites
for each row execute function public.touch_platform_owner_invites_updated_at();

drop policy if exists "platform_owner_invites_platform_select" on public.platform_owner_invites;
drop policy if exists "platform_owner_invites_platform_insert" on public.platform_owner_invites;

create policy "platform_owner_invites_platform_select"
on public.platform_owner_invites
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and public.is_platform_admin_role(p.role)
  )
);

create policy "platform_owner_invites_platform_insert"
on public.platform_owner_invites
for insert
to authenticated
with check (
  invited_by = auth.uid()
  and status = 'pending'
  and accepted_by is null
  and accepted_at is null
  and cancelled_at is null
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and public.is_platform_admin_role(p.role)
  )
);

drop policy if exists "anon_select_barbearias" on public.barbearias;
drop policy if exists "anon_select_barbearias_ativas" on public.barbearias;
drop policy if exists "platform_select_all_barbearias" on public.barbearias;

create policy "anon_select_barbearias_ativas"
on public.barbearias
for select
to anon
using (coalesce(ativo, true) = true and status = 'active');

create policy "platform_select_all_barbearias"
on public.barbearias
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and public.is_platform_admin_role(p.role)
  )
);

create or replace function public.prevent_non_platform_barbearia_status_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text;
begin
  if old.status is distinct from new.status then
    select role into v_role
    from public.profiles
    where id = auth.uid();

    if not public.is_platform_admin_role(v_role) then
      raise exception 'Apenas administradores da plataforma podem alterar status da barbearia.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_non_platform_barbearia_status_change on public.barbearias;
create trigger trg_prevent_non_platform_barbearia_status_change
before update of status on public.barbearias
for each row execute function public.prevent_non_platform_barbearia_status_change();

create or replace function public.rpc_create_platform_owner_invite(
  p_owner_name text,
  p_owner_email text,
  p_owner_phone text default null,
  p_barbearia_name text default null,
  p_plan_name text default null,
  p_internal_notes text default null
) returns table (
  invite_id uuid,
  token text,
  owner_email text,
  barbearia_name text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile record;
  v_email text := lower(trim(coalesce(p_owner_email, '')));
  v_barbearia_name text := nullif(trim(coalesce(p_barbearia_name, '')), '');
  v_token text;
  v_invite public.platform_owner_invites%rowtype;
begin
  if v_auth_user_id is null then
    raise exception 'Login necessario.';
  end if;

  select id, role
    into v_profile
  from public.profiles
  where id = v_auth_user_id;

  if v_profile.id is null or not public.is_platform_admin_role(v_profile.role) then
    raise exception 'Acesso restrito ao admin da plataforma.';
  end if;

  if v_email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' then
    raise exception 'E-mail invalido.';
  end if;

  if v_barbearia_name is null then
    raise exception 'Informe o nome da barbearia.';
  end if;

  update public.platform_owner_invites
  set status = 'expired'
  where status = 'pending'
    and expires_at <= now();

  v_token := encode(gen_random_bytes(32), 'hex');

  insert into public.platform_owner_invites (
    invited_by,
    owner_name,
    owner_email,
    owner_phone,
    barbearia_name,
    plan_name,
    internal_notes,
    token,
    status,
    expires_at
  )
  values (
    v_auth_user_id,
    nullif(trim(coalesce(p_owner_name, '')), ''),
    v_email,
    nullif(trim(coalesce(p_owner_phone, '')), ''),
    v_barbearia_name,
    nullif(trim(coalesce(p_plan_name, '')), ''),
    nullif(trim(coalesce(p_internal_notes, '')), ''),
    v_token,
    'pending',
    now() + interval '7 days'
  )
  returning * into v_invite;

  return query
  select
    v_invite.id,
    v_invite.token,
    v_invite.owner_email,
    v_invite.barbearia_name,
    v_invite.expires_at;
end;
$$;

create or replace function public.rpc_get_platform_owner_invite_by_token(
  p_token text
) returns table (
  barbearia_name text,
  owner_email text,
  owner_name text,
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
  update public.platform_owner_invites
  set status = 'expired'
  where token = v_token
    and status = 'pending'
    and expires_at <= now();

  return query
  select
    poi.barbearia_name,
    poi.owner_email,
    poi.owner_name,
    poi.status,
    poi.expires_at
  from public.platform_owner_invites poi
  where poi.token = v_token
  limit 1;
end;
$$;

create or replace function public.rpc_accept_platform_owner_invite(
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
  v_invite public.platform_owner_invites%rowtype;
  v_barbearia_id uuid;
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
  from public.platform_owner_invites
  where token = v_token
  for update;

  if v_invite.id is null then
    raise exception 'Convite invalido.';
  end if;

  if v_invite.status <> 'pending' then
    raise exception 'Convite indisponivel.';
  end if;

  if v_invite.expires_at <= now() then
    update public.platform_owner_invites
    set status = 'expired'
    where id = v_invite.id;
    raise exception 'Convite expirado.';
  end if;

  if lower(v_invite.owner_email) <> v_auth_email then
    raise exception 'Este convite foi enviado para outro email.';
  end if;

  insert into public.barbearias (
    nome,
    proprietario_id,
    created_by,
    status,
    ativo,
    telefone,
    plan_name
  )
  values (
    v_invite.barbearia_name,
    v_auth_user_id,
    v_auth_user_id,
    'pending_setup',
    false,
    v_invite.owner_phone,
    v_invite.plan_name
  )
  returning id into v_barbearia_id;

  insert into public.profiles (
    id,
    barbearia_id,
    full_name,
    role
  )
  values (
    v_auth_user_id,
    v_barbearia_id,
    coalesce(v_invite.owner_name, split_part(v_auth_email, '@', 1)),
    'proprietario'
  )
  on conflict (id) do update
  set barbearia_id = excluded.barbearia_id,
      full_name = coalesce(nullif(public.profiles.full_name, ''), excluded.full_name),
      role = 'proprietario';

  update public.platform_owner_invites
  set status = 'accepted',
      accepted_by = v_auth_user_id,
      accepted_at = now(),
      created_barbearia_id = v_barbearia_id
  where id = v_invite.id;

  return jsonb_build_object('success', true, 'barbearia_id', v_barbearia_id, 'role', 'proprietario');
end;
$$;

create or replace function public.rpc_cancel_platform_owner_invite(
  p_invite_id uuid
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

  select id, role
    into v_profile
  from public.profiles
  where id = v_auth_user_id;

  if v_profile.id is null or not public.is_platform_admin_role(v_profile.role) then
    raise exception 'Acesso restrito ao admin da plataforma.';
  end if;

  update public.platform_owner_invites
  set status = 'cancelled',
      cancelled_at = now()
  where id = p_invite_id
    and status = 'pending';

  return jsonb_build_object('success', true);
end;
$$;

create or replace function public.rpc_set_barbearia_status(
  p_barbearia_id uuid,
  p_status text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile record;
  v_status text := lower(trim(coalesce(p_status, '')));
begin
  if v_auth_user_id is null then
    raise exception 'Login necessario.';
  end if;

  select id, role
    into v_profile
  from public.profiles
  where id = v_auth_user_id;

  if v_profile.id is null or not public.is_platform_admin_role(v_profile.role) then
    raise exception 'Acesso restrito ao admin da plataforma.';
  end if;

  if v_status not in ('pending_setup', 'pending_approval', 'active', 'suspended', 'inactive') then
    raise exception 'Status invalido.';
  end if;

  update public.barbearias
  set status = v_status,
      ativo = (v_status = 'active')
  where id = p_barbearia_id;

  return jsonb_build_object('success', true, 'status', v_status);
end;
$$;

insert into public.profiles (id, role, full_name, barbearia_id)
select u.id, 'platform_admin', coalesce(u.raw_user_meta_data->>'full_name', 'Alin Tyga'), null
from auth.users u
where lower(u.email) = 'alin.tyga@gmail.com'
on conflict (id) do update
set role = 'platform_admin',
    barbearia_id = null,
    full_name = coalesce(nullif(public.profiles.full_name, ''), excluded.full_name);

revoke all on function public.rpc_create_platform_owner_invite(text, text, text, text, text, text) from public;
revoke all on function public.rpc_get_platform_owner_invite_by_token(text) from public;
revoke all on function public.rpc_accept_platform_owner_invite(text) from public;
revoke all on function public.rpc_cancel_platform_owner_invite(uuid) from public;
revoke all on function public.rpc_set_barbearia_status(uuid, text) from public;

grant execute on function public.rpc_create_platform_owner_invite(text, text, text, text, text, text) to authenticated;
grant execute on function public.rpc_get_platform_owner_invite_by_token(text) to anon, authenticated;
grant execute on function public.rpc_accept_platform_owner_invite(text) to authenticated;
grant execute on function public.rpc_cancel_platform_owner_invite(uuid) to authenticated;
grant execute on function public.rpc_set_barbearia_status(uuid, text) to authenticated;
