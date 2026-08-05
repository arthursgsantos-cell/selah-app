-- Personalização da página própria do evento.
--
-- Separa a CAPA DA PÁGINA (`capa_pagina_url`) do CARD do evento
-- (`imagem_url`): o card continua sendo a arte que circula no WhatsApp e
-- aparece nas listagens; a capa da página pode ser uma foto mais larga, sem
-- texto, feita para o topo da página. Sem capa própria, a página cai no card.
--
-- O fundo segue a mesma convenção de redes e células. `fundo_tipo` fica NULO
-- por padrão de propósito: evento sem personalização mantém o fundo normal do
-- app, sem mudar a aparência dos eventos que já existem.

alter table public.eventos
  add column if not exists capa_pagina_url  text,
  add column if not exists cor              text,
  add column if not exists cor_secundaria   text,
  add column if not exists fundo_tipo       text,
  add column if not exists fundo_imagem_url text,
  add column if not exists fundo_opacidade  smallint not null default 100;

alter table public.eventos
  drop constraint if exists eventos_fundo_opacidade_check;
alter table public.eventos
  add constraint eventos_fundo_opacidade_check check (fundo_opacidade between 0 and 100);

alter table public.eventos
  drop constraint if exists eventos_fundo_tipo_check;
alter table public.eventos
  add constraint eventos_fundo_tipo_check
  check (fundo_tipo is null or fundo_tipo in ('cor','gradiente','nebula','imagem'));

-- Botões de link da página: inscrição por fora, regulamento, grupo do
-- WhatsApp, localização no mapa. O botão de inscrição do app continua
-- separado — estes são complementares.
create table if not exists public.evento_botoes (
  id        uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos(id) on delete cascade,
  rotulo    text not null,
  url       text not null,
  ordem     int  not null default 0,
  criado_em timestamptz not null default now()
);

create index if not exists evento_botoes_evento_idx
  on public.evento_botoes (evento_id, ordem);

-- Mini cards: blocos com foto, título e valor. Nasceram dos tipos de
-- acomodação de um retiro (cada acomodação com sua foto e seu preço), mas
-- servem para qualquer lista ilustrada — lotes, pacotes, atrações.
create table if not exists public.evento_cards (
  id          uuid primary key default gen_random_uuid(),
  evento_id   uuid not null references public.eventos(id) on delete cascade,
  titulo      text not null,
  descricao   text,
  imagem_url  text,
  -- Nulo quando o card é só ilustrativo, sem preço.
  valor       numeric(10,2),
  ordem       int  not null default 0,
  criado_em   timestamptz not null default now()
);

create index if not exists evento_cards_evento_idx
  on public.evento_cards (evento_id, ordem);

alter table public.evento_botoes enable row level security;
alter table public.evento_cards  enable row level security;

-- Mesma convenção permissiva de `evento_fotos`: a página do evento é pública
-- para leitura e a escrita passa sempre pelas server actions, que checam cargo.
drop policy if exists "evento_botoes_select" on public.evento_botoes;
drop policy if exists "evento_botoes_insert" on public.evento_botoes;
drop policy if exists "evento_botoes_update" on public.evento_botoes;
drop policy if exists "evento_botoes_delete" on public.evento_botoes;

create policy "evento_botoes_select" on public.evento_botoes for select using (true);
create policy "evento_botoes_insert" on public.evento_botoes for insert to authenticated with check (true);
create policy "evento_botoes_update" on public.evento_botoes for update to authenticated using (true);
create policy "evento_botoes_delete" on public.evento_botoes for delete to authenticated using (true);

drop policy if exists "evento_cards_select" on public.evento_cards;
drop policy if exists "evento_cards_insert" on public.evento_cards;
drop policy if exists "evento_cards_update" on public.evento_cards;
drop policy if exists "evento_cards_delete" on public.evento_cards;

create policy "evento_cards_select" on public.evento_cards for select using (true);
create policy "evento_cards_insert" on public.evento_cards for insert to authenticated with check (true);
create policy "evento_cards_update" on public.evento_cards for update to authenticated using (true);
create policy "evento_cards_delete" on public.evento_cards for delete to authenticated using (true);

-- Cabeçalho da seção de mini cards. "Opções" é só o rótulo de reserva: cada
-- evento nomeia a seção conforme o caso ("Acomodações", "Lotes", "Pacotes") e
-- pode explicar em uma linha do que se trata.
alter table public.eventos
  add column if not exists cards_titulo    text,
  add column if not exists cards_descricao text;
