-- Avoid recursive RLS on profiles when platform admins read dashboard data.

create or replace function public.current_user_is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and public.is_platform_admin_role(p.role)
  )
$$;

revoke all on function public.current_user_is_platform_admin() from public;
grant execute on function public.current_user_is_platform_admin() to authenticated;

drop policy if exists "profiles_platform_select_all" on public.profiles;

create policy "profiles_platform_select_all"
on public.profiles
for select
to authenticated
using (public.current_user_is_platform_admin());
