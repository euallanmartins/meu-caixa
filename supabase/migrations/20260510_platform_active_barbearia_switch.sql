-- Platform admins can choose which barbearia they are managing in the professional panel.

create or replace function public.rpc_platform_set_active_barbearia(
  p_barbearia_id uuid
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

  if not exists (select 1 from public.barbearias b where b.id = p_barbearia_id) then
    raise exception 'Barbearia invalida.';
  end if;

  update public.profiles
  set barbearia_id = p_barbearia_id
  where id = v_auth_user_id;

  return jsonb_build_object('success', true, 'barbearia_id', p_barbearia_id);
end;
$$;

revoke all on function public.rpc_platform_set_active_barbearia(uuid) from public;
grant execute on function public.rpc_platform_set_active_barbearia(uuid) to authenticated;

update public.profiles p
set barbearia_id = 'a251aedd-347a-466a-a26a-4b53d394f7ae'
from auth.users u
where p.id = u.id
  and lower(u.email) = 'alin.tyga@gmail.com'
  and public.is_platform_admin_role(p.role);
