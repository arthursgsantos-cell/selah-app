-- Cobrança de eventos: valores que dependem da resposta do formulário,
-- parcelamento com vencimento e controle de pagamentos pelo tesoureiro.

-- ── Tabela de valores ─────────────────────────────────────────────────────
-- Cada linha liga uma OPÇÃO de um campo do formulário a um preço.
-- Ex.: campo "Tipo de participante", opção "Adulto" → 150,00
-- Sem campo_id/opcao, o valor vale para todo mundo (preço único).
create table if not exists public.evento_valores (
  id         uuid primary key default gen_random_uuid(),
  evento_id  uuid not null references public.eventos(id) on delete cascade,
  nome       text not null,
  valor      numeric(10,2) not null check (valor >= 0),
  campo_id   text,
  opcao      text,
  ordem      int not null default 0,
  criado_em  timestamptz not null default now()
);

create index if not exists evento_valores_evento_idx
  on public.evento_valores (evento_id, ordem);

-- ── Parcelas do evento ────────────────────────────────────────────────────
-- O valor de cada parcela é derivado do total do inscrito: se percentual for
-- nulo, divide igualmente entre as parcelas.
create table if not exists public.evento_parcelas (
  id          uuid primary key default gen_random_uuid(),
  evento_id   uuid not null references public.eventos(id) on delete cascade,
  numero      int  not null,
  vencimento  date not null,
  percentual  numeric(5,2) check (percentual is null or (percentual > 0 and percentual <= 100)),
  criado_em   timestamptz not null default now(),
  unique (evento_id, numero)
);

create index if not exists evento_parcelas_evento_idx
  on public.evento_parcelas (evento_id, numero);

-- ── Valor devido por inscrição ────────────────────────────────────────────
-- Congelado no momento da inscrição, para que mudanças de tabela de preço
-- não alterem retroativamente quem já se inscreveu.
alter table public.inscricoes_evento
  add column if not exists valor_total numeric(10,2);

-- ── Pagamentos lançados pelo tesoureiro ───────────────────────────────────
create table if not exists public.inscricao_pagamentos (
  id             uuid primary key default gen_random_uuid(),
  inscricao_id   uuid not null references public.inscricoes_evento(id) on delete cascade,
  valor          numeric(10,2) not null check (valor > 0),
  pago_em        date not null default current_date,
  metodo         text,
  observacao     text,
  registrado_por uuid references public.profiles(id) on delete set null,
  criado_em      timestamptz not null default now()
);

create index if not exists inscricao_pagamentos_inscricao_idx
  on public.inscricao_pagamentos (inscricao_id, pago_em);

-- ── RLS (mesma convenção permissiva das demais tabelas deste banco) ────────
alter table public.evento_valores       enable row level security;
alter table public.evento_parcelas      enable row level security;
alter table public.inscricao_pagamentos enable row level security;

drop policy if exists "evento_valores_all"       on public.evento_valores;
drop policy if exists "evento_parcelas_all"      on public.evento_parcelas;
drop policy if exists "inscricao_pagamentos_all" on public.inscricao_pagamentos;

create policy "evento_valores_all" on public.evento_valores
  for all to authenticated using (true) with check (true);
create policy "evento_parcelas_all" on public.evento_parcelas
  for all to authenticated using (true) with check (true);
create policy "inscricao_pagamentos_all" on public.inscricao_pagamentos
  for all to authenticated using (true) with check (true);
