-- ============================================================
-- PAGAMENTO DAS TURMAS DO ENSINO
-- ============================================================
-- Curso com apostila, material ou taxa de matrícula sempre teve valor — o que
-- não existia era onde registrar quem pagou. A secretaria mantinha um caderno
-- à parte, e o professor descobria a inadimplência no fim do módulo.
--
-- O desenho copia, de propósito, o que já funciona nos eventos
-- (`evento_valores` / `evento_parcelas` / `inscricao_pagamentos`): valor na
-- turma, plano de parcelas opcional e um lançamento por pagamento recebido.
-- Nada de integração bancária: quem confere o PIX é a tesouraria, e o app é o
-- livro-caixa dela.

-- ── Valor da turma ────────────────────────────────────────────────────────
alter table public.ensino_turmas
  -- Nulo ou zero = turma gratuita, que é o caso da maioria.
  add column if not exists valor                 numeric(10,2),
  -- Quando ligado, a tela de inscrição avisa o valor antes de a pessoa se
  -- inscrever, em vez de cobrar depois como surpresa.
  add column if not exists pagamento_instrucoes  text;

-- ── Parcelas ──────────────────────────────────────────────────────────────
-- Sem linhas aqui, o valor é cobrado de uma vez. Com elas, o painel mostra o
-- que vence quando. `percentual` nulo divide o total igualmente.
create table if not exists public.ensino_turma_parcelas (
  id         uuid primary key default gen_random_uuid(),
  turma_id   uuid not null references public.ensino_turmas(id) on delete cascade,
  numero     int  not null,
  vencimento date not null,
  percentual numeric(5,2),
  unique (turma_id, numero)
);

create index if not exists ensino_turma_parcelas_turma_idx
  on public.ensino_turma_parcelas (turma_id, numero);

-- ── Isenção e valor combinado ────────────────────────────────────────────
-- Bolsa, meia para quem já fez o curso, isenção do obreiro: casos que a
-- secretaria resolve pessoa a pessoa. Nulo = vale o valor da turma.
alter table public.ensino_inscricoes
  add column if not exists valor_combinado numeric(10,2);

-- ── Pagamentos recebidos ─────────────────────────────────────────────────
create table if not exists public.ensino_pagamentos (
  id            uuid primary key default gen_random_uuid(),
  inscricao_id  uuid not null references public.ensino_inscricoes(id) on delete cascade,
  valor         numeric(10,2) not null check (valor > 0),
  pago_em       date not null default current_date,
  metodo        text,
  observacao    text,
  registrado_por uuid references public.profiles(id) on delete set null,
  criado_em     timestamptz not null default now()
);

create index if not exists ensino_pagamentos_inscricao_idx
  on public.ensino_pagamentos (inscricao_id, pago_em);

-- ── RLS ───────────────────────────────────────────────────────────────────
alter table public.ensino_turma_parcelas enable row level security;
alter table public.ensino_pagamentos     enable row level security;

drop policy if exists "ensino_parcelas_select"   on public.ensino_turma_parcelas;
drop policy if exists "ensino_parcelas_gerir"    on public.ensino_turma_parcelas;
drop policy if exists "ensino_pagamentos_select" on public.ensino_pagamentos;
drop policy if exists "ensino_pagamentos_gerir"  on public.ensino_pagamentos;

-- O plano de parcelas é informação do curso: quem enxerga a turma enxerga
-- quando vence o quê.
create policy "ensino_parcelas_select" on public.ensino_turma_parcelas
  for select to authenticated using (true);

-- Mexer no plano é da coordenação.
create policy "ensino_parcelas_gerir" on public.ensino_turma_parcelas
  for all to authenticated
  using (public.ensino_e_coordenador())
  with check (public.ensino_e_coordenador());

-- Cada aluno vê o próprio extrato; a coordenação vê o de todos. O professor
-- fica de fora de propósito: dinheiro é assunto da secretaria, não de quem dá
-- a aula.
create policy "ensino_pagamentos_select" on public.ensino_pagamentos
  for select to authenticated
  using (
    public.ensino_e_coordenador()
    or exists (
      select 1 from public.ensino_inscricoes i
      where i.id = ensino_pagamentos.inscricao_id
        and i.user_id = auth.uid()
    )
  );

create policy "ensino_pagamentos_gerir" on public.ensino_pagamentos
  for all to authenticated
  using (public.ensino_e_coordenador())
  with check (public.ensino_e_coordenador());
