-- ============================================================
-- MULTIPLICAÇÃO DE CÉLULA
-- ============================================================
-- Célula que multiplica some do mapa: a filha vira uma linha nova sem
-- nenhuma ligação com a mãe, e a rede perde a própria história. Duas colunas
-- resolvem — a linhagem e a data que a liderança combinou como alvo.
--
-- `celula_mae_id` aponta para a célula que gerou esta. Auto-referência, então
-- a raiz da árvore é a célula com o campo nulo.

alter table public.celulas
  add column if not exists celula_mae_id uuid references public.celulas(id) on delete set null,
  add column if not exists multiplicacao_prevista date;

create index if not exists celulas_mae_idx on public.celulas (celula_mae_id);

comment on column public.celulas.celula_mae_id is
  'Célula que gerou esta na multiplicação. Nulo = célula raiz.';
comment on column public.celulas.multiplicacao_prevista is
  'Data-alvo combinada para a próxima multiplicação. Nulo = sem previsão.';
