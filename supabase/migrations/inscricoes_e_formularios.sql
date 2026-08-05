-- Formulários de inscrição
create table public.formularios (
  id         uuid primary key default gen_random_uuid(),
  igreja_id  uuid not null references public.igrejas(id) on delete cascade,
  nome       text not null,
  descricao  text,
  campos     jsonb not null default '[]',
  template   boolean not null default false,
  criado_por uuid references public.profiles(id) on delete set null,
  criado_em  timestamptz not null default now()
);

alter table public.formularios enable row level security;

create policy "formularios_select" on public.formularios
  for select to authenticated using (igreja_id = public.user_igreja_id());

create policy "formularios_insert" on public.formularios
  for insert to authenticated with check (igreja_id = public.user_igreja_id());

create policy "formularios_update" on public.formularios
  for update to authenticated
  using (criado_por = auth.uid()
    or (select role from public.profiles where id = auth.uid()) in ('pastor','admin'));

create policy "formularios_delete" on public.formularios
  for delete to authenticated
  using (criado_por = auth.uid()
    or (select role from public.profiles where id = auth.uid()) in ('pastor','admin'));

-- Inscrições em eventos
create table public.inscricoes_evento (
  id            uuid primary key default gen_random_uuid(),
  evento_id     uuid not null references public.eventos(id) on delete cascade,
  formulario_id uuid references public.formularios(id) on delete set null,
  user_id       uuid references public.profiles(id) on delete set null,
  nome          text not null,
  telefone      text,
  dados         jsonb not null default '{}',
  status        text not null default 'pendente'
    check (status in ('pendente', 'confirmado', 'cancelado')),
  criado_em     timestamptz not null default now()
);

alter table public.inscricoes_evento enable row level security;

-- Admins e líderes veem as inscrições da sua igreja
create policy "inscricoes_select" on public.inscricoes_evento
  for select to authenticated
  using (
    exists (
      select 1 from public.eventos e
      where e.id = evento_id and e.igreja_id = public.user_igreja_id()
    )
  );

-- Qualquer autenticado pode se inscrever
create policy "inscricoes_insert" on public.inscricoes_evento
  for insert to authenticated
  with check (user_id = auth.uid());

-- Atualizar status (admin/pastor/líder)
create policy "inscricoes_update" on public.inscricoes_evento
  for update to authenticated
  using (
    user_id = auth.uid()
    or (select role from public.profiles where id = auth.uid())
       in ('pastor', 'admin', 'supervisor', 'supervisor_treinamento', 'lider')
  );

-- Adicionar campos de inscrição na tabela eventos
alter table public.eventos
  add column if not exists tipo_inscricao text not null default 'aberto'
    check (tipo_inscricao in ('aberto', 'whatsapp', 'formulario', 'pix')),
  add column if not exists whatsapp_inscricao text,
  add column if not exists pix_chave          text,
  add column if not exists pix_tipo           text
    check (pix_tipo in ('cpf', 'cnpj', 'email', 'telefone', 'aleatoria')),
  add column if not exists pix_nome           text,
  add column if not exists pix_valor          numeric(10,2),
  add column if not exists formulario_id      uuid references public.formularios(id) on delete set null;

-- Índices
create index if not exists inscricoes_evento_evento_id_idx on public.inscricoes_evento(evento_id);
create index if not exists inscricoes_evento_user_id_idx   on public.inscricoes_evento(user_id);
create index if not exists formularios_igreja_id_idx       on public.formularios(igreja_id);
