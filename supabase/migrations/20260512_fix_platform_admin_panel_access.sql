-- Fix profile-policy recursion and allow platform admins to operate the professional panel.
-- Platform admins remain special users; public signup still cannot create professional/platform accounts.

create or replace function public.is_admin_role(p_role text)
returns boolean
language sql
stable
as $$
  select coalesce(p_role, '') in ('owner', 'admin', 'proprietario', 'platform_admin', 'super_admin')
$$;

create or replace function public.is_professional_role(p_role text)
returns boolean
language sql
stable
as $$
  select coalesce(p_role, '') in ('owner', 'admin', 'proprietario', 'barbeiro', 'funcionario', 'gerente')
$$;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
  limit 1
$$;

create or replace function public.current_user_barbearia_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.barbearia_id
  from public.profiles p
  where p.id = auth.uid()
  limit 1
$$;

create or replace function public.current_user_is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_platform_admin_role(public.current_user_role())
$$;

create or replace function public.current_user_is_barbearia_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_admin_role(public.current_user_role())
$$;

revoke all on function public.current_user_role() from public;
revoke all on function public.current_user_barbearia_id() from public;
revoke all on function public.current_user_is_platform_admin() from public;
revoke all on function public.current_user_is_barbearia_admin() from public;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.current_user_barbearia_id() to authenticated;
grant execute on function public.current_user_is_platform_admin() to authenticated;
grant execute on function public.current_user_is_barbearia_admin() to authenticated;

drop policy if exists "profiles_select_self_or_same_barbearia_admin" on public.profiles;
drop policy if exists "profiles_admin_insert_same_barbearia" on public.profiles;
drop policy if exists "profiles_admin_update_same_barbearia" on public.profiles;
drop policy if exists "profiles_platform_select_all" on public.profiles;
drop policy if exists "profiles_select_self_admin_or_platform" on public.profiles;

create policy "profiles_select_self_admin_or_platform"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or public.current_user_is_platform_admin()
  or (
    public.current_user_is_barbearia_admin()
    and public.current_user_barbearia_id() is not null
    and barbearia_id = public.current_user_barbearia_id()
  )
);

create policy "profiles_admin_insert_same_barbearia"
on public.profiles
for insert
to authenticated
with check (
  public.is_professional_role(role)
  and barbearia_id is not null
  and (
    public.current_user_is_platform_admin()
    or (
      public.current_user_is_barbearia_admin()
      and barbearia_id = public.current_user_barbearia_id()
    )
  )
);

create policy "profiles_admin_update_same_barbearia"
on public.profiles
for update
to authenticated
using (
  public.current_user_is_platform_admin()
  or (
    public.current_user_is_barbearia_admin()
    and public.current_user_barbearia_id() is not null
    and barbearia_id = public.current_user_barbearia_id()
  )
)
with check (
  public.is_professional_role(role)
  and barbearia_id is not null
  and (
    public.current_user_is_platform_admin()
    or (
      public.current_user_is_barbearia_admin()
      and barbearia_id = public.current_user_barbearia_id()
    )
  )
);

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'agendamentos',
    'avaliacoes',
    'barbearia_fotos',
    'barbeiros',
    'bloqueios',
    'caixa_sessoes',
    'caixinhas',
    'cliente_accounts',
    'clientes',
    'despesas',
    'horarios_funcionamento',
    'produtos',
    'servico_categorias',
    'servicos',
    'team_invites',
    'transacoes',
    'venda_produtos'
  ] loop
    if to_regclass(format('public.%I', v_table)) is not null then
      execute format('drop policy if exists %I on public.%I', 'platform_admin_all_' || v_table, v_table);
      execute format(
        'create policy %I on public.%I for all to authenticated using (public.current_user_is_platform_admin()) with check (public.current_user_is_platform_admin())',
        'platform_admin_all_' || v_table,
        v_table
      );
    end if;
  end loop;
end $$;

drop policy if exists "platform_admin_all_barbearias" on public.barbearias;
create policy "platform_admin_all_barbearias"
on public.barbearias
for all
to authenticated
using (public.current_user_is_platform_admin())
with check (public.current_user_is_platform_admin());

drop policy if exists "platform_admin_all_transacao_pagamentos" on public.transacao_pagamentos;
create policy "platform_admin_all_transacao_pagamentos"
on public.transacao_pagamentos
for all
to authenticated
using (public.current_user_is_platform_admin())
with check (public.current_user_is_platform_admin());

update public.profiles p
set role = 'platform_admin',
    barbearia_id = 'a251aedd-347a-466a-a26a-4b53d394f7ae'
from auth.users u
where p.id = u.id
  and lower(u.email) = 'alin.tyga@gmail.com';
