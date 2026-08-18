-- Pessoas autorizadas a cuidar dos pedidos de célula, membresia e voluntariado.
-- Não concede acesso ao restante do painel.
create table if not exists public.solicitacoes_acesso_delegado (
  igreja_id uuid not null references public.igrejas(id) on delete cascade,
  usuario_id uuid not null references public.profiles(id) on delete cascade,
  criado_por uuid references public.profiles(id) on delete set null,
  criado_em timestamptz not null default now(),
  primary key (igreja_id, usuario_id)
);

alter table public.solicitacoes_acesso_delegado enable row level security;

create policy "lideranca gerencia acessos de pedidos"
  on public.solicitacoes_acesso_delegado for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.igreja_id = solicitacoes_acesso_delegado.igreja_id and p.role in ('pastor','admin')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.igreja_id = solicitacoes_acesso_delegado.igreja_id and p.role in ('pastor','admin')));

create policy "delegado consulta seu acesso"
  on public.solicitacoes_acesso_delegado for select to authenticated
  using (usuario_id = auth.uid());
