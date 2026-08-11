-- Contribuição (dízimos e ofertas), mídia da igreja e as solicitações de
-- voluntariado e membresia.
--
-- Fecha as lacunas que o link-in-bio (flow.page) cobria e o app não: PIX,
-- podcast, culto ao vivo, "seja voluntário" e "seja membro".

-- ── Igreja: contribuição e mídia ────────────────────────────────────────────
alter table public.igrejas
  -- PIX da conta da igreja. O QR é montado no app a partir da chave, então
  -- não há imagem para manter atualizada quando a chave muda.
  add column if not exists pix_chave         text,
  add column if not exists pix_tipo          text,
  add column if not exists pix_nome          text,
  add column if not exists pix_cidade        text,
  -- Texto pastoral que acompanha a página de contribuição.
  add column if not exists contribuicao_texto text,
  -- Dados bancários por extenso, para quem prefere transferência a PIX.
  add column if not exists dados_bancarios   text,
  -- Sem isso a página de contribuição some: enquanto a liderança não
  -- conferir a chave, ninguém vê um QR pela metade.
  add column if not exists contribuicao_ativa boolean not null default false,
  add column if not exists spotify_url       text,
  -- Link da transmissão. `ao_vivo_ativo` é a chave que a liderança vira
  -- antes do culto — o app não tenta adivinhar se há transmissão no ar.
  add column if not exists ao_vivo_url       text,
  add column if not exists ao_vivo_ativo     boolean not null default false;

alter table public.igrejas
  drop constraint if exists igrejas_pix_tipo_check;

alter table public.igrejas
  add constraint igrejas_pix_tipo_check
  check (pix_tipo is null or pix_tipo in ('cpf','cnpj','email','telefone','aleatoria'));

-- ── Solicitações de voluntariado e membresia ────────────────────────────────
-- Tabela única com `tipo` em vez de uma tabela por fluxo: os dois pedidos têm
-- o mesmo ciclo de vida (chega, alguém assume, é atendido) e só divergem nas
-- perguntas do formulário, que ficam em `dados`. `solicitacoes_celula` segue
-- separada — tem esquema tipado próprio e já está em uso.
create table if not exists public.solicitacoes (
  id            uuid primary key default gen_random_uuid(),
  igreja_id     uuid not null references public.igrejas(id) on delete cascade,
  user_id       uuid references public.profiles(id) on delete set null,
  tipo          text not null check (tipo in ('voluntario','membresia')),
  nome          text not null,
  telefone      text not null,
  email         text not null,
  -- Respostas específicas de cada tipo (áreas de interesse, batismo,
  -- igreja de origem…). Sem coluna nova a cada pergunta que a liderança quiser.
  dados         jsonb not null default '{}'::jsonb,
  mensagem      text,
  status        text not null default 'pendente'
                check (status in ('pendente','em_andamento','atendido','arquivado')),
  responsavel_id uuid references public.profiles(id) on delete set null,
  observacao    text,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists solicitacoes_igreja_status_idx
  on public.solicitacoes (igreja_id, status, criado_em desc);

alter table public.solicitacoes enable row level security;

-- Quem está logado cria o próprio pedido. O visitante não passa por aqui:
-- a action usa a service role, porque o formulário é aberto na home pública.
drop policy if exists "solicitacoes_insert_own" on public.solicitacoes;
create policy "solicitacoes_insert_own" on public.solicitacoes
  for insert to authenticated
  with check (user_id = auth.uid());

-- Cada um vê o que enviou; a liderança vê tudo o que é da própria igreja.
drop policy if exists "solicitacoes_select" on public.solicitacoes;
create policy "solicitacoes_select" on public.solicitacoes
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.igreja_id = solicitacoes.igreja_id
        and p.role in ('supervisor','supervisor_treinamento','pastor','admin')
    )
  );

-- Encaminhar e marcar atendido é da supervisão para cima.
drop policy if exists "solicitacoes_update_lideranca" on public.solicitacoes;
create policy "solicitacoes_update_lideranca" on public.solicitacoes
  for update to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.igreja_id = solicitacoes.igreja_id
        and p.role in ('supervisor','supervisor_treinamento','pastor','admin')
    )
  );
