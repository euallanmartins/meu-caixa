alter table public.barbeiros
  add column if not exists foto_url text,
  add column if not exists titulo text,
  add column if not exists telefone text,
  add column if not exists especialidade text,
  add column if not exists tags jsonb not null default '[]'::jsonb,
  add column if not exists avaliacao numeric not null default 0,
  add column if not exists total_avaliacoes integer not null default 0,
  add column if not exists destaque_label text,
  add column if not exists proxima_disponibilidade text;
