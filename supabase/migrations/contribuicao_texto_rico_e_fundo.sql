-- ============================================================
-- Página de contribuição: texto rico e fundo próprio
-- ============================================================
-- `contribuicao_texto` já existia como texto corrido. Continua sendo a mesma
-- coluna — só passa a ser interpretado como a marcação de `lib/texto-rico.ts`
-- (negrito, título, citação, lista) em vez de texto solto. O que já estava
-- salvo continua valendo: sem marcação nenhuma, cada linha vira um parágrafo,
-- que é como aparecia antes.
--
-- O fundo é dedicado, e não o mesmo de `igrejas.fundo_tipo`: aquele já
-- pertence à home, e a tesouraria pode querer uma identidade visual própria
-- para a página do dízimo (um dourado, por exemplo) sem mudar a cara da home.
-- Mesmo conjunto de colunas que rede, célula, evento e turma já usam — para o
-- componente `FundoPagina` funcionar sem adaptação.

alter table public.igrejas
  add column if not exists contribuicao_cor                text,
  add column if not exists contribuicao_cor_secundaria      text,
  add column if not exists contribuicao_fundo_tipo          text,
  add column if not exists contribuicao_fundo_imagem_url    text,
  add column if not exists contribuicao_fundo_opacidade     smallint not null default 100;

comment on column public.igrejas.contribuicao_texto is
  'Texto pastoral da página de contribuição, na marcação de lib/texto-rico.ts.';
