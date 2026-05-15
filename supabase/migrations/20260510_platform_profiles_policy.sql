-- Allow platform admins to read profiles for the platform dashboard.

drop policy if exists "profiles_platform_select_all" on public.profiles;

create policy "profiles_platform_select_all"
on public.profiles
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
