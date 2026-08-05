-- URL legível para a página do evento:
--   /evento/07b3...-uuid-...  →  /evento/1-retiro-rede-one
--
-- O slug é único no banco inteiro, e não por igreja, porque a URL não carrega
-- o segmento da igreja — `/evento/<slug>` precisa apontar para um evento só.
-- Colisão ganha sufixo numérico ("-2", "-3").
--
-- A página continua aceitando o UUID: links já compartilhados no WhatsApp não
-- podem quebrar. Quando chega por UUID, ela redireciona para o slug.

alter table public.eventos
  add column if not exists slug text;

-- `normalizar_nome` já resolve minúsculas e acentos; aqui só trocamos o que
-- não é letra ou número por hífen e aparamos as pontas.
create or replace function public.slug_evento(txt text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(public.normalizar_nome(coalesce(txt, '')), '[^a-z0-9]+', '-', 'g'))
$$;

create or replace function public.gerar_slug_evento()
returns trigger
language plpgsql
as $$
declare
  base      text;
  tentativa text;
  n         int := 1;
begin
  -- Slug informado à mão é respeitado; e editar o título não muda a URL de um
  -- evento já divulgado.
  if new.slug is not null and new.slug <> '' then
    return new;
  end if;

  base := public.slug_evento(new.titulo);
  if base = '' then
    base := 'evento';
  end if;

  tentativa := base;
  while exists (select 1 from public.eventos e where e.slug = tentativa and e.id is distinct from new.id) loop
    n := n + 1;
    tentativa := base || '-' || n;
  end loop;

  new.slug := tentativa;
  return new;
end;
$$;

drop trigger if exists eventos_slug_padrao on public.eventos;
create trigger eventos_slug_padrao
  before insert on public.eventos
  for each row execute function public.gerar_slug_evento();

-- Backfill dos eventos que já existem. Um a um, para o laço de unicidade do
-- gatilho valer também aqui.
do $$
declare
  ev        record;
  base      text;
  tentativa text;
  n         int;
begin
  for ev in select id, titulo from public.eventos where slug is null order by created_at loop
    base := public.slug_evento(ev.titulo);
    if base = '' then
      base := 'evento';
    end if;

    tentativa := base;
    n := 1;
    while exists (select 1 from public.eventos e where e.slug = tentativa) loop
      n := n + 1;
      tentativa := base || '-' || n;
    end loop;

    update public.eventos set slug = tentativa where id = ev.id;
  end loop;
end;
$$;

create unique index if not exists eventos_slug_unico on public.eventos (slug) where slug is not null;
