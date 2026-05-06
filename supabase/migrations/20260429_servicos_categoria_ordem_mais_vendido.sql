alter table public.servicos
  add column if not exists categoria text default 'Outros',
  add column if not exists ordem integer default 0,
  add column if not exists mais_vendido boolean default false;

create index if not exists idx_servicos_barbearia_ativo_categoria_ordem
  on public.servicos (barbearia_id, ativo, categoria, ordem, nome);
