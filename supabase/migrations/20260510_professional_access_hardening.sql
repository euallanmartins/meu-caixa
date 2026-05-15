-- Prevent public signups from becoming professional accounts.
-- Public auth signups may create/link cliente_accounts only.
-- Professional profiles must be created by an owner/admin workflow.

create or replace function public.is_professional_role(p_role text)
returns boolean
language sql
stable
as $$
  select coalesce(p_role, '') in ('owner', 'admin', 'proprietario', 'barbeiro', 'funcionario', 'gerente')
$$;

create or replace function public.is_admin_role(p_role text)
returns boolean
language sql
stable
as $$
  select coalesce(p_role, '') in ('owner', 'admin', 'proprietario')
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_barbearia_id uuid;
  v_cliente_id uuid;
begin
  if new.raw_user_meta_data->>'account_type' = 'cliente' then
    v_barbearia_id := nullif(new.raw_user_meta_data->>'barbearia_id', '')::uuid;
    v_cliente_id := nullif(new.raw_user_meta_data->>'cliente_id', '')::uuid;

    if v_barbearia_id is not null and v_cliente_id is not null then
      if not exists (
        select 1
        from public.clientes c
        where c.id = v_cliente_id
          and c.barbearia_id = v_barbearia_id
          and lower(c.email) = lower(new.email)
      ) then
        raise exception 'Dados de cliente invalidos para criar conta.';
      end if;

      insert into public.cliente_accounts (auth_user_id, cliente_id, barbearia_id)
      values (new.id, v_cliente_id, v_barbearia_id)
      on conflict (auth_user_id, barbearia_id) do update
      set cliente_id = excluded.cliente_id;
    end if;
  end if;

  -- Never create barbearias/professional profiles from public signup metadata.
  -- Owner/admin/barber/employee accounts must be provisioned by a trusted admin flow.
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('owner', 'admin', 'proprietario', 'barbeiro', 'funcionario', 'gerente', 'free'));

alter table public.profiles
  alter column role set default 'free';

do $$
declare
  v_policy record;
begin
  for v_policy in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
  loop
    execute format('drop policy if exists %I on public.profiles', v_policy.policyname);
  end loop;
end;
$$;

create policy "profiles_select_self_or_same_barbearia_admin"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and public.is_admin_role(p.role)
      and p.barbearia_id is not null
      and p.barbearia_id = profiles.barbearia_id
  )
);

create policy "profiles_admin_insert_same_barbearia"
on public.profiles
for insert
to authenticated
with check (
  public.is_professional_role(role)
  and barbearia_id is not null
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and public.is_admin_role(p.role)
      and p.barbearia_id = profiles.barbearia_id
  )
);

create policy "profiles_admin_update_same_barbearia"
on public.profiles
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and public.is_admin_role(p.role)
      and p.barbearia_id = profiles.barbearia_id
  )
)
with check (
  public.is_professional_role(role)
  and barbearia_id is not null
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and public.is_admin_role(p.role)
      and p.barbearia_id = profiles.barbearia_id
  )
);
