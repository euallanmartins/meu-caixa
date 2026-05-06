alter table public.barbeiros
  add column if not exists foto_url text,
  add column if not exists titulo text,
  add column if not exists especialidade text,
  add column if not exists tags text[] not null default '{}'::text[],
  add column if not exists avaliacao numeric(2,1) not null default 5.0,
  add column if not exists total_avaliacoes integer not null default 0,
  add column if not exists destaque_label text,
  add column if not exists proxima_disponibilidade text;

alter table public.barbeiros
  drop constraint if exists barbeiros_avaliacao_range,
  add constraint barbeiros_avaliacao_range check (avaliacao >= 0 and avaliacao <= 5);

alter table public.barbeiros
  drop constraint if exists barbeiros_total_avaliacoes_nonnegative,
  add constraint barbeiros_total_avaliacoes_nonnegative check (total_avaliacoes >= 0);

insert into storage.buckets (id, name, public)
values ('barber-photos', 'barber-photos', true)
on conflict (id) do update set public = true;

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
with check (bucket_id = 'barber-photos');

drop policy if exists "barber_photos_authenticated_update" on storage.objects;
create policy "barber_photos_authenticated_update"
on storage.objects
for update
to authenticated
using (bucket_id = 'barber-photos')
with check (bucket_id = 'barber-photos');
