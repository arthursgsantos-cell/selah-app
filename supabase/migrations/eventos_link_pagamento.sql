-- Link de pagamento (ex: cobrança Nubank) + permite formulário e pagamento no mesmo evento

alter table public.eventos
  add column if not exists link_pagamento text;

-- libera formulário + pagamento no mesmo evento
alter table public.eventos
  drop constraint if exists eventos_tipo_inscricao_check;
alter table public.eventos
  add constraint eventos_tipo_inscricao_check
  check (tipo_inscricao in ('aberto','whatsapp','formulario','pix','formulario_pix'));
