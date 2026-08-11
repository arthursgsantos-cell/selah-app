-- ============================================================
-- CONSOLIDAÇÃO – acompanhamento de quem chegou
-- ============================================================
-- O visitante já era registrado na presença do encontro
-- (`presencas.observacao` guarda os nomes), mas morria ali: virava texto e
-- ninguém mais olhava. Aqui ele vira uma pessoa com responsável, etapa e
-- histórico de contato.
--
-- A pessoa acompanhada normalmente NÃO tem conta no app — por isso `nome` e
-- `telefone` vivem na linha. `profile_id` só é preenchido quando ela se
-- cadastra, e aí a ficha e o perfil passam a apontar um para o outro.

create table if not exists public.consolidacao (
  id             uuid primary key default gen_random_uuid(),
  igreja_id      uuid not null references public.igrejas(id) on delete cascade,
  nome           text not null,
  telefone       text,
  -- Onde a pessoa foi encontrada. `encontro_id` fica preenchido quando a
  -- ficha nasceu de um visitante lançado na presença da célula.
  origem         text not null default 'outro'
                 check (origem in ('culto', 'celula', 'evento', 'indicacao', 'outro')),
  encontro_id    uuid references public.encontros(id) on delete set null,
  -- O que aconteceu no acolhimento. Não é obrigatório: nem toda pessoa
  -- acolhida tomou uma decisão naquele dia.
  decisao        text check (decisao in ('aceitou_jesus', 'reconciliacao', 'visitante')),
  -- Destino e responsável pelo relacionamento.
  celula_id      uuid references public.celulas(id) on delete set null,
  responsavel_id uuid references public.profiles(id) on delete set null,
  profile_id     uuid references public.profiles(id) on delete set null,
  etapa          text not null default 'acolhido'
                 check (etapa in ('acolhido', 'atribuido', 'em_acompanhamento', 'integrado', 'afastado')),
  observacao     text,
  data_acolhimento date not null default current_date,
  criado_por     uuid references public.profiles(id) on delete set null,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

create index if not exists consolidacao_igreja_idx      on public.consolidacao (igreja_id);
create index if not exists consolidacao_celula_idx      on public.consolidacao (celula_id);
create index if not exists consolidacao_responsavel_idx on public.consolidacao (responsavel_id);
create index if not exists consolidacao_etapa_idx       on public.consolidacao (etapa);

-- ============================================================
-- CONTATOS – o que o líder relatou
-- ============================================================
-- Uma linha por tentativa de contato. É daqui que sai o alerta de quem está
-- sem contato há tempo demais: sem linha nova, a ficha esfria sozinha.

create table if not exists public.consolidacao_contatos (
  id              uuid primary key default gen_random_uuid(),
  consolidacao_id uuid not null references public.consolidacao(id) on delete cascade,
  autor_id        uuid references public.profiles(id) on delete set null,
  canal           text not null default 'whatsapp'
                  check (canal in ('whatsapp', 'ligacao', 'presencial', 'outro')),
  resultado       text not null default 'falou'
                  check (resultado in ('falou', 'sem_resposta', 'remarcado')),
  nota            text,
  data            date not null default current_date,
  criado_em       timestamptz not null default now()
);

create index if not exists consolidacao_contatos_ficha_idx
  on public.consolidacao_contatos (consolidacao_id, data desc);

-- ============================================================
-- QUEM ENXERGA A FICHA
-- ============================================================
-- Ficha de consolidação carrega telefone e situação espiritual de alguém que
-- nem conta tem — não é lista aberta à igreja inteira. Enxerga quem tem o
-- vínculo: o responsável, o líder da célula de destino, o supervisor daquela
-- rede e a direção.

create or replace function public.consolidacao_pode(
  p_celula_id uuid,
  p_responsavel_id uuid
) returns boolean
language sql stable security definer
set search_path = public
as $$
  select
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('pastor', 'admin')
    )
    or p_responsavel_id = auth.uid()
    or exists (
      select 1 from public.celula_membros cm
      where cm.celula_id = p_celula_id
        and cm.user_id = auth.uid()
        and cm.papel = 'lider'
    )
    or exists (
      select 1 from public.celulas c
      join public.rede_supervisores rs on rs.rede_id = c.rede_id
      where c.id = p_celula_id and rs.supervisor_id = auth.uid()
    )
$$;

alter table public.consolidacao           enable row level security;
alter table public.consolidacao_contatos  enable row level security;

drop policy if exists "consolidacao_select" on public.consolidacao;
drop policy if exists "consolidacao_insert" on public.consolidacao;
drop policy if exists "consolidacao_update" on public.consolidacao;
drop policy if exists "consolidacao_delete" on public.consolidacao;

create policy "consolidacao_select" on public.consolidacao
  for select to authenticated
  using (
    igreja_id = public.user_igreja_id()
    and public.consolidacao_pode(celula_id, responsavel_id)
  );

-- Acolher é trabalho de quem está na porta: líder para cima cadastra ficha.
create policy "consolidacao_insert" on public.consolidacao
  for insert to authenticated
  with check (
    igreja_id = public.user_igreja_id()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('lider', 'lider_treinamento', 'supervisor',
                       'supervisor_treinamento', 'pastor', 'admin')
    )
  );

create policy "consolidacao_update" on public.consolidacao
  for update to authenticated
  using (
    igreja_id = public.user_igreja_id()
    and public.consolidacao_pode(celula_id, responsavel_id)
  );

-- Apagar ficha é reescrever história de acompanhamento: só a direção.
create policy "consolidacao_delete" on public.consolidacao
  for delete to authenticated
  using (
    igreja_id = public.user_igreja_id()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('pastor', 'admin')
    )
  );

drop policy if exists "consolidacao_contatos_select" on public.consolidacao_contatos;
drop policy if exists "consolidacao_contatos_insert" on public.consolidacao_contatos;
drop policy if exists "consolidacao_contatos_delete" on public.consolidacao_contatos;

-- O contato herda a permissão da ficha a que pertence.
create policy "consolidacao_contatos_select" on public.consolidacao_contatos
  for select to authenticated
  using (exists (
    select 1 from public.consolidacao f
    where f.id = consolidacao_id
      and f.igreja_id = public.user_igreja_id()
      and public.consolidacao_pode(f.celula_id, f.responsavel_id)
  ));

create policy "consolidacao_contatos_insert" on public.consolidacao_contatos
  for insert to authenticated
  with check (
    autor_id = auth.uid()
    and exists (
      select 1 from public.consolidacao f
      where f.id = consolidacao_id
        and f.igreja_id = public.user_igreja_id()
        and public.consolidacao_pode(f.celula_id, f.responsavel_id)
    )
  );

-- Cada um desfaz o relato que lançou errado; o dos outros fica.
create policy "consolidacao_contatos_delete" on public.consolidacao_contatos
  for delete to authenticated
  using (autor_id = auth.uid());
