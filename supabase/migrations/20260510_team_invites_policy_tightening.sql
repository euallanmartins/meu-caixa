-- Tighten direct table access for team_invites.
-- Mutations should go through RPCs so role and token rules cannot be bypassed.

drop policy if exists "team_invites_admin_insert_same_barbearia" on public.team_invites;
drop policy if exists "team_invites_admin_cancel_same_barbearia" on public.team_invites;

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
  )
);

-- No direct UPDATE policy: cancellation and acceptance are handled by SECURITY DEFINER RPCs.
