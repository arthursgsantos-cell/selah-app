-- ============================================================
-- LAYOUT DAS SEÇÕES DA HOME
-- ============================================================
-- `home_secoes_ordem` já dizia em que ordem os cartões aparecem, e
-- `home_secoes_textos` o que está escrito neles. Faltava o desenho: quanto cada
-- um ocupa da largura e como é pintado.
--
-- A coluna guarda, por seção, `{ largura, estilo, cor, cor2, texto }` — ver
-- `LayoutSecao` em `lib/home-secoes.ts`. A grade tem duas colunas: largura 2
-- ocupa a linha inteira (como a home sempre foi) e largura 1 ocupa metade, o
-- que permite dois cartões lado a lado.
--
-- Sem a coluna preenchida, tudo continua como antes: o código aplica o padrão.

alter table public.igrejas
  add column if not exists home_secoes_layout jsonb not null default '{}'::jsonb;
