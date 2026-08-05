-- Opacidade do fundo (0–100), aplicável a qualquer estilo — cor sólida,
-- degradê, nébula ou imagem. Comum a redes e células.

alter table public.redes
  add column if not exists fundo_opacidade smallint not null default 100;
alter table public.celulas
  add column if not exists fundo_opacidade smallint not null default 100;

alter table public.redes
  drop constraint if exists redes_fundo_opacidade_check;
alter table public.redes
  add constraint redes_fundo_opacidade_check check (fundo_opacidade between 0 and 100);

alter table public.celulas
  drop constraint if exists celulas_fundo_opacidade_check;
alter table public.celulas
  add constraint celulas_fundo_opacidade_check check (fundo_opacidade between 0 and 100);
