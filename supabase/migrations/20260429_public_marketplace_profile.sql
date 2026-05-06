alter table public.barbearias
  add column if not exists descricao text,
  add column if not exists endereco text,
  add column if not exists telefone text,
  add column if not exists whatsapp text,
  add column if not exists logo_url text,
  add column if not exists capa_url text,
  add column if not exists ativo boolean not null default true,
  add column if not exists mensagem_boas_vindas text;

alter table public.servicos
  add column if not exists descricao text,
  add column if not exists ativo boolean not null default true,
  add column if not exists foto_url text;

create table if not exists public.barbearia_fotos (
  id uuid primary key default gen_random_uuid(),
  barbearia_id uuid not null references public.barbearias(id) on delete cascade,
  url text not null,
  storage_path text,
  tipo text not null default 'portfolio',
  ordem integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.barbearia_fotos enable row level security;

create index if not exists idx_barbearia_fotos_barbearia_tipo_ordem
  on public.barbearia_fotos (barbearia_id, tipo, ordem);

create index if not exists idx_servicos_barbearia_ativo_nome
  on public.servicos (barbearia_id, ativo, nome);

create index if not exists idx_barbeiros_barbearia_ativo_nome
  on public.barbeiros (barbearia_id, ativo, nome);

grant select on table public.barbearias to anon, authenticated;
grant select on table public.servicos to anon, authenticated;
grant select on table public.barbeiros to anon, authenticated;
grant select on table public.horarios_funcionamento to anon, authenticated;
grant select on table public.barbearia_fotos to anon, authenticated;
grant insert, update, delete on table public.barbearia_fotos to authenticated;

drop policy if exists "anon_select_barbearias_ativas" on public.barbearias;
create policy "anon_select_barbearias_ativas"
on public.barbearias
for select
to anon, authenticated
using (ativo = true);

drop policy if exists "anon_select_servicos_ativos" on public.servicos;
create policy "anon_select_servicos_ativos"
on public.servicos
for select
to anon, authenticated
using (
  ativo = true
  and exists (
    select 1
    from public.barbearias b
    where b.id = servicos.barbearia_id
      and b.ativo = true
  )
);

drop policy if exists "anon_select_barbeiros_ativos" on public.barbeiros;
create policy "anon_select_barbeiros_ativos"
on public.barbeiros
for select
to anon, authenticated
using (
  ativo = true
  and exists (
    select 1
    from public.barbearias b
    where b.id = barbeiros.barbearia_id
      and b.ativo = true
  )
);

drop policy if exists "anon_select_barbearia_fotos_publicas" on public.barbearia_fotos;
create policy "anon_select_barbearia_fotos_publicas"
on public.barbearia_fotos
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.barbearias b
    where b.id = barbearia_fotos.barbearia_id
      and b.ativo = true
  )
);

drop policy if exists "tenant_insert_barbearia_fotos" on public.barbearia_fotos;
create policy "tenant_insert_barbearia_fotos"
on public.barbearia_fotos
for insert
to authenticated
with check (
  barbearia_id in (
    select p.barbearia_id
    from public.profiles p
    where p.id = auth.uid()
  )
);

drop policy if exists "tenant_update_barbearia_fotos" on public.barbearia_fotos;
create policy "tenant_update_barbearia_fotos"
on public.barbearia_fotos
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

drop policy if exists "tenant_delete_barbearia_fotos" on public.barbearia_fotos;
create policy "tenant_delete_barbearia_fotos"
on public.barbearia_fotos
for delete
to authenticated
using (
  barbearia_id in (
    select p.barbearia_id
    from public.profiles p
    where p.id = auth.uid()
  )
);

drop policy if exists "proprietario_update_perfil_publico_barbearia" on public.barbearias;
create policy "proprietario_update_perfil_publico_barbearia"
on public.barbearias
for update
to authenticated
using (
  proprietario_id = auth.uid()
  or id in (
    select p.barbearia_id
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('owner', 'admin', 'proprietario')
  )
)
with check (
  proprietario_id = auth.uid()
  or id in (
    select p.barbearia_id
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('owner', 'admin', 'proprietario')
  )
);

update public.barbearias
set
  nome = 'dsbarbershop',
  descricao = coalesce(descricao, 'Barbearia premium com agenda online, profissionais selecionados e atendimento personalizado.'),
  endereco = coalesce(endereco, 'Agendamento online'),
  ativo = true
where id = 'a251aedd-347a-466a-a26a-4b53d394f7ae'::uuid;

drop policy if exists "barber_photos_public_read" on storage.objects;
create policy "barber_photos_public_read"
on storage.objects
for select
to public
using (bucket_id = 'barber-photos');

drop policy if exists "barber_photos_authenticated_upload" on storage.objects;
create policy "barber_photos_authenticated_upload"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'barber-photos'
  and (
    (
      (storage.foldername(name))[1] = 'barbearias'
      and (storage.foldername(name))[2] in (
        select p.barbearia_id::text
        from public.profiles p
        where p.id = auth.uid()
      )
    )
    or (storage.foldername(name))[1] in (
      select p.barbearia_id::text
      from public.profiles p
      where p.id = auth.uid()
    )
  )
);

drop policy if exists "barber_photos_authenticated_update" on storage.objects;
create policy "barber_photos_authenticated_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'barber-photos'
  and (
    (
      (storage.foldername(name))[1] = 'barbearias'
      and (storage.foldername(name))[2] in (
        select p.barbearia_id::text
        from public.profiles p
        where p.id = auth.uid()
      )
    )
    or (storage.foldername(name))[1] in (
      select p.barbearia_id::text
      from public.profiles p
      where p.id = auth.uid()
    )
  )
)
with check (
  bucket_id = 'barber-photos'
  and (
    (
      (storage.foldername(name))[1] = 'barbearias'
      and (storage.foldername(name))[2] in (
        select p.barbearia_id::text
        from public.profiles p
        where p.id = auth.uid()
      )
    )
    or (storage.foldername(name))[1] in (
      select p.barbearia_id::text
      from public.profiles p
      where p.id = auth.uid()
    )
  )
);

drop policy if exists "barber_photos_authenticated_delete" on storage.objects;
create policy "barber_photos_authenticated_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'barber-photos'
  and (
    (
      (storage.foldername(name))[1] = 'barbearias'
      and (storage.foldername(name))[2] in (
        select p.barbearia_id::text
        from public.profiles p
        where p.id = auth.uid()
      )
    )
    or (storage.foldername(name))[1] in (
      select p.barbearia_id::text
      from public.profiles p
      where p.id = auth.uid()
    )
  )
);
