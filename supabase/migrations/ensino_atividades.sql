-- ============================================================
-- ATIVIDADES — o que o professor manda o aluno fazer entre uma aula e outra
-- ============================================================
-- Até aqui o módulo cobre o encontro: a aula, a chamada, o material. O que
-- acontece entre um encontro e o seguinte — a tarefa do livro, o desafio de
-- leitura, a prova — vivia no grupo do WhatsApp, e o professor não tinha como
-- saber quem estava conseguindo cumprir.
--
-- ## Três tipos, uma tabela
--
-- `tarefa`, `leitura` e `quiz` compartilham quase tudo: pertencem a uma turma,
-- têm prazo, aparecem na lista do aluno, geram uma entrega por inscrito e um
-- painel de acompanhamento. O que muda é o miolo — e o miolo mora em tabelas
-- filhas, que só o tipo que precisa delas preenche. Três tabelas irmãs
-- duplicariam prazo, publicação, aparência e o painel inteiro.
--
-- ## Por que a entrega aponta para a inscrição, e não para o usuário
--
-- Metade dos alunos do Ensino não tem conta no app — são os que o professor
-- cadastrou à mão (`ensino_inscricoes.user_id is null`). Amarrar a entrega ao
-- `user_id` deixaria essa metade fora do painel. A inscrição existe para os
-- dois casos, e é ela que já governa chamada e frequência.

-- ---------------------------------------------------------------------------
-- A atividade
-- ---------------------------------------------------------------------------

create table if not exists public.ensino_atividades (
  id        uuid primary key default gen_random_uuid(),
  turma_id  uuid not null references public.ensino_turmas(id) on delete cascade,
  tipo      text not null check (tipo in ('tarefa', 'leitura', 'quiz')),

  titulo    text not null,
  -- Texto rico, mesma marcação de `ensino_aulas.descricao`.
  descricao text,

  -- Aparência da página. A atividade é a única tela que o aluno abre sozinho,
  -- longe da aula, então ela precisa se sustentar visualmente — daí capa,
  -- fundo e vídeo de abertura, como na página do evento.
  capa_url        text,
  fundo_url       text,
  fundo_opacidade real not null default 0.2 check (fundo_opacidade between 0 and 1),
  cor             text,
  video_url       text,

  -- `abre_em` nulo = disponível assim que publicada.
  abre_em   date,
  prazo     date,

  -- Rascunho não aparece para o aluno. O professor monta a prova ao longo da
  -- semana e publica quando ela está pronta.
  publicada boolean not null default false,
  ordem     int not null default 0,

  /**
   * Configuração do plano de leitura. Só o tipo 'leitura' preenche.
   *
   * {
   *   "modo": "repeticoes" | "percurso",
   *   "trechos": [{ "livroId": 59, "capituloInicio": 1, "capituloFim": 5 }],
   *   "repeticoes": 30,
   *   "inicio": "2026-08-13"
   * }
   *
   * Fica em jsonb porque é a receita que gerou o cronograma, não o cronograma:
   * o que o aluno marca são as linhas de `ensino_leitura_itens`. Guardar a
   * receita permite recalcular se o prazo mudar.
   */
  leitura   jsonb,

  criado_por   uuid references public.profiles(id) on delete set null,
  criado_em    timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists ensino_atividades_turma_idx
  on public.ensino_atividades (turma_id, ordem, criado_em);

-- ---------------------------------------------------------------------------
-- Seções — o "texto com imagem e vídeo antes de cada pergunta"
-- ---------------------------------------------------------------------------
-- Mesma ideia de `evento_secoes`: a ordem da página é dado, não JSX, porque
-- quem monta a atividade quer arrastar um bloco explicativo para antes da
-- pergunta 3 sem pedir nada a ninguém.

create table if not exists public.ensino_atividade_secoes (
  id           uuid primary key default gen_random_uuid(),
  atividade_id uuid not null references public.ensino_atividades(id) on delete cascade,
  tipo         text not null check (tipo in ('texto', 'imagem', 'video', 'perguntas')),
  titulo       text,
  -- Texto rico do bloco explicativo.
  conteudo     text,
  midia_url    text,
  video_url    text,
  ordem        int not null default 0,
  criado_em    timestamptz not null default now()
);

create index if not exists ensino_atividade_secoes_atividade_idx
  on public.ensino_atividade_secoes (atividade_id, ordem);

-- ---------------------------------------------------------------------------
-- Perguntas
-- ---------------------------------------------------------------------------

create table if not exists public.ensino_atividade_perguntas (
  id           uuid primary key default gen_random_uuid(),
  atividade_id uuid not null references public.ensino_atividades(id) on delete cascade,
  -- Nulo = pergunta solta, fora de qualquer bloco. `set null` para que apagar
  -- um bloco explicativo não leve junto as perguntas que vinham depois dele.
  secao_id     uuid references public.ensino_atividade_secoes(id) on delete set null,

  ordem        int not null default 0,
  enunciado    text not null,
  -- 'unica' e 'multipla' o app corrige sozinho; 'texto' e 'longo' esperam o
  -- professor. É esta distinção que decide se a entrega já nasce corrigida.
  tipo         text not null check (tipo in ('unica', 'multipla', 'texto', 'longo')),

  /** [{ "id": "a", "texto": "...", "correta": true }] — só nas de marcar. */
  opcoes       jsonb not null default '[]'::jsonb,
  -- Gabarito da dissertativa: o que o professor espera ler. Nunca vai para a
  -- tela do aluno antes da correção.
  resposta_esperada text,

  pontos       numeric(5,2) not null default 1,
  obrigatoria  boolean not null default true,

  -- A ilustração da pergunta. Imagem sai do bucket de capas, vídeo é link.
  midia_url    text,
  midia_tipo   text check (midia_tipo in ('imagem', 'video')),

  criado_em    timestamptz not null default now()
);

create index if not exists ensino_atividade_perguntas_atividade_idx
  on public.ensino_atividade_perguntas (atividade_id, ordem);

-- ---------------------------------------------------------------------------
-- Entrega — uma por aluno por atividade
-- ---------------------------------------------------------------------------

create table if not exists public.ensino_atividade_entregas (
  id           uuid primary key default gen_random_uuid(),
  atividade_id uuid not null references public.ensino_atividades(id) on delete cascade,
  inscricao_id uuid not null references public.ensino_inscricoes(id) on delete cascade,
  unique (atividade_id, inscricao_id),

  status      text not null default 'pendente'
              check (status in ('pendente', 'entregue', 'corrigida')),
  -- O "marcar feito" da tarefa simples. Separado de `status` porque na leitura
  -- ele é consequência do checklist, e não um botão.
  concluida   boolean not null default false,
  -- O comentário que o aluno deixa junto — "li, mas travei no capítulo 3".
  comentario  text,

  nota        numeric(5,2),
  -- A devolutiva do professor, que o aluno lê depois de corrigido.
  observacao  text,

  entregue_em   timestamptz,
  corrigida_em  timestamptz,
  corrigida_por uuid references public.profiles(id) on delete set null,
  atualizado_em timestamptz not null default now()
);

create index if not exists ensino_atividade_entregas_atividade_idx
  on public.ensino_atividade_entregas (atividade_id, status);
create index if not exists ensino_atividade_entregas_inscricao_idx
  on public.ensino_atividade_entregas (inscricao_id);

-- ---------------------------------------------------------------------------
-- Respostas do quiz
-- ---------------------------------------------------------------------------

create table if not exists public.ensino_atividade_respostas (
  id          uuid primary key default gen_random_uuid(),
  entrega_id  uuid not null references public.ensino_atividade_entregas(id) on delete cascade,
  pergunta_id uuid not null references public.ensino_atividade_perguntas(id) on delete cascade,
  unique (entrega_id, pergunta_id),

  /** Ids das opções marcadas. Array mesmo na de resposta única. */
  opcoes      jsonb not null default '[]'::jsonb,
  texto       text,

  -- Nulo na dissertativa ainda não corrigida — e é justamente esse nulo que
  -- diz ao painel que a prova espera o professor.
  correta     boolean,
  pontos      numeric(5,2),

  atualizado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Cronograma de leitura
-- ---------------------------------------------------------------------------
-- Uma linha por unidade que o aluno marca. É por aluno, e não por atividade,
-- porque quem entra na turma no meio do desafio recebe o cronograma recalculado
-- a partir do dia em que entrou — o prazo é o mesmo, os dias restantes não.

create table if not exists public.ensino_leitura_itens (
  id           uuid primary key default gen_random_uuid(),
  atividade_id uuid not null references public.ensino_atividades(id) on delete cascade,
  inscricao_id uuid not null references public.ensino_inscricoes(id) on delete cascade,

  ordem        int not null,
  -- "Tiago 1-2" pronto para a tela. Montado na criação porque a linha precisa
  -- se explicar sozinha na lista, sem juntar com `biblia_livros`.
  rotulo       text not null,
  livro_id     smallint references public.biblia_livros(id) on delete set null,
  capitulo_inicio smallint,
  capitulo_fim    smallint,
  -- Em qual das 30 voltas esta linha está. 1 quando não há repetição.
  rodada       smallint not null default 1,

  data_prevista date,
  feito        boolean not null default false,
  feito_em     timestamptz,

  unique (atividade_id, inscricao_id, ordem)
);

create index if not exists ensino_leitura_itens_aluno_idx
  on public.ensino_leitura_itens (atividade_id, inscricao_id, ordem);

-- ---------------------------------------------------------------------------
-- Funções de permissão
-- ---------------------------------------------------------------------------
-- Vêm depois das tabelas porque o corpo de uma função `language sql` é
-- validado já na criação — mesma razão de `ensino.sql`.

-- Quem administra a turma da atividade.
create or replace function public.ensino_atividade_leciona(p_atividade_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.ensino_atividades a
    where a.id = p_atividade_id and public.ensino_leciona(a.turma_id)
  )
$$;

-- Quem pode abrir a atividade: o professor sempre, o aluno só depois de
-- publicada. Rascunho não vaza para a turma.
create or replace function public.ensino_atividade_visivel(p_atividade_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.ensino_atividades a
    where a.id = p_atividade_id
      and (
        public.ensino_leciona(a.turma_id)
        or (a.publicada and public.ensino_inscrito(a.turma_id))
      )
  )
$$;

-- A inscrição é minha. É o que separa a entrega do aluno da do colega.
create or replace function public.ensino_minha_inscricao(p_inscricao_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.ensino_inscricoes i
    where i.id = p_inscricao_id and i.user_id = auth.uid()
  )
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.ensino_atividades          enable row level security;
alter table public.ensino_atividade_secoes    enable row level security;
alter table public.ensino_atividade_perguntas enable row level security;
alter table public.ensino_atividade_entregas  enable row level security;
alter table public.ensino_atividade_respostas enable row level security;
alter table public.ensino_leitura_itens       enable row level security;

drop policy if exists "ensino_atividades_select"  on public.ensino_atividades;
drop policy if exists "ensino_atividades_all"     on public.ensino_atividades;
drop policy if exists "ensino_atv_secoes_select"  on public.ensino_atividade_secoes;
drop policy if exists "ensino_atv_secoes_all"     on public.ensino_atividade_secoes;
drop policy if exists "ensino_atv_perguntas_select" on public.ensino_atividade_perguntas;
drop policy if exists "ensino_atv_perguntas_all"   on public.ensino_atividade_perguntas;
drop policy if exists "ensino_atv_entregas_select" on public.ensino_atividade_entregas;
drop policy if exists "ensino_atv_entregas_update" on public.ensino_atividade_entregas;
drop policy if exists "ensino_atv_entregas_insert" on public.ensino_atividade_entregas;
drop policy if exists "ensino_atv_entregas_delete" on public.ensino_atividade_entregas;
drop policy if exists "ensino_atv_respostas_all"   on public.ensino_atividade_respostas;
drop policy if exists "ensino_leitura_select"      on public.ensino_leitura_itens;
drop policy if exists "ensino_leitura_update"      on public.ensino_leitura_itens;
drop policy if exists "ensino_leitura_escrita"     on public.ensino_leitura_itens;

-- A atividade: o aluno da turma vê a publicada, o professor vê tudo.
create policy "ensino_atividades_select" on public.ensino_atividades
  for select to authenticated
  using (
    public.ensino_leciona(turma_id)
    or (publicada and public.ensino_inscrito(turma_id))
  );

create policy "ensino_atividades_all" on public.ensino_atividades
  for all to authenticated
  using (public.ensino_leciona(turma_id))
  with check (public.ensino_leciona(turma_id));

-- Seções e perguntas herdam a visibilidade da atividade.
create policy "ensino_atv_secoes_select" on public.ensino_atividade_secoes
  for select to authenticated using (public.ensino_atividade_visivel(atividade_id));

create policy "ensino_atv_secoes_all" on public.ensino_atividade_secoes
  for all to authenticated
  using (public.ensino_atividade_leciona(atividade_id))
  with check (public.ensino_atividade_leciona(atividade_id));

/**
 * O gabarito e a RLS.
 *
 * `opcoes` traz o campo `correta`, e `resposta_esperada` é o que o professor
 * espera ler — os dois no mesmo registro que o aluno precisa ler para
 * responder. Nenhuma policy de linha resolve isso, porque o problema é de
 * coluna: a linha inteira é legítima, uma parte dela não.
 *
 * Por isso a tela do aluno nunca consulta esta tabela direto. Ela passa pela
 * server action, que devolve a pergunta sem gabarito. A policy de leitura
 * fica restrita a quem leciona, e é o que garante que uma consulta esperta do
 * cliente não contorne a action.
 */
create policy "ensino_atv_perguntas_select" on public.ensino_atividade_perguntas
  for select to authenticated using (public.ensino_atividade_leciona(atividade_id));

create policy "ensino_atv_perguntas_all" on public.ensino_atividade_perguntas
  for all to authenticated
  using (public.ensino_atividade_leciona(atividade_id))
  with check (public.ensino_atividade_leciona(atividade_id));

-- A entrega: minha, ou de quem eu leciono.
create policy "ensino_atv_entregas_select" on public.ensino_atividade_entregas
  for select to authenticated
  using (
    public.ensino_minha_inscricao(inscricao_id)
    or public.ensino_atividade_leciona(atividade_id)
  );

create policy "ensino_atv_entregas_insert" on public.ensino_atividade_entregas
  for insert to authenticated
  with check (
    (public.ensino_minha_inscricao(inscricao_id) and public.ensino_atividade_visivel(atividade_id))
    or public.ensino_atividade_leciona(atividade_id)
  );

-- O aluno mexe na própria entrega; a nota e a devolutiva a action grava com o
-- cliente admin depois de conferir que quem chamou leciona.
create policy "ensino_atv_entregas_update" on public.ensino_atividade_entregas
  for update to authenticated
  using (
    public.ensino_minha_inscricao(inscricao_id)
    or public.ensino_atividade_leciona(atividade_id)
  );

create policy "ensino_atv_entregas_delete" on public.ensino_atividade_entregas
  for delete to authenticated using (public.ensino_atividade_leciona(atividade_id));

-- A resposta segue a entrega a que pertence.
create policy "ensino_atv_respostas_all" on public.ensino_atividade_respostas
  for all to authenticated
  using (
    exists (
      select 1 from public.ensino_atividade_entregas e
      where e.id = entrega_id
        and (
          public.ensino_minha_inscricao(e.inscricao_id)
          or public.ensino_atividade_leciona(e.atividade_id)
        )
    )
  )
  with check (
    exists (
      select 1 from public.ensino_atividade_entregas e
      where e.id = entrega_id
        and (
          public.ensino_minha_inscricao(e.inscricao_id)
          or public.ensino_atividade_leciona(e.atividade_id)
        )
    )
  );

-- O cronograma: cada um vê e marca o seu; o professor vê o de todos para
-- acompanhar quem está em dia.
create policy "ensino_leitura_select" on public.ensino_leitura_itens
  for select to authenticated
  using (
    public.ensino_minha_inscricao(inscricao_id)
    or public.ensino_atividade_leciona(atividade_id)
  );

create policy "ensino_leitura_update" on public.ensino_leitura_itens
  for update to authenticated
  using (
    public.ensino_minha_inscricao(inscricao_id)
    or public.ensino_atividade_leciona(atividade_id)
  );

-- Gerar e apagar o cronograma é do professor: as linhas nascem em lote quando
-- a atividade é publicada.
create policy "ensino_leitura_escrita" on public.ensino_leitura_itens
  for all to authenticated
  using (public.ensino_atividade_leciona(atividade_id))
  with check (public.ensino_atividade_leciona(atividade_id));
