do $$
begin
  if to_regclass('public.horarios_funcionamento') is not null then
    execute 'grant select on table public.horarios_funcionamento to anon';

    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'horarios_funcionamento'
        and policyname = 'anon_select_horarios_funcionamento'
    ) then
      execute 'create policy "anon_select_horarios_funcionamento" on public.horarios_funcionamento for select to anon using (true)';
    end if;
  end if;
end $$;
