create table if not exists public.avaliacoes (
  id uuid primary key default gen_random_uuid(),
  barbearia_id uuid not null references public.barbearias(id) on delete cascade,
  cliente_id uuid null references public.clientes(id) on delete set null,
  cliente_account_id uuid null,
  nome_cliente text not null,
  nota integer not null check (nota between 1 and 5),
  depoimento text not null,
  fotos text[] not null default '{}'::text[],
  status text not null default 'pendente' check (status in ('pendente', 'aprovada', 'oculta')),
  created_at timestamptz not null default now()
);

alter table public.avaliacoes enable row level security;

create index if not exists idx_avaliacoes_publicas_barbearia
  on public.avaliacoes (barbearia_id, status, created_at desc);

create index if not exists idx_avaliacoes_admin_barbearia
  on public.avaliacoes (barbearia_id, created_at desc);

grant select on table public.avaliacoes to anon, authenticated;
grant insert, update, delete on table public.avaliacoes to authenticated;

drop policy if exists "anon_select_avaliacoes_aprovadas" on public.avaliacoes;
create policy "anon_select_avaliacoes_aprovadas"
on public.avaliacoes
for select
to anon, authenticated
using (
  status = 'aprovada'
  and exists (
    select 1
    from public.barbearias b
    where b.id = avaliacoes.barbearia_id
      and b.ativo = true
  )
);

drop policy if exists "tenant_select_avaliacoes" on public.avaliacoes;
create policy "tenant_select_avaliacoes"
on public.avaliacoes
for select
to authenticated
using (
  barbearia_id in (
    select p.barbearia_id
    from public.profiles p
    where p.id = auth.uid()
  )
);

drop policy if exists "tenant_update_avaliacoes" on public.avaliacoes;
create policy "tenant_update_avaliacoes"
on public.avaliacoes
for update
to authenticated
using (
  barbearia_id in (
    select p.barbearia_id
    from public.profiles p
    where p.id = auth.uid()
  )
)
with check (
  barbearia_id in (
    select p.barbearia_id
    from public.profiles p
    where p.id = auth.uid()
  )
);

drop policy if exists "tenant_delete_avaliacoes" on public.avaliacoes;
create policy "tenant_delete_avaliacoes"
on public.avaliacoes
for delete
to authenticated
using (
  barbearia_id in (
    select p.barbearia_id
    from public.profiles p
    where p.id = auth.uid()
  )
);

create or replace function public.rpc_criar_avaliacao(
  p_avaliacao_id uuid,
  p_barbearia_id uuid,
  p_nome_cliente text,
  p_nota integer,
  p_depoimento text,
  p_fotos text[] default '{}'::text[]
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_nome text := nullif(trim(coalesce(p_nome_cliente, '')), '');
  v_depoimento text := nullif(trim(coalesce(p_depoimento, '')), '');
  v_fotos text[] := coalesce(p_fotos, '{}'::text[]);
  v_id uuid := coalesce(p_avaliacao_id, gen_random_uuid());
begin
  if not exists (select 1 from public.barbearias where id = p_barbearia_id and ativo = true) then
    raise exception 'Barbearia nao encontrada.';
  end if;

  if v_nome is null then
    raise exception 'Informe seu nome.';
  end if;

  if p_nota is null or p_nota < 1 or p_nota > 5 then
    raise exception 'Nota invalida.';
  end if;

  if v_depoimento is null then
    raise exception 'Depoimento obrigatorio.';
  end if;

  if array_length(v_fotos, 1) > 4 then
    raise exception 'Limite maximo de 4 fotos.';
  end if;

  insert into public.avaliacoes (
    id,
    barbearia_id,
    nome_cliente,
    nota,
    depoimento,
    fotos,
    status
  )
  values (
    v_id,
    p_barbearia_id,
    v_nome,
    p_nota,
    v_depoimento,
    v_fotos,
    'pendente'
  );

  return v_id;
end;
$$;

create or replace function public.rpc_moderar_avaliacao(
  p_avaliacao_id uuid,
  p_novo_status text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_barbearia_id uuid;
begin
  if p_novo_status not in ('pendente', 'aprovada', 'oculta') then
    raise exception 'Status invalido.';
  end if;

  select a.barbearia_id
    into v_barbearia_id
  from public.avaliacoes a
  where a.id = p_avaliacao_id;

  if v_barbearia_id is null then
    raise exception 'Avaliacao nao encontrada.';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.barbearia_id = v_barbearia_id
  ) then
    raise exception 'Acesso negado.';
  end if;

  update public.avaliacoes
  set status = p_novo_status
  where id = p_avaliacao_id;
end;
$$;

revoke all on function public.rpc_criar_avaliacao(uuid, uuid, text, integer, text, text[]) from public;
revoke all on function public.rpc_moderar_avaliacao(uuid, text) from public;
grant execute on function public.rpc_criar_avaliacao(uuid, uuid, text, integer, text, text[]) to anon, authenticated;
grant execute on function public.rpc_moderar_avaliacao(uuid, text) to authenticated;

drop policy if exists "barber_photos_anon_review_upload" on storage.objects;
create policy "barber_photos_anon_review_upload"
on storage.objects
for insert
to anon, authenticated
with check (
  bucket_id = 'barber-photos'
  and (storage.foldername(name))[1] = 'barbearias'
  and (storage.foldername(name))[3] = 'avaliacoes'
  and exists (
    select 1
    from public.barbearias b
    where b.id::text = (storage.foldername(name))[2]
      and b.ativo = true
  )
);
