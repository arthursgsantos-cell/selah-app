-- Tabela de solicitações de célula
create table if not exists public.solicitacoes_celula (
  id                    uuid default gen_random_uuid() primary key,
  igreja_id             uuid not null references igrejas(id) on delete cascade,
  user_id               uuid references profiles(id) on delete set null,
  nome                  text not null,
  telefone              text not null,
  email                 text not null,
  idade                 integer,
  estado_civil          text,
  tem_filhos            boolean default false,
  filhos_detalhes       text,
  bairro                text,
  tipo_membro           text,         -- 'membro' | 'congregado' | 'visitante'
  melhor_dia            text,
  status                text not null default 'pendente', -- 'pendente' | 'encaminhado' | 'atendido'
  lider_encaminhado_id  uuid references profiles(id) on delete set null,
  criado_em             timestamptz not null default now()
);

alter table public.solicitacoes_celula enable row level security;

-- Usuários autenticados podem criar solicitações para sua própria igreja
create policy "usuarios podem solicitar"
  on public.solicitacoes_celula for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Líderes+ podem ver solicitações da sua igreja
create policy "lideres podem ver"
  on public.solicitacoes_celula for select
  to authenticated
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.igreja_id = solicitacoes_celula.igreja_id
        and p.role in ('lider','lider_treinamento','supervisor','supervisor_treinamento','pastor','admin')
    )
  );

-- Supervisores+ podem atualizar (encaminhar / marcar atendido)
create policy "supervisores podem atualizar"
  on public.solicitacoes_celula for update
  to authenticated
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.igreja_id = solicitacoes_celula.igreja_id
        and p.role in ('supervisor','supervisor_treinamento','pastor','admin')
    )
  );
