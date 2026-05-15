-- Expo Push Notifications support.
-- Tokens are scoped to auth users and optionally to the active barbearia/barbeiro/cliente.

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  barbearia_id uuid null references public.barbearias(id) on delete cascade,
  barbeiro_id uuid null references public.barbeiros(id) on delete set null,
  cliente_id uuid null references public.clientes(id) on delete set null,
  expo_push_token text not null,
  device_id text null,
  platform text null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_tokens_user_token_unique unique (user_id, expo_push_token),
  constraint push_tokens_token_not_empty check (length(trim(expo_push_token)) > 0)
);

create index if not exists idx_push_tokens_user_active
  on public.push_tokens (user_id, is_active);

create index if not exists idx_push_tokens_barbearia_barbeiro_active
  on public.push_tokens (barbearia_id, barbeiro_id, is_active);

create index if not exists idx_push_tokens_cliente_active
  on public.push_tokens (cliente_id, is_active);

create index if not exists idx_push_tokens_token_active
  on public.push_tokens (expo_push_token, is_active);

create or replace function public.set_push_tokens_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_push_tokens_updated_at on public.push_tokens;
create trigger set_push_tokens_updated_at
  before update on public.push_tokens
  for each row execute function public.set_push_tokens_updated_at();

alter table public.push_tokens enable row level security;

grant select, insert, update, delete on public.push_tokens to authenticated;

drop policy if exists "push_tokens_select_own_or_tenant" on public.push_tokens;
drop policy if exists "push_tokens_insert_own" on public.push_tokens;
drop policy if exists "push_tokens_update_own" on public.push_tokens;
drop policy if exists "push_tokens_delete_own" on public.push_tokens;

create policy "push_tokens_select_own_or_tenant"
on public.push_tokens
for select
to authenticated
using (
  user_id = auth.uid()
  or public.current_user_is_platform_admin()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.barbearia_id = push_tokens.barbearia_id
      and (
        coalesce(p.role, '') in ('owner', 'proprietario', 'admin', 'gerente')
        or (coalesce(p.role, '') = 'barbeiro' and p.barbeiro_id = push_tokens.barbeiro_id)
      )
  )
);

create policy "push_tokens_insert_own"
on public.push_tokens
for insert
to authenticated
with check (user_id = auth.uid());

create policy "push_tokens_update_own"
on public.push_tokens
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "push_tokens_delete_own"
on public.push_tokens
for delete
to authenticated
using (user_id = auth.uid());

create or replace function public.rpc_register_expo_push_token(
  p_expo_push_token text,
  p_device_id text default null,
  p_platform text default null,
  p_barbearia_id uuid default null,
  p_barbeiro_id uuid default null,
  p_cliente_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile record;
  v_cliente_account record;
  v_expo_push_token text := trim(coalesce(p_expo_push_token, ''));
  v_barbearia_id uuid := null;
  v_barbeiro_id uuid := null;
  v_cliente_id uuid := null;
  v_token_id uuid;
begin
  if v_auth_user_id is null then
    raise exception 'Login necessario.';
  end if;

  if v_expo_push_token = ''
     or v_expo_push_token !~ '^(ExponentPushToken|ExpoPushToken)\[[^]]+\]$' then
    raise exception 'Token Expo invalido.';
  end if;

  select id, role, barbearia_id, barbeiro_id
    into v_profile
  from public.profiles
  where id = v_auth_user_id
  limit 1;

  if v_profile.id is not null and v_profile.barbearia_id is not null then
    v_barbearia_id := v_profile.barbearia_id;

    if p_barbearia_id is not null and p_barbearia_id <> v_profile.barbearia_id then
      raise exception 'Barbearia invalida para este usuario.';
    end if;

    if coalesce(v_profile.role, '') = 'barbeiro' then
      if v_profile.barbeiro_id is null then
        raise exception 'Perfil de barbeiro sem vinculo profissional.';
      end if;

      if p_barbeiro_id is not null and p_barbeiro_id <> v_profile.barbeiro_id then
        raise exception 'Barbeiro invalido para este usuario.';
      end if;

      v_barbeiro_id := v_profile.barbeiro_id;
    end if;
  end if;

  if p_cliente_id is not null then
    select ca.auth_user_id, ca.cliente_id, ca.barbearia_id
      into v_cliente_account
    from public.cliente_accounts ca
    where ca.auth_user_id = v_auth_user_id
      and ca.cliente_id = p_cliente_id
      and (p_barbearia_id is null or ca.barbearia_id = p_barbearia_id)
    limit 1;

    if v_cliente_account.auth_user_id is null then
      raise exception 'Cliente invalido para este usuario.';
    end if;

    v_cliente_id := v_cliente_account.cliente_id;
    v_barbearia_id := coalesce(v_barbearia_id, v_cliente_account.barbearia_id);
  end if;

  insert into public.push_tokens (
    user_id,
    barbearia_id,
    barbeiro_id,
    cliente_id,
    expo_push_token,
    device_id,
    platform,
    is_active
  )
  values (
    v_auth_user_id,
    v_barbearia_id,
    v_barbeiro_id,
    v_cliente_id,
    v_expo_push_token,
    nullif(trim(coalesce(p_device_id, '')), ''),
    nullif(trim(coalesce(p_platform, '')), ''),
    true
  )
  on conflict (user_id, expo_push_token) do update
  set barbearia_id = excluded.barbearia_id,
      barbeiro_id = excluded.barbeiro_id,
      cliente_id = excluded.cliente_id,
      device_id = excluded.device_id,
      platform = excluded.platform,
      is_active = true
  returning id into v_token_id;

  return jsonb_build_object('success', true, 'id', v_token_id);
end;
$$;

revoke all on function public.rpc_register_expo_push_token(text, text, text, uuid, uuid, uuid) from public;
grant execute on function public.rpc_register_expo_push_token(text, text, text, uuid, uuid, uuid) to authenticated;
