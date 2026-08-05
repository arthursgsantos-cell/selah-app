-- Controle das importações automáticas (roteiros, fotos de célula, eventos).
--
-- Cada linha registra o destino de UM item da planilha de controle. A chave
-- `unique (igreja_id, tipo, chave)` é o que torna a importação repetível: rodar
-- de novo reencontra o registro e devolve "ignorado" em vez de duplicar.
--
-- O que entra em `chave` depende do tipo:
--   roteiro      → nome do arquivo PDF
--   foto_celula  → hash SHA-256 do conteúdo da imagem (cópia idêntica com nome
--                  diferente cai na mesma chave); pendências e erros, que não
--                  chegaram a baixar o arquivo, usam o prefixo "arquivo:<nome>"
--   evento       → slug(nome do evento) + "@" + data do evento

create table if not exists public.importacoes (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references public.igrejas(id) on delete cascade,
  tipo text not null check (tipo in ('roteiro','foto_celula','evento')),
  chave text not null,
  arquivo_nome text,
  celula_id uuid references public.celulas(id) on delete set null,
  destino text,
  grupo_origem text,
  registro_id uuid,
  status text not null default 'importado'
    check (status in ('importado','ignorado','pendente','erro')),
  motivo text,
  importado_em timestamptz not null default now(),
  unique (igreja_id, tipo, chave)
);

create index if not exists importacoes_igreja_tipo_idx
  on public.importacoes (igreja_id, tipo, importado_em desc);

-- Consulta usada para evitar rebaixar o arquivo já importado numa nova rodada
create index if not exists importacoes_arquivo_idx
  on public.importacoes (igreja_id, tipo, arquivo_nome)
  where arquivo_nome is not null;

alter table public.importacoes enable row level security;

-- Só pastor/admin da própria igreja enxerga o log. A escrita é sempre feita
-- pela service_role (rota de sync), que ignora RLS — por isso não há policy de
-- insert/update/delete.
drop policy if exists importacoes_select on public.importacoes;
create policy importacoes_select on public.importacoes
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('pastor','admin')
        and p.igreja_id = importacoes.igreja_id
    )
  );
