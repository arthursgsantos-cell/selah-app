-- Duas automações de aparência, ambas ligadas por padrão e desligáveis.
--
-- 1) `fundo_auto_cor`: as cores do fundo saem da CAPA da página, em estilo
--    nébula. Como extrair cor de imagem exige um canvas, quem calcula é o
--    navegador; o resultado é gravado em `cor`/`cor_secundaria` para que a
--    próxima visita já venha pronta do servidor, sem piscar.
--
--    `fundo_auto_cor_origem` guarda a URL da capa de onde as cores vieram.
--    Quando a capa muda, a URL deixa de bater e as cores são recalculadas —
--    é o que evita recalcular a cada visita e, ao mesmo tempo, manter as
--    cores em dia.
--
-- 2) `capa_automatica` (só célula): a capa passa a ser a foto mais recente da
--    galeria da própria célula, em vez de uma imagem enviada à mão.

alter table public.celulas
  add column if not exists fundo_auto_cor        boolean not null default true,
  add column if not exists fundo_auto_cor_origem text,
  add column if not exists capa_automatica       boolean not null default true;

alter table public.redes
  add column if not exists fundo_auto_cor        boolean not null default true,
  add column if not exists fundo_auto_cor_origem text;

alter table public.eventos
  add column if not exists fundo_auto_cor        boolean not null default true,
  add column if not exists fundo_auto_cor_origem text;
