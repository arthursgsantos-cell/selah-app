-- ============================================================
-- SUPERVISÕES – a reunião do supervisor com o líder
-- ============================================================
-- Hoje isso vive no caderno do supervisor. Registrar aqui resolve duas
-- coisas de uma vez: o histórico do que foi combinado, e a resposta para
-- "faz quanto tempo que ninguém senta com esse líder?" — que é o que
-- alimenta o painel de saúde da rede.
--
-- `celula_id` nulo significa reunião da rede inteira, não de uma célula.

create table if not exists public.supervisoes (
  id              uuid primary key default gen_random_uuid(),
  rede_id         uuid not null references public.redes(id) on delete cascade,
  celula_id       uuid references public.celulas(id) on delete cascade,
  supervisor_id   uuid references public.profiles(id) on delete set null,
  data            date not null default current_date,
  pauta           text,
  encaminhamentos text,
  criado_por      uuid references public.profiles(id) on delete set null,
  criado_em       timestamptz not null default now()
);

create index if not exists supervisoes_rede_idx   on public.supervisoes (rede_id, data desc);
create index if not exists supervisoes_celula_idx on public.supervisoes (celula_id, data desc);

-- Quem veio e quem faltou. A ausência é informação: é ela que aparece no
-- painel quando um líder some de três supervisões seguidas.
create table if not exists public.supervisao_participantes (
  supervisao_id uuid not null references public.supervisoes(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  presente      boolean not null default true,
  primary key (supervisao_id, user_id)
);

-- ============================================================
-- PERMISSÃO
-- ============================================================

create or replace function public.supervisiona_rede(p_rede_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('pastor', 'admin')
    )
    or exists (
      select 1 from public.rede_supervisores rs
      where rs.rede_id = p_rede_id and rs.supervisor_id = auth.uid()
    )
$$;

alter table public.supervisoes              enable row level security;
alter table public.supervisao_participantes enable row level security;

drop policy if exists "supervisoes_select" on public.supervisoes;
drop policy if exists "supervisoes_insert" on public.supervisoes;
drop policy if exists "supervisoes_update" on public.supervisoes;
drop policy if exists "supervisoes_delete" on public.supervisoes;

-- O líder supervisionado enxerga o registro da própria célula: o combinado
-- não é segredo de quem combinou.
create policy "supervisoes_select" on public.supervisoes
  for select to authenticated
  using (
    public.supervisiona_rede(rede_id)
    or exists (
      select 1 from public.celula_membros cm
      where cm.celula_id = supervisoes.celula_id
        and cm.user_id = auth.uid()
        and cm.papel = 'lider'
    )
  );

create policy "supervisoes_insert" on public.supervisoes
  for insert to authenticated
  with check (public.supervisiona_rede(rede_id));

create policy "supervisoes_update" on public.supervisoes
  for update to authenticated
  using (public.supervisiona_rede(rede_id));

create policy "supervisoes_delete" on public.supervisoes
  for delete to authenticated
  using (public.supervisiona_rede(rede_id));

drop policy if exists "supervisao_participantes_select" on public.supervisao_participantes;
drop policy if exists "supervisao_participantes_all"    on public.supervisao_participantes;

create policy "supervisao_participantes_select" on public.supervisao_participantes
  for select to authenticated
  using (exists (
    select 1 from public.supervisoes s
    where s.id = supervisao_id
      and (
        public.supervisiona_rede(s.rede_id)
        or exists (
          select 1 from public.celula_membros cm
          where cm.celula_id = s.celula_id
            and cm.user_id = auth.uid()
            and cm.papel = 'lider'
        )
      )
  ));

create policy "supervisao_participantes_all" on public.supervisao_participantes
  for all to authenticated
  using (exists (
    select 1 from public.supervisoes s
    where s.id = supervisao_id and public.supervisiona_rede(s.rede_id)
  ))
  with check (exists (
    select 1 from public.supervisoes s
    where s.id = supervisao_id and public.supervisiona_rede(s.rede_id)
  ));
