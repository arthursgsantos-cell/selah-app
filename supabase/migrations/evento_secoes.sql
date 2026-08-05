-- Seções da página do evento como DADOS, não como JSX fixo.
--
-- Antes, a ordem das seções estava escrita no componente da página. Para o
-- pastor poder reordenar e duplicar ("dois blocos de opções: acomodação e
-- alimentação"), cada seção virou uma linha, e os filhos (botões, mini cards,
-- fotos) passaram a apontar para a seção a que pertencem — senão a cópia
-- compartilharia o conteúdo do original.

create table if not exists public.evento_secoes (
  id        uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos(id) on delete cascade,
  tipo      text not null check (tipo in ('inscricao','botoes','cards','video','fotos')),
  -- Nulo usa o nome padrão do tipo ("Opções", "Vídeo", "Fotos do local").
  titulo    text,
  descricao text,
  -- Só para tipo 'video'. Fica na seção, e não em `eventos`, para que duas
  -- seções de vídeo no mesmo evento tenham vídeos diferentes.
  video_url text,
  ordem     int not null default 0,
  criado_em timestamptz not null default now()
);

create index if not exists evento_secoes_evento_idx
  on public.evento_secoes (evento_id, ordem);

-- Os filhos passam a pertencer a uma seção. `on delete cascade`: apagar a
-- seção leva junto o que estava dentro dela.
alter table public.evento_botoes
  add column if not exists secao_id uuid references public.evento_secoes(id) on delete cascade;
alter table public.evento_cards
  add column if not exists secao_id uuid references public.evento_secoes(id) on delete cascade;
alter table public.evento_fotos
  add column if not exists secao_id uuid references public.evento_secoes(id) on delete cascade;

-- Backfill: todo evento que já existe ganha as cinco seções na ordem em que a
-- página as desenhava, herdando o cabeçalho dos mini cards e o vídeo que
-- moravam em `eventos`.
insert into public.evento_secoes (evento_id, tipo, ordem, titulo, descricao, video_url)
select
  e.id,
  padrao.tipo,
  padrao.ordem,
  case when padrao.tipo = 'cards' then e.cards_titulo end,
  case when padrao.tipo = 'cards' then e.cards_descricao end,
  case when padrao.tipo = 'video' then e.video_url end
from public.eventos e
cross join (values
  ('inscricao', 0),
  ('botoes',    1),
  ('cards',     2),
  ('video',     3),
  ('fotos',     4)
) as padrao(tipo, ordem)
where not exists (
  select 1 from public.evento_secoes s where s.evento_id = e.id
);

update public.evento_botoes b
set secao_id = s.id
from public.evento_secoes s
where s.evento_id = b.evento_id and s.tipo = 'botoes' and b.secao_id is null;

update public.evento_cards c
set secao_id = s.id
from public.evento_secoes s
where s.evento_id = c.evento_id and s.tipo = 'cards' and c.secao_id is null;

update public.evento_fotos f
set secao_id = s.id
from public.evento_secoes s
where s.evento_id = f.evento_id and s.tipo = 'fotos' and f.secao_id is null;

-- Evento novo já nasce com as seções. Um gatilho, e não código da aplicação,
-- porque eventos entram por três caminhos: o app, a importação da planilha e
-- edição manual no banco.
create or replace function public.criar_secoes_padrao_evento()
returns trigger
language plpgsql
as $$
begin
  insert into public.evento_secoes (evento_id, tipo, ordem)
  values
    (new.id, 'inscricao', 0),
    (new.id, 'botoes',    1),
    (new.id, 'cards',     2),
    (new.id, 'video',     3),
    (new.id, 'fotos',     4);
  return new;
end;
$$;

drop trigger if exists eventos_secoes_padrao on public.eventos;
create trigger eventos_secoes_padrao
  after insert on public.eventos
  for each row execute function public.criar_secoes_padrao_evento();

alter table public.evento_secoes enable row level security;

-- Mesma convenção permissiva das demais tabelas da página do evento: leitura
-- pública, escrita sempre via server action, que checa cargo.
drop policy if exists "evento_secoes_select" on public.evento_secoes;
drop policy if exists "evento_secoes_insert" on public.evento_secoes;
drop policy if exists "evento_secoes_update" on public.evento_secoes;
drop policy if exists "evento_secoes_delete" on public.evento_secoes;

create policy "evento_secoes_select" on public.evento_secoes for select using (true);
create policy "evento_secoes_insert" on public.evento_secoes for insert to authenticated with check (true);
create policy "evento_secoes_update" on public.evento_secoes for update to authenticated using (true);
create policy "evento_secoes_delete" on public.evento_secoes for delete to authenticated using (true);
