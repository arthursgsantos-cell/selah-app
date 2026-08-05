-- Inscrição via link externo (Google Forms, Typeform, etc.), como alternativa
-- ao formulário interno.

alter table public.eventos
  drop constraint if exists eventos_tipo_inscricao_check;

alter table public.eventos
  add constraint eventos_tipo_inscricao_check
  check (tipo_inscricao in ('aberto', 'whatsapp', 'formulario', 'pix', 'link'));

alter table public.eventos
  add column if not exists link_inscricao_url text;
