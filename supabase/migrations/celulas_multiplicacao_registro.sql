-- ============================================================
-- MULTIPLICAÇÃO REGISTRADA
-- ============================================================
-- `celulas_multiplicacao.sql` guardou a linhagem e a data-alvo. Faltava o
-- outro lado: o dia em que a multiplicação de fato aconteceu, e o fato de que
-- célula recém-multiplicada quase nunca já tem nome.
--
-- `multiplicada_em` fica na filha, não na mãe: uma célula pode multiplicar em
-- três de uma vez, e cada filha nasce numa data que é dela.
--
-- `nome_provisorio` marca a filha que entrou como "Nova célula de X" enquanto
-- a liderança ainda não batizou. Serve para a árvore pedir o nome em vez de
-- fingir que ele existe.

alter table public.celulas
  add column if not exists multiplicada_em date,
  add column if not exists nome_provisorio boolean not null default false;

comment on column public.celulas.multiplicada_em is
  'Dia em que esta célula nasceu da multiplicação da célula-mãe. Nulo = célula que não veio de multiplicação registrada.';
comment on column public.celulas.nome_provisorio is
  'Verdadeiro enquanto a célula multiplicada ainda não recebeu nome próprio.';
