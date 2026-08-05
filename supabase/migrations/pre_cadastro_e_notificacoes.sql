-- ============================================================
-- Membros Pré-Cadastro + Notificações
-- Execute no SQL Editor do Supabase
-- ============================================================

-- pg_trgm para similaridade de nomes
create extension if not exists pg_trgm;

-- ============================================================
-- MEMBROS_PRE_CADASTRO
-- ============================================================
create table public.membros_pre_cadastro (
  id          uuid primary key default gen_random_uuid(),
  igreja_id   uuid not null references public.igrejas(id) on delete cascade,
  nome        text not null,
  telefone    text,
  obs         text,
  profile_id  uuid references public.profiles(id) on delete set null,
  status      text not null default 'pendente'
    check (status in ('pendente', 'confirmado', 'rejeitado')),
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.membros_pre_cadastro enable row level security;

-- Todos os autenticados da mesma igreja podem ver
create policy "pre_cadastro_select" on public.membros_pre_cadastro
  for select to authenticated
  using (igreja_id = public.user_igreja_id());

-- Apenas admin/pastor podem inserir
create policy "pre_cadastro_insert" on public.membros_pre_cadastro
  for insert to authenticated
  with check (
    igreja_id = public.user_igreja_id()
    and (select role from public.profiles where id = auth.uid()) in ('admin', 'pastor')
  );

-- Apenas admin/pastor podem atualizar
create policy "pre_cadastro_update" on public.membros_pre_cadastro
  for update to authenticated
  using (
    igreja_id = public.user_igreja_id()
    and (select role from public.profiles where id = auth.uid()) in ('admin', 'pastor')
  );

-- Apenas admin/pastor podem deletar
create policy "pre_cadastro_delete" on public.membros_pre_cadastro
  for delete to authenticated
  using (
    igreja_id = public.user_igreja_id()
    and (select role from public.profiles where id = auth.uid()) in ('admin', 'pastor')
  );

-- ============================================================
-- NOTIFICACOES
-- ============================================================
create table public.notificacoes (
  id               uuid primary key default gen_random_uuid(),
  igreja_id        uuid not null references public.igrejas(id) on delete cascade,
  destinatario_id  uuid not null references public.profiles(id) on delete cascade,
  tipo             text not null,
  titulo           text not null,
  mensagem         text not null,
  dados            jsonb,
  lida             boolean not null default false,
  created_at       timestamptz not null default now()
);

alter table public.notificacoes enable row level security;

-- Cada usuário vê apenas suas próprias notificações
create policy "notificacoes_select_own" on public.notificacoes
  for select to authenticated
  using (destinatario_id = auth.uid());

-- Usuários podem marcar como lida (update)
create policy "notificacoes_update_own" on public.notificacoes
  for update to authenticated
  using (destinatario_id = auth.uid())
  with check (destinatario_id = auth.uid());

-- Inserção apenas via service_role (server actions com admin client)
create policy "notificacoes_insert_deny" on public.notificacoes
  for insert to authenticated
  with check (false);

-- ============================================================
-- FUNÇÃO: buscar pré-cadastros semelhantes pelo nome
-- ============================================================
create or replace function public.buscar_pre_cadastro_semelhantes(p_nome text)
returns table (
  id          uuid,
  nome        text,
  telefone    text,
  obs         text,
  similaridade float
)
language sql
security definer
set search_path = public
as $$
  select
    mpc.id,
    mpc.nome,
    mpc.telefone,
    mpc.obs,
    similarity(lower(mpc.nome), lower(p_nome))::float as similaridade
  from public.membros_pre_cadastro mpc
  where mpc.igreja_id = (select igreja_id from public.profiles where id = auth.uid())
    and mpc.status = 'pendente'
    and similarity(lower(mpc.nome), lower(p_nome)) > 0.25
  order by similaridade desc
  limit 5;
$$;
