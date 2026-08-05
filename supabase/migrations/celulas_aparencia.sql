-- Aparência customizável da célula — mesmo modelo já aplicado às redes:
-- banner (capa_url, já existe) + fundo da página (cor/degradê/nébula/imagem).

alter table public.celulas
  add column if not exists cor_secundaria   text,
  add column if not exists fundo_tipo       text not null default 'cor',
  add column if not exists fundo_imagem_url text;

alter table public.celulas
  drop constraint if exists celulas_fundo_tipo_check;

alter table public.celulas
  add constraint celulas_fundo_tipo_check
  check (fundo_tipo in ('cor', 'gradiente', 'nebula', 'imagem'));
