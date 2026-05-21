-- ============================================================
-- SELAH – Schema completo
-- Execute no SQL Editor do Supabase:
-- https://supabase.com/dashboard/project/kkhzmvcqcljptlntlmwm/sql/new
-- ============================================================

-- Tipos ENUM
create type public.role_tipo as enum ('admin', 'pastor', 'supervisor', 'lider', 'membro');
create type public.frequencia_tipo as enum ('semanal', 'quinzenal');
create type public.status_encontro as enum ('agendado', 'realizado', 'cancelado');
create type public.funcao_escala as enum ('louvor', 'quebra_gelo', 'edificacao', 'compartilhar');
create type public.papel_celula as enum ('lider', 'membro');
create type public.tipo_evento as enum ('culto', 'igreja', 'rede', 'celula', 'outro');

-- ============================================================
-- IGREJAS
-- ============================================================
create table public.igrejas (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  slug          text not null unique,
  logo_url      text,
  codigo_convite text not null unique,
  created_at    timestamptz not null default now()
);

alter table public.igrejas enable row level security;

-- qualquer autenticado pode ler (para validar código de convite)
create policy "igrejas_select" on public.igrejas
  for select to authenticated using (true);

-- apenas service_role pode inserir/atualizar
create policy "igrejas_insert_service" on public.igrejas
  for insert to authenticated with check (false);

-- ============================================================
-- PROFILES
-- ============================================================
create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  igreja_id       uuid not null references public.igrejas(id),
  nome            text not null,
  email           text,
  telefone        text,
  avatar_url      text,
  role            public.role_tipo not null default 'membro',
  data_nascimento date,
  endereco        text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own_church" on public.profiles
  for select to authenticated
  using (igreja_id = (select igreja_id from public.profiles where id = auth.uid()));

create policy "profiles_insert_own" on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = auth.uid());

-- ============================================================
-- FUNÇÕES AUXILIARES
-- ============================================================
create or replace function public.user_igreja_id()
returns uuid language sql stable security definer as $$
  select igreja_id from public.profiles where id = auth.uid();
$$;

create or replace function public.user_has_role(check_role text)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role::text = check_role
  );
$$;

-- ============================================================
-- REDES
-- ============================================================
create table public.redes (
  id          uuid primary key default gen_random_uuid(),
  igreja_id   uuid not null references public.igrejas(id),
  nome        text not null,
  descricao   text,
  cor         text not null default '#6366f1',
  created_at  timestamptz not null default now()
);

alter table public.redes enable row level security;

create policy "redes_select" on public.redes
  for select to authenticated using (igreja_id = public.user_igreja_id());

create policy "redes_insert" on public.redes
  for insert to authenticated with check (igreja_id = public.user_igreja_id());

create policy "redes_update" on public.redes
  for update to authenticated using (igreja_id = public.user_igreja_id());

create policy "redes_delete" on public.redes
  for delete to authenticated using (igreja_id = public.user_igreja_id());

-- ============================================================
-- REDE_SUPERVISORES
-- ============================================================
create table public.rede_supervisores (
  rede_id       uuid not null references public.redes(id) on delete cascade,
  supervisor_id uuid not null references public.profiles(id) on delete cascade,
  primary key (rede_id, supervisor_id)
);

alter table public.rede_supervisores enable row level security;

create policy "rede_supervisores_select" on public.rede_supervisores
  for select to authenticated
  using (exists (
    select 1 from public.redes r
    where r.id = rede_id and r.igreja_id = public.user_igreja_id()
  ));

create policy "rede_supervisores_insert" on public.rede_supervisores
  for insert to authenticated
  with check (exists (
    select 1 from public.redes r
    where r.id = rede_id and r.igreja_id = public.user_igreja_id()
  ));

create policy "rede_supervisores_delete" on public.rede_supervisores
  for delete to authenticated
  using (exists (
    select 1 from public.redes r
    where r.id = rede_id and r.igreja_id = public.user_igreja_id()
  ));

-- ============================================================
-- CELULAS
-- ============================================================
create table public.celulas (
  id            uuid primary key default gen_random_uuid(),
  rede_id       uuid not null references public.redes(id),
  nome          text not null,
  descricao     text,
  capa_url      text,
  logo_url      text,
  frequencia    public.frequencia_tipo not null default 'semanal',
  dia_semana    int,
  horario       text,
  local_padrao  text,
  ativa         boolean not null default true,
  created_at    timestamptz not null default now()
);

alter table public.celulas enable row level security;

create policy "celulas_select" on public.celulas
  for select to authenticated
  using (exists (
    select 1 from public.redes r
    where r.id = rede_id and r.igreja_id = public.user_igreja_id()
  ));

create policy "celulas_insert" on public.celulas
  for insert to authenticated
  with check (exists (
    select 1 from public.redes r
    where r.id = rede_id and r.igreja_id = public.user_igreja_id()
  ));

create policy "celulas_update" on public.celulas
  for update to authenticated
  using (exists (
    select 1 from public.redes r
    where r.id = rede_id and r.igreja_id = public.user_igreja_id()
  ));

create policy "celulas_delete" on public.celulas
  for delete to authenticated
  using (exists (
    select 1 from public.redes r
    where r.id = rede_id and r.igreja_id = public.user_igreja_id()
  ));

-- ============================================================
-- CELULA_MEMBROS
-- ============================================================
create table public.celula_membros (
  celula_id uuid not null references public.celulas(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  papel     public.papel_celula not null default 'membro',
  joined_at timestamptz not null default now(),
  primary key (celula_id, user_id)
);

alter table public.celula_membros enable row level security;

create policy "celula_membros_select" on public.celula_membros
  for select to authenticated
  using (exists (
    select 1 from public.celulas c
    join public.redes r on r.id = c.rede_id
    where c.id = celula_id and r.igreja_id = public.user_igreja_id()
  ));

create policy "celula_membros_insert" on public.celula_membros
  for insert to authenticated
  with check (exists (
    select 1 from public.celulas c
    join public.redes r on r.id = c.rede_id
    where c.id = celula_id and r.igreja_id = public.user_igreja_id()
  ));

create policy "celula_membros_delete" on public.celula_membros
  for delete to authenticated
  using (exists (
    select 1 from public.celulas c
    join public.redes r on r.id = c.rede_id
    where c.id = celula_id and r.igreja_id = public.user_igreja_id()
  ));

-- ============================================================
-- ENCONTROS
-- ============================================================
create table public.encontros (
  id                  uuid primary key default gen_random_uuid(),
  celula_id           uuid not null references public.celulas(id),
  data_hora           timestamptz not null,
  local               text,
  avisos              text,
  edificacao_resumo   text,
  card_imagem_url     text,
  status              public.status_encontro not null default 'agendado',
  created_by          uuid references public.profiles(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.encontros enable row level security;

create policy "encontros_select" on public.encontros
  for select to authenticated
  using (exists (
    select 1 from public.celulas c
    join public.redes r on r.id = c.rede_id
    where c.id = celula_id and r.igreja_id = public.user_igreja_id()
  ));

create policy "encontros_insert" on public.encontros
  for insert to authenticated
  with check (exists (
    select 1 from public.celulas c
    join public.redes r on r.id = c.rede_id
    where c.id = celula_id and r.igreja_id = public.user_igreja_id()
  ));

create policy "encontros_update" on public.encontros
  for update to authenticated
  using (exists (
    select 1 from public.celulas c
    join public.redes r on r.id = c.rede_id
    where c.id = celula_id and r.igreja_id = public.user_igreja_id()
  ));

create policy "encontros_delete" on public.encontros
  for delete to authenticated
  using (exists (
    select 1 from public.celulas c
    join public.redes r on r.id = c.rede_id
    where c.id = celula_id and r.igreja_id = public.user_igreja_id()
  ));

-- ============================================================
-- ESCALAS
-- ============================================================
create table public.escalas (
  id              uuid primary key default gen_random_uuid(),
  encontro_id     uuid not null references public.encontros(id) on delete cascade,
  funcao          public.funcao_escala not null,
  responsavel_id  uuid references public.profiles(id),
  observacao      text
);

alter table public.escalas enable row level security;

create policy "escalas_select" on public.escalas
  for select to authenticated
  using (exists (
    select 1 from public.encontros e
    join public.celulas c on c.id = e.celula_id
    join public.redes r on r.id = c.rede_id
    where e.id = encontro_id and r.igreja_id = public.user_igreja_id()
  ));

create policy "escalas_insert" on public.escalas
  for insert to authenticated
  with check (exists (
    select 1 from public.encontros e
    join public.celulas c on c.id = e.celula_id
    join public.redes r on r.id = c.rede_id
    where e.id = encontro_id and r.igreja_id = public.user_igreja_id()
  ));

create policy "escalas_update" on public.escalas
  for update to authenticated
  using (exists (
    select 1 from public.encontros e
    join public.celulas c on c.id = e.celula_id
    join public.redes r on r.id = c.rede_id
    where e.id = encontro_id and r.igreja_id = public.user_igreja_id()
  ));

create policy "escalas_delete" on public.escalas
  for delete to authenticated
  using (exists (
    select 1 from public.encontros e
    join public.celulas c on c.id = e.celula_id
    join public.redes r on r.id = c.rede_id
    where e.id = encontro_id and r.igreja_id = public.user_igreja_id()
  ));

-- ============================================================
-- LANCHES
-- ============================================================
create table public.lanches (
  id              uuid primary key default gen_random_uuid(),
  encontro_id     uuid not null references public.encontros(id) on delete cascade,
  emoji           text,
  item            text not null,
  responsavel     text,
  responsavel_id  uuid references public.profiles(id),
  ordem           int not null default 0,
  created_at      timestamptz not null default now()
);

alter table public.lanches enable row level security;

create policy "lanches_select" on public.lanches
  for select to authenticated
  using (exists (
    select 1 from public.encontros e
    join public.celulas c on c.id = e.celula_id
    join public.redes r on r.id = c.rede_id
    where e.id = encontro_id and r.igreja_id = public.user_igreja_id()
  ));

create policy "lanches_insert" on public.lanches
  for insert to authenticated
  with check (exists (
    select 1 from public.encontros e
    join public.celulas c on c.id = e.celula_id
    join public.redes r on r.id = c.rede_id
    where e.id = encontro_id and r.igreja_id = public.user_igreja_id()
  ));

create policy "lanches_update" on public.lanches
  for update to authenticated
  using (exists (
    select 1 from public.encontros e
    join public.celulas c on c.id = e.celula_id
    join public.redes r on r.id = c.rede_id
    where e.id = encontro_id and r.igreja_id = public.user_igreja_id()
  ));

create policy "lanches_delete" on public.lanches
  for delete to authenticated
  using (exists (
    select 1 from public.encontros e
    join public.celulas c on c.id = e.celula_id
    join public.redes r on r.id = c.rede_id
    where e.id = encontro_id and r.igreja_id = public.user_igreja_id()
  ));

-- ============================================================
-- EVENTOS
-- ============================================================
create table public.eventos (
  id               uuid primary key default gen_random_uuid(),
  igreja_id        uuid not null references public.igrejas(id),
  rede_id          uuid references public.redes(id),
  celula_id        uuid references public.celulas(id),
  titulo           text not null,
  descricao        text,
  data_hora        timestamptz not null,
  local            text,
  imagem_url       text,
  tipo             public.tipo_evento not null default 'outro',
  recorrencia_id   uuid,
  recorrencia_tipo text check (recorrencia_tipo in ('semanal', 'quinzenal', 'mensal')),
  created_by       uuid references public.profiles(id),
  created_at       timestamptz not null default now()
);

alter table public.eventos enable row level security;

create policy "eventos_select" on public.eventos
  for select to authenticated using (igreja_id = public.user_igreja_id());

create policy "eventos_insert" on public.eventos
  for insert to authenticated with check (igreja_id = public.user_igreja_id());

create policy "eventos_update" on public.eventos
  for update to authenticated using (igreja_id = public.user_igreja_id());

create policy "eventos_delete" on public.eventos
  for delete to authenticated using (igreja_id = public.user_igreja_id());

-- ============================================================
-- STORAGE – Avatares de perfil
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/jpeg','image/png','image/webp','image/heic'])
on conflict (id) do update set public = true;

create policy "avatars_select" on storage.objects
  for select using (bucket_id = 'avatars');

create policy "avatars_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'avatars');

create policy "avatars_update" on storage.objects
  for update to authenticated using (bucket_id = 'avatars');

create policy "avatars_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'avatars');

-- ============================================================
-- STORAGE – Capas de eventos
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('evento-capas', 'evento-capas', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do nothing;

create policy "evento_capas_select" on storage.objects
  for select using (bucket_id = 'evento-capas');

create policy "evento_capas_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'evento-capas');

create policy "evento_capas_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'evento-capas');

-- ============================================================
-- MIGRATION – adicionar colunas de recorrência (se já existir DB)
-- ============================================================
-- alter table public.eventos
--   add column if not exists recorrencia_id   uuid,
--   add column if not exists recorrencia_tipo text check (recorrencia_tipo in ('semanal','quinzenal','mensal'));

-- ============================================================
-- MIGRATION – adicionar role 'admin' ao enum (se já existir DB)
-- ============================================================
-- alter type public.role_tipo add value if not exists 'admin';

-- ============================================================
-- MIGRATION – adicionar data_nascimento aos profiles (se já existir DB)
-- ============================================================
-- alter table public.profiles add column if not exists data_nascimento date;

-- ============================================================
-- RESUMOS DO CULTO
-- ============================================================
create table public.resumos_culto (
  id           uuid primary key default gen_random_uuid(),
  igreja_id    uuid not null references public.igrejas(id),
  titulo       text not null,
  conteudo     text not null,
  pdf_url      text,
  data_culto   date not null,
  validade_ate date not null,
  created_by   uuid references public.profiles(id),
  created_at   timestamptz not null default now()
);

alter table public.resumos_culto enable row level security;

create policy "resumos_culto_select" on public.resumos_culto
  for select to authenticated using (igreja_id = public.user_igreja_id());

create policy "resumos_culto_insert" on public.resumos_culto
  for insert to authenticated with check (igreja_id = public.user_igreja_id());

create policy "resumos_culto_update" on public.resumos_culto
  for update to authenticated using (igreja_id = public.user_igreja_id());

-- ============================================================
-- MIGRATION – criar tabela resumos_culto (se já existir DB)
-- ============================================================
-- create table if not exists public.resumos_culto (
--   id           uuid primary key default gen_random_uuid(),
--   igreja_id    uuid not null references public.igrejas(id),
--   titulo       text not null,
--   conteudo     text not null,
--   data_culto   date not null,
--   validade_ate date not null,
--   created_by   uuid references public.profiles(id),
--   created_at   timestamptz not null default now()
-- );
-- alter table public.resumos_culto enable row level security;
