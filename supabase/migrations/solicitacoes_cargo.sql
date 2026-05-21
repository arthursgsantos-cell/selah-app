-- Solicitações de cargo (usuário pede para ser líder ou supervisor)
create table public.solicitacoes_cargo (
  id                uuid primary key default gen_random_uuid(),
  igreja_id         uuid not null references public.igrejas(id) on delete cascade,
  user_id           uuid not null references public.profiles(id) on delete cascade,
  cargo_solicitado  text not null check (cargo_solicitado in ('lider_treinamento', 'lider', 'supervisor_treinamento', 'supervisor')),
  mensagem          text,
  status            text not null default 'pendente' check (status in ('pendente', 'aprovado', 'rejeitado')),
  resolvido_por     uuid references public.profiles(id) on delete set null,
  resolvido_em      timestamptz,
  criado_em         timestamptz not null default now(),
  unique (user_id, status) -- só uma solicitação pendente por usuário
);

alter table public.solicitacoes_cargo enable row level security;

-- Usuário vê suas próprias solicitações
create policy "cargo_select_own" on public.solicitacoes_cargo
  for select to authenticated
  using (user_id = auth.uid() or (select role from public.profiles where id = auth.uid()) in ('pastor','admin'));

-- Usuário pode criar sua própria solicitação
create policy "cargo_insert_own" on public.solicitacoes_cargo
  for insert to authenticated
  with check (user_id = auth.uid() and igreja_id = public.user_igreja_id());

-- Apenas admin/pastor podem atualizar (aprovar/rejeitar)
create policy "cargo_update_admin" on public.solicitacoes_cargo
  for update to authenticated
  using ((select role from public.profiles where id = auth.uid()) in ('pastor','admin'));
