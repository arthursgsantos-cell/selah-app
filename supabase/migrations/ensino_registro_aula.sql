-- ============================================================
-- REGISTRO DA AULA — as fotos do dia
-- ============================================================
-- Hoje a foto do encontro entra como material do tipo arquivo ("Registro - 1º
-- Encontro"), no meio do PDF do cronograma e do link do testemunho. Funciona,
-- mas mistura duas coisas diferentes: material é o que o aluno estuda, e
-- registro é a memória de que a turma aconteceu.
--
-- Separando, o registro ganha o que material não tem — uma galeria com as
-- tags de curso, turma e data, igual à galeria da comunidade.
--
-- `aula_id` é opcional: nem toda foto pertence a uma aula específica (a
-- confraternização do fim do curso, a foto da turma inteira). Sem ela, a foto
-- é da turma.

create table if not exists public.ensino_aula_fotos (
  id         uuid primary key default gen_random_uuid(),
  turma_id   uuid not null references public.ensino_turmas(id) on delete cascade,
  aula_id    uuid references public.ensino_aulas(id) on delete set null,
  url        text not null,
  legenda    text,
  criado_por uuid references public.profiles(id) on delete set null,
  criado_em  timestamptz not null default now()
);

create index if not exists ensino_aula_fotos_turma_idx
  on public.ensino_aula_fotos (turma_id, criado_em desc);
create index if not exists ensino_aula_fotos_aula_idx
  on public.ensino_aula_fotos (aula_id);

alter table public.ensino_aula_fotos enable row level security;

drop policy if exists "ensino_aula_fotos_select" on public.ensino_aula_fotos;
drop policy if exists "ensino_aula_fotos_all"    on public.ensino_aula_fotos;

-- Quem está na turma vê o registro dela; a equipe do Ensino vê tudo. Mesma
-- régua dos materiais públicos — ver `supabase/migrations/ensino.sql`.
create policy "ensino_aula_fotos_select" on public.ensino_aula_fotos
  for select to authenticated
  using (
    public.ensino_e_coordenador()
    or public.ensino_leciona(turma_id)
    or public.ensino_inscrito(turma_id)
  );

-- Publicar e apagar é de quem administra a turma.
create policy "ensino_aula_fotos_all" on public.ensino_aula_fotos
  for all to authenticated
  using (public.ensino_leciona(turma_id) or public.ensino_e_coordenador())
  with check (public.ensino_leciona(turma_id) or public.ensino_e_coordenador());
