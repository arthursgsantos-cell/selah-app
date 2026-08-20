-- Preserve the requested cell so membership confirmations and routing are scoped.
alter table public.solicitacoes_celula
  add column if not exists celula_id uuid references public.celulas(id) on delete set null;

create index if not exists solicitacoes_celula_celula_id_idx
  on public.solicitacoes_celula(celula_id);
