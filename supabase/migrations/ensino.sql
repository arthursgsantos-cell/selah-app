-- ============================================================================
-- Módulo de Ensino
--
-- Cursos, turmas, inscrições, chamada e materiais da Escola Bíblica.
-- Tudo com o prefixo `ensino_` e RLS ligada desde o início: nenhuma tabela
-- existente é alterada, e o módulo não herda a exposição das tabelas antigas.
--
-- O papel de professor NÃO entra no enum `Role`. `ROLE_ORDER` no app compara
-- cargos por hierarquia (membro < líder < supervisor < pastor), e professor não
-- se encaixa nessa escada — um membro comum pode dar aula. Vive em
-- `ensino_equipe`, à parte.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Equipe do Ensino
-- ---------------------------------------------------------------------------

create table if not exists public.ensino_equipe (
  igreja_id  uuid not null references public.igrejas(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  papel      text not null default 'professor'
    check (papel in ('professor', 'coordenador')),
  criado_em  timestamptz not null default now(),
  primary key (igreja_id, profile_id)
);

-- ---------------------------------------------------------------------------
-- Cursos — o catálogo. "Fundamentos da Fé", "Toda Escritura".
-- ---------------------------------------------------------------------------

create table if not exists public.ensino_cursos (
  id         uuid primary key default gen_random_uuid(),
  igreja_id  uuid not null references public.igrejas(id) on delete cascade,
  nome       text not null,
  descricao  text,
  capa_url   text,
  ativo      boolean not null default true,
  ordem      integer not null default 0,
  criado_por uuid references public.profiles(id) on delete set null,
  criado_em  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Turmas — a oferta de um curso num período.
--
-- `igreja_id` é repetido aqui, e não só em `ensino_cursos`, para que as policies
-- filtrem a igreja sem um join a cada linha.
-- ---------------------------------------------------------------------------

create table if not exists public.ensino_turmas (
  id                   uuid primary key default gen_random_uuid(),
  curso_id             uuid not null references public.ensino_cursos(id) on delete cascade,
  igreja_id            uuid not null references public.igrejas(id) on delete cascade,
  nome                 text not null,
  descricao            text,
  capa_url             text,
  local                text,
  data_inicio          date,
  data_fim             date,
  -- 0=domingo … 6=sábado, a mesma convenção de `celulas.dia_semana`.
  dias_semana          smallint[] not null default '{}',
  horario_inicio       time,
  horario_fim          time,
  total_aulas          integer,
  -- null = sem limite de vagas.
  vagas                integer,
  inscricoes_abertas   boolean not null default true,
  aprovacao_automatica boolean not null default true,
  status               text not null default 'aberta'
    check (status in ('aberta', 'em_andamento', 'concluida', 'cancelada')),
  -- Entra no carrossel de destaques da home, junto com os eventos destacados.
  destaque             boolean not null default false,
  whatsapp_url         text,
  -- Como a pessoa se inscreve. `app` usa só os dados do perfil; `formulario`
  -- acrescenta os campos de `formulario_id`; `link` e `whatsapp` mandam a
  -- pessoa para fora, e nesses dois o app não acompanha quem se inscreveu.
  tipo_inscricao       text not null default 'app'
    check (tipo_inscricao in ('app', 'formulario', 'link', 'whatsapp')),
  link_inscricao_url   text,
  whatsapp_inscricao   text,
  -- Campos extras da inscrição, reaproveitando o construtor de formulários
  -- que os eventos já usam. Null = só os dados do perfil.
  formulario_id        uuid references public.formularios(id) on delete set null,
  criado_por           uuid references public.profiles(id) on delete set null,
  criado_em            timestamptz not null default now(),
  atualizado_em        timestamptz not null default now()
);

create table if not exists public.ensino_turma_professores (
  turma_id   uuid not null references public.ensino_turmas(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  -- O principal é quem aparece como "professor" na página da turma.
  principal  boolean not null default false,
  criado_em  timestamptz not null default now(),
  primary key (turma_id, profile_id)
);

-- ---------------------------------------------------------------------------
-- Inscrições
--
-- `nome` e `telefone` são cópia do perfil no momento da inscrição: o professor
-- precisa da lista como ela estava, e o aluno pode trocar o telefone depois.
-- ---------------------------------------------------------------------------

create table if not exists public.ensino_inscricoes (
  id            uuid primary key default gen_random_uuid(),
  turma_id      uuid not null references public.ensino_turmas(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  nome          text not null,
  telefone      text,
  email         text,
  dados         jsonb not null default '{}',
  status        text not null default 'pendente'
    check (status in ('pendente', 'aprovada', 'recusada', 'cancelada', 'concluida')),
  observacao    text,
  decidido_por  uuid references public.profiles(id) on delete set null,
  decidido_em   timestamptz,
  criado_em     timestamptz not null default now(),
  -- Uma inscrição por pessoa por turma. É o que impede o clique duplo de
  -- virar duas linhas na lista de chamada.
  unique (turma_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Aulas
-- ---------------------------------------------------------------------------

create table if not exists public.ensino_aulas (
  id        uuid primary key default gen_random_uuid(),
  turma_id  uuid not null references public.ensino_turmas(id) on delete cascade,
  numero    integer not null,
  titulo    text,
  descricao text,
  -- `date`, não `timestamptz`: a aula acontece num dia do calendário de Natal.
  -- Guardar instante UTC faria a aula das 19h30 cair no dia seguinte.
  data      date not null,
  hora_inicio time,
  local     text,
  status    text not null default 'agendada'
    check (status in ('agendada', 'realizada', 'cancelada')),
  criado_em timestamptz not null default now(),
  unique (turma_id, numero)
);

-- ---------------------------------------------------------------------------
-- Presenças
--
-- A unicidade por (aula, inscrição) é o que torna a chamada idempotente: o
-- salvamento automático faz upsert, então clicar duas vezes corrige em vez de
-- duplicar.
-- ---------------------------------------------------------------------------

create table if not exists public.ensino_presencas (
  id            uuid primary key default gen_random_uuid(),
  aula_id       uuid not null references public.ensino_aulas(id) on delete cascade,
  inscricao_id  uuid not null references public.ensino_inscricoes(id) on delete cascade,
  -- Repetido a partir da inscrição para que a policy do aluno ("vejo só a minha
  -- presença") não precise de subconsulta.
  user_id       uuid not null references public.profiles(id) on delete cascade,
  presente      boolean not null default false,
  observacao    text,
  registrado_por uuid references public.profiles(id) on delete set null,
  registrado_em  timestamptz not null default now(),
  unique (aula_id, inscricao_id)
);

-- ---------------------------------------------------------------------------
-- Materiais
--
-- `arquivo_path` aponta para o bucket privado `ensino-materiais`; `url` guarda
-- link externo (Drive, YouTube). Um dos dois é preenchido.
-- ---------------------------------------------------------------------------

create table if not exists public.ensino_materiais (
  id            uuid primary key default gen_random_uuid(),
  turma_id      uuid not null references public.ensino_turmas(id) on delete cascade,
  -- Null = material da turma inteira, não de uma aula específica.
  aula_id       uuid references public.ensino_aulas(id) on delete set null,
  titulo        text not null,
  descricao     text,
  tipo          text not null default 'arquivo'
    check (tipo in ('arquivo', 'link', 'video')),
  url           text,
  arquivo_path  text,
  arquivo_nome  text,
  arquivo_tamanho bigint,
  -- Materiais são privados por padrão. `publico` é a exceção deliberada, para
  -- quando o coordenador quiser deixar uma apostila aberta na página do curso.
  publico       boolean not null default false,
  ordem         integer not null default 0,
  criado_por    uuid references public.profiles(id) on delete set null,
  criado_em     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Funções de permissão
--
-- SECURITY DEFINER porque são chamadas de dentro das policies: precisam
-- enxergar as tabelas sem disparar a RLS que estão ajudando a avaliar.
-- Vêm depois das tabelas porque o corpo de uma função `language sql` é
-- validado já na criação.
-- ---------------------------------------------------------------------------

-- Coordenador do Ensino. Pastor e admin entram aqui sem precisar de cadastro.
create or replace function public.ensino_e_coordenador()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('pastor', 'admin')
  ) or exists (
    select 1 from public.ensino_equipe e
    where e.profile_id = auth.uid() and e.papel = 'coordenador'
  )
$$;

-- Qualquer um da equipe do Ensino. Todo coordenador também é professor.
create or replace function public.ensino_e_professor()
returns boolean
language sql stable security definer set search_path = public as $$
  select public.ensino_e_coordenador() or exists (
    select 1 from public.ensino_equipe e where e.profile_id = auth.uid()
  )
$$;

-- Professor daquela turma específica. É esta que separa "professor" de
-- "professor com poder sobre esta turma".
create or replace function public.ensino_leciona(p_turma_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select public.ensino_e_coordenador() or exists (
    select 1 from public.ensino_turma_professores tp
    where tp.turma_id = p_turma_id and tp.profile_id = auth.uid()
  )
$$;

-- Aluno com inscrição aprovada. É o que libera materiais e histórico.
create or replace function public.ensino_inscrito(p_turma_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.ensino_inscricoes i
    where i.turma_id = p_turma_id
      and i.user_id = auth.uid()
      and i.status in ('aprovada', 'concluida')
  )
$$;

-- ---------------------------------------------------------------------------
-- Índices
-- ---------------------------------------------------------------------------

create index if not exists ensino_cursos_igreja_idx        on public.ensino_cursos(igreja_id);
create index if not exists ensino_turmas_curso_idx         on public.ensino_turmas(curso_id);
create index if not exists ensino_turmas_igreja_idx        on public.ensino_turmas(igreja_id);
create index if not exists ensino_turma_prof_profile_idx   on public.ensino_turma_professores(profile_id);
create index if not exists ensino_inscricoes_turma_idx     on public.ensino_inscricoes(turma_id);
create index if not exists ensino_inscricoes_user_idx      on public.ensino_inscricoes(user_id);
create index if not exists ensino_aulas_turma_idx          on public.ensino_aulas(turma_id, data);
create index if not exists ensino_presencas_aula_idx       on public.ensino_presencas(aula_id);
create index if not exists ensino_presencas_user_idx       on public.ensino_presencas(user_id);
create index if not exists ensino_materiais_turma_idx      on public.ensino_materiais(turma_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.ensino_equipe             enable row level security;
alter table public.ensino_cursos             enable row level security;
alter table public.ensino_turmas             enable row level security;
alter table public.ensino_turma_professores  enable row level security;
alter table public.ensino_inscricoes         enable row level security;
alter table public.ensino_aulas              enable row level security;
alter table public.ensino_presencas          enable row level security;
alter table public.ensino_materiais          enable row level security;

-- Equipe: todos da igreja veem quem é professor (o nome aparece na turma);
-- só coordenador altera.
create policy "ensino_equipe_select" on public.ensino_equipe
  for select to authenticated using (igreja_id = public.user_igreja_id());
create policy "ensino_equipe_all" on public.ensino_equipe
  for all to authenticated
  using (public.ensino_e_coordenador() and igreja_id = public.user_igreja_id())
  with check (public.ensino_e_coordenador() and igreja_id = public.user_igreja_id());

-- Cursos: catálogo visível para a igreja; escrita só da equipe.
create policy "ensino_cursos_select" on public.ensino_cursos
  for select to authenticated using (igreja_id = public.user_igreja_id());
create policy "ensino_cursos_insert" on public.ensino_cursos
  for insert to authenticated
  with check (public.ensino_e_professor() and igreja_id = public.user_igreja_id());
create policy "ensino_cursos_update" on public.ensino_cursos
  for update to authenticated
  using (public.ensino_e_professor() and igreja_id = public.user_igreja_id());
create policy "ensino_cursos_delete" on public.ensino_cursos
  for delete to authenticated
  using (public.ensino_e_coordenador() and igreja_id = public.user_igreja_id());

-- Turmas: a vitrine é aberta a quem está logado na igreja — é assim que o
-- aluno descobre o curso para pedir inscrição.
create policy "ensino_turmas_select" on public.ensino_turmas
  for select to authenticated using (igreja_id = public.user_igreja_id());
create policy "ensino_turmas_insert" on public.ensino_turmas
  for insert to authenticated
  with check (public.ensino_e_professor() and igreja_id = public.user_igreja_id());
create policy "ensino_turmas_update" on public.ensino_turmas
  for update to authenticated using (public.ensino_leciona(id));
create policy "ensino_turmas_delete" on public.ensino_turmas
  for delete to authenticated using (public.ensino_e_coordenador());

create policy "ensino_turma_prof_select" on public.ensino_turma_professores
  for select to authenticated using (true);
create policy "ensino_turma_prof_all" on public.ensino_turma_professores
  for all to authenticated
  using (public.ensino_e_coordenador()) with check (public.ensino_e_coordenador());

-- Inscrições: o aluno enxerga só a dele. Sem isso a lista de uma turma
-- exporia telefone e e-mail de todos os colegas.
create policy "ensino_inscricoes_select" on public.ensino_inscricoes
  for select to authenticated
  using (user_id = auth.uid() or public.ensino_leciona(turma_id));

-- Só dá para se inscrever em nome próprio.
create policy "ensino_inscricoes_insert" on public.ensino_inscricoes
  for insert to authenticated with check (user_id = auth.uid());

-- O aluno pode mexer na própria inscrição (cancelar); o professor decide
-- aprovação. O WITH CHECK impede o aluno de se autoaprovar.
create policy "ensino_inscricoes_update_aluno" on public.ensino_inscricoes
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and status in ('pendente', 'cancelada'));
create policy "ensino_inscricoes_update_professor" on public.ensino_inscricoes
  for update to authenticated using (public.ensino_leciona(turma_id));
create policy "ensino_inscricoes_delete" on public.ensino_inscricoes
  for delete to authenticated
  using (user_id = auth.uid() or public.ensino_leciona(turma_id));

-- Aulas: quem está inscrito vê o calendário; quem leciona edita.
create policy "ensino_aulas_select" on public.ensino_aulas
  for select to authenticated
  using (public.ensino_inscrito(turma_id) or public.ensino_leciona(turma_id));
create policy "ensino_aulas_all" on public.ensino_aulas
  for all to authenticated
  using (public.ensino_leciona(turma_id)) with check (public.ensino_leciona(turma_id));

-- Presenças: o aluno lê a própria e não escreve nenhuma. Não existe policy de
-- insert/update para ele — só a do professor.
create policy "ensino_presencas_select" on public.ensino_presencas
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.ensino_aulas a
      where a.id = aula_id and public.ensino_leciona(a.turma_id)
    )
  );
create policy "ensino_presencas_all" on public.ensino_presencas
  for all to authenticated
  using (
    exists (
      select 1 from public.ensino_aulas a
      where a.id = aula_id and public.ensino_leciona(a.turma_id)
    )
  )
  with check (
    exists (
      select 1 from public.ensino_aulas a
      where a.id = aula_id and public.ensino_leciona(a.turma_id)
    )
  );

-- Materiais: privados por padrão. Quem não está inscrito não lista nem o
-- título — e o arquivo em si mora em bucket privado, então nem a URL vaza.
create policy "ensino_materiais_select" on public.ensino_materiais
  for select to authenticated
  using (publico or public.ensino_inscrito(turma_id) or public.ensino_leciona(turma_id));
create policy "ensino_materiais_all" on public.ensino_materiais
  for all to authenticated
  using (public.ensino_leciona(turma_id)) with check (public.ensino_leciona(turma_id));

-- ---------------------------------------------------------------------------
-- Bucket dos materiais
--
-- Privado, e sem policy para `authenticated`: o download passa sempre pelo
-- route handler /api/ensino/material/[id], que confere a inscrição antes de
-- assinar a URL. Um link direto para o objeto não abre.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit)
values ('ensino-materiais', 'ensino-materiais', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = 52428800;

-- Capas de curso e turma: públicas, como as demais capas do app.
insert into storage.buckets (id, name, public)
values ('ensino-capas', 'ensino-capas', true)
on conflict (id) do nothing;

drop policy if exists "ensino_capas_leitura" on storage.objects;
create policy "ensino_capas_leitura" on storage.objects
  for select to public using (bucket_id = 'ensino-capas');

drop policy if exists "ensino_capas_escrita" on storage.objects;
create policy "ensino_capas_escrita" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'ensino-capas' and public.ensino_e_professor());
