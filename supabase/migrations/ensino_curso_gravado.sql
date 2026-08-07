-- ============================================================================
-- Curso gravado
--
-- Uma turma passa a poder ser catálogo em vez de encontro semanal: a pessoa
-- entra, assiste na ordem, no ritmo dela. Tudo aditivo — `modo` nasce
-- 'presencial', então nenhuma turma existente muda de comportamento.
-- ============================================================================

alter table public.ensino_turmas
  add column if not exists modo text not null default 'presencial'
    check (modo in ('presencial', 'gravado')),
  -- A aula N só abre com a N-1 concluída. Serve a discipulado, atrapalha em
  -- curso de consulta; por isso é chave por turma, e não regra do módulo.
  add column if not exists sequencial boolean not null default false;

-- ---------------------------------------------------------------------------
-- Progresso — o "assisti" do aluno.
--
-- Não dá para reaproveitar `ensino_presencas`: lá quem escreve é o professor
-- (não existe policy de insert para o aluno, de propósito), e presença marcada
-- por si mesmo não é presença. São dois fatos diferentes sobre a mesma aula.
--
-- `turma_id` é repetido a partir da aula para que as policies filtrem sem
-- subconsulta, como já acontece em `ensino_presencas.user_id`.
-- ---------------------------------------------------------------------------

create table if not exists public.ensino_progresso (
  aula_id      uuid not null references public.ensino_aulas(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  turma_id     uuid not null references public.ensino_turmas(id) on delete cascade,
  concluida_em timestamptz not null default now(),
  primary key (aula_id, user_id)
);

create index if not exists ensino_progresso_user_turma_idx
  on public.ensino_progresso(user_id, turma_id);

alter table public.ensino_progresso enable row level security;

-- O aluno lê o próprio progresso; quem leciona lê o da turma inteira, que é o
-- acompanhamento de quem está assistindo e quem parou.
drop policy if exists "ensino_progresso_select" on public.ensino_progresso;
create policy "ensino_progresso_select" on public.ensino_progresso
  for select to authenticated
  using (user_id = auth.uid() or public.ensino_leciona(turma_id));

-- Só dá para marcar aula própria, e só estando inscrito: sem isso qualquer
-- autenticado gravaria progresso em turma que nunca cursou.
drop policy if exists "ensino_progresso_insert" on public.ensino_progresso;
create policy "ensino_progresso_insert" on public.ensino_progresso
  for insert to authenticated
  with check (user_id = auth.uid() and public.ensino_inscrito(turma_id));

-- Desmarcar é do aluno; o professor pode limpar em caso de engano.
drop policy if exists "ensino_progresso_delete" on public.ensino_progresso;
create policy "ensino_progresso_delete" on public.ensino_progresso
  for delete to authenticated
  using (user_id = auth.uid() or public.ensino_leciona(turma_id));
