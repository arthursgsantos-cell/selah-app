-- Gestão manual de inscrições e pagamentos, para o organizador fazer no app o
-- que hoje só era possível numa planilha à parte: cadastrar quem se inscreveu
-- por fora, anotar quem pagou, quando pagou e guardar o comprovante.

-- ── Organizadores delegados ───────────────────────────────────────────────
-- Quem cria o evento gerencia o dele. Como nem sempre é quem cuida do
-- dinheiro, o criador pode delegar a gestão a outra pessoa — inclusive a um
-- membro sem cargo de liderança, que é o caso do tesoureiro do retiro.
create table if not exists public.evento_organizadores (
  id         uuid primary key default gen_random_uuid(),
  evento_id  uuid not null references public.eventos(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  criado_por uuid references public.profiles(id) on delete set null,
  criado_em  timestamptz not null default now(),
  unique (evento_id, user_id)
);

create index if not exists evento_organizadores_evento_idx
  on public.evento_organizadores (evento_id);
create index if not exists evento_organizadores_user_idx
  on public.evento_organizadores (user_id);

-- ── Inscrição cadastrada à mão ────────────────────────────────────────────
-- `origem` separa quem se inscreveu pelo app de quem o organizador digitou:
-- a ficha manual não tem respostas de formulário e pode ser editada à vontade.
alter table public.inscricoes_evento
  add column if not exists observacao text,
  add column if not exists origem     text not null default 'app'
    check (origem in ('app', 'manual', 'planilha')),
  add column if not exists criado_por uuid references public.profiles(id) on delete set null;

-- ── Comprovante do pagamento ──────────────────────────────────────────────
-- Guardado no bucket privado; o caminho aqui só serve para assinar a URL na
-- hora de mostrar. `metodo` já existia e passa a valer dinheiro/pix/cartão.
alter table public.inscricao_pagamentos
  add column if not exists comprovante_path text,
  add column if not exists comprovante_nome text;

-- Comprovante é documento financeiro de terceiro: bucket privado, lido só
-- pelo route handler que confere quem está pedindo.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('evento-comprovantes', 'evento-comprovantes', false, 10485760,
        array['image/jpeg','image/png','image/webp','image/heic','application/pdf'])
on conflict (id) do update set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/heic','application/pdf'];

-- ── RLS (mesma convenção permissiva das demais tabelas deste banco) ───────
-- Quem pode gerenciar é decidido no servidor, em `podeGerenciarEvento`.
alter table public.evento_organizadores enable row level security;

drop policy if exists "evento_organizadores_all" on public.evento_organizadores;
create policy "evento_organizadores_all" on public.evento_organizadores
  for all to authenticated using (true) with check (true);
