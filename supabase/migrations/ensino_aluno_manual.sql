-- ============================================================================
-- Aluno cadastrado pelo professor
--
-- Até aqui toda inscrição nascia de alguém logado se inscrevendo: `user_id` era
-- obrigatório. Só que boa parte da turma não usa o app, e o professor chega com
-- a lista no papel. Este arquivo abre a segunda via — a inscrição sem conta.
--
-- A pessoa entra como `membros_pre_cadastro` da igreja, e não como registro
-- solto do Ensino: é a mesma fila que o onboarding já consulta para reconhecer
-- quem chega pelo e-mail, e a mesma que `/pendencias` mostra para vincular à
-- mão. Quando ela criar a conta, o vínculo preenche o `user_id` das inscrições
-- e das presenças que o professor já tinha lançado — o histórico de chamada
-- feito antes do cadastro não se perde.
-- ============================================================================

-- Sem conta, sem `user_id`. A unicidade `(turma_id, user_id)` continua valendo
-- para quem tem perfil: no Postgres nulos são distintos entre si, então vários
-- alunos manuais convivem na mesma turma sem colidir.
alter table public.ensino_inscricoes
  alter column user_id drop not null;

alter table public.ensino_inscricoes
  add column if not exists origem text not null default 'app',
  add column if not exists pre_cadastro_id uuid
    references public.membros_pre_cadastro(id) on delete set null;

alter table public.ensino_inscricoes
  drop constraint if exists ensino_inscricoes_origem_check;
alter table public.ensino_inscricoes
  add constraint ensino_inscricoes_origem_check
  check (origem in ('app', 'manual'));

-- A presença herda o `user_id` da inscrição, então ela também precisa aceitar
-- nulo — senão a chamada do aluno manual não grava.
alter table public.ensino_presencas
  alter column user_id drop not null;

create index if not exists ensino_inscricoes_pre_cadastro_idx
  on public.ensino_inscricoes(pre_cadastro_id)
  where pre_cadastro_id is not null;

-- O que impede a mesma pessoa de virar duas linhas na turma enquanto ainda não
-- tem perfil. É o par da unicidade `(turma_id, user_id)`, do outro lado.
create unique index if not exists ensino_inscricoes_turma_pre_uidx
  on public.ensino_inscricoes(turma_id, pre_cadastro_id)
  where pre_cadastro_id is not null;

-- A policy antiga (`user_id = auth.uid()`) só permitia inscrever a si mesmo.
-- Quem leciona passa a poder inscrever outra pessoa naquela turma — e só nela.
drop policy if exists "ensino_inscricoes_insert_professor" on public.ensino_inscricoes;
create policy "ensino_inscricoes_insert_professor" on public.ensino_inscricoes
  for insert to authenticated
  with check (public.ensino_leciona(turma_id));
