-- Professor que ainda não tem conta no app.
--
-- Mesma realidade que criou o aluno manual (`ensino_aluno_manual.sql`): a turma
-- é montada antes de a pessoa entrar no app, e exigir cadastro dela para pôr o
-- nome na turma trava o trabalho de quem está organizando. A pessoa é gravada
-- em `membros_pre_cadastro` — a lista da igreja inteira, não uma tabela do
-- Ensino — e a turma aponta para lá enquanto não houver perfil.
--
-- Sem conta não há acesso: `ensino_leciona` compara `profile_id` com
-- `auth.uid()`, e uma linha de pré-cadastro nunca casa. O nome aparece na
-- página da turma, e nada mais. No dia em que a pessoa criar a conta,
-- `vincularProfessoresEnsino` troca o pré-cadastro pelo perfil e aí sim ela
-- passa a administrar a turma.

alter table public.ensino_turma_professores
  add column if not exists pre_cadastro_id uuid
    references public.membros_pre_cadastro(id) on delete cascade;

-- A chave era `(turma_id, profile_id)`, e coluna de chave primária não aceita
-- nulo. Vira chave própria, com a unicidade de cada lado garantida por índice
-- parcial — o que também impede a mesma pessoa entrar duas vezes na turma.
alter table public.ensino_turma_professores
  add column if not exists id uuid not null default gen_random_uuid();

alter table public.ensino_turma_professores
  drop constraint if exists ensino_turma_professores_pkey;

alter table public.ensino_turma_professores
  alter column profile_id drop not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'ensino_turma_professores_pk'
  ) then
    alter table public.ensino_turma_professores
      add constraint ensino_turma_professores_pk primary key (id);
  end if;
end;
$$;

create unique index if not exists ensino_turma_prof_perfil_unico
  on public.ensino_turma_professores (turma_id, profile_id)
  where profile_id is not null;

create unique index if not exists ensino_turma_prof_pre_unico
  on public.ensino_turma_professores (turma_id, pre_cadastro_id)
  where pre_cadastro_id is not null;

-- Uma pessoa por linha: as duas colunas preenchidas seriam duas identidades
-- para o mesmo professor, e nenhuma delas deixaria a linha sem dono.
alter table public.ensino_turma_professores
  drop constraint if exists ensino_turma_prof_uma_pessoa;

alter table public.ensino_turma_professores
  add constraint ensino_turma_prof_uma_pessoa
  check (num_nonnulls(profile_id, pre_cadastro_id) = 1);

create index if not exists ensino_turma_prof_pre_idx
  on public.ensino_turma_professores(pre_cadastro_id);
