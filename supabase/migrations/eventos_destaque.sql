-- Evento em destaque na página inicial.
--
-- É o pastor quem decide, pelo botão na própria página do evento — não há
-- regra automática (nem "o mais próximo", nem "o maior"), porque o critério é
-- editorial: qual evento a igreja quer empurrar naquela semana.
--
-- Mais de um destaque vira carrossel na home. Evento que já passou some do
-- destaque sozinho, pelo filtro de data, sem ninguém precisar desmarcar.

alter table public.eventos
  add column if not exists destaque boolean not null default false;

-- Índice parcial: a home busca só os destacados e futuros.
create index if not exists eventos_destaque_idx
  on public.eventos (igreja_id, data_hora)
  where destaque;
