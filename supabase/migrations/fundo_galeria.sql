-- Fundo em galeria: as fotos do próprio lugar (célula, rede ou evento) em
-- cascata atrás do conteúdo, com transparência.
--
-- Não substitui `fundo_tipo`. É uma CAMADA A MAIS: a cor, o degradê ou a
-- nébula continuam embaixo, e a galeria entra por cima delas — por isso um
-- boolean separado, e não mais um valor em `fundo_tipo`.
--
-- Habilitado por padrão. Onde não houver foto, nada é desenhado, então
-- ligar por padrão não muda a aparência de quem ainda não tem galeria.

alter table public.celulas
  add column if not exists fundo_galeria            boolean  not null default true,
  add column if not exists fundo_galeria_opacidade  smallint not null default 15;

alter table public.redes
  add column if not exists fundo_galeria            boolean  not null default true,
  add column if not exists fundo_galeria_opacidade  smallint not null default 15;

alter table public.eventos
  add column if not exists fundo_galeria            boolean  not null default true,
  add column if not exists fundo_galeria_opacidade  smallint not null default 15;

alter table public.celulas drop constraint if exists celulas_fundo_galeria_opacidade_check;
alter table public.celulas
  add constraint celulas_fundo_galeria_opacidade_check
  check (fundo_galeria_opacidade between 0 and 100);

alter table public.redes drop constraint if exists redes_fundo_galeria_opacidade_check;
alter table public.redes
  add constraint redes_fundo_galeria_opacidade_check
  check (fundo_galeria_opacidade between 0 and 100);

alter table public.eventos drop constraint if exists eventos_fundo_galeria_opacidade_check;
alter table public.eventos
  add constraint eventos_fundo_galeria_opacidade_check
  check (fundo_galeria_opacidade between 0 and 100);
