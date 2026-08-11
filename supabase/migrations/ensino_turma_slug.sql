-- URL legível para a página da turma:
--   /ensino/turma/e46be209-7fd8-49e4-ba93-7e0dba9cac2e
--   → /ensino/turma/fe-na-pratica-carta-de-tiago
--
-- Mesma mecânica de `eventos_slug.sql`, e pelas mesmas razões: o slug é único
-- no banco inteiro porque a URL não carrega o segmento da igreja, colisão ganha
-- sufixo numérico ("-2", "-3"), e o UUID continua valendo para não quebrar link
-- já compartilhado no WhatsApp — quem chega por ele é redirecionado ao slug.

alter table public.ensino_turmas
  add column if not exists slug text;

-- A mesma normalização de `slug_evento`, agora sem dono: turma não é evento, e
-- chamar a função do outro módulo esconderia isso de quem for ler o gatilho.
-- Unificar as duas é trabalho para quando alguém mexer no lado dos eventos.
create or replace function public.slug_url(txt text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(public.normalizar_nome(coalesce(txt, '')), '[^a-z0-9]+', '-', 'g'))
$$;

create or replace function public.gerar_slug_turma()
returns trigger
language plpgsql
as $$
declare
  base      text;
  tentativa text;
  n         int := 1;
begin
  -- Slug informado à mão é respeitado; e renomear a turma não muda a URL de uma
  -- turma já divulgada.
  if new.slug is not null and new.slug <> '' then
    return new;
  end if;

  base := public.slug_url(new.nome);
  if base = '' then
    base := 'turma';
  end if;

  tentativa := base;
  while exists (
    select 1 from public.ensino_turmas t
    where t.slug = tentativa and t.id is distinct from new.id
  ) loop
    n := n + 1;
    tentativa := base || '-' || n;
  end loop;

  new.slug := tentativa;
  return new;
end;
$$;

drop trigger if exists ensino_turmas_slug_padrao on public.ensino_turmas;
create trigger ensino_turmas_slug_padrao
  before insert on public.ensino_turmas
  for each row execute function public.gerar_slug_turma();

-- Backfill das turmas que já existem. Uma a uma, para o laço de unicidade do
-- gatilho valer também aqui.
do $$
declare
  t         record;
  base      text;
  tentativa text;
  n         int;
begin
  for t in select id, nome from public.ensino_turmas where slug is null order by criado_em loop
    base := public.slug_url(t.nome);
    if base = '' then
      base := 'turma';
    end if;

    tentativa := base;
    n := 1;
    while exists (select 1 from public.ensino_turmas x where x.slug = tentativa) loop
      n := n + 1;
      tentativa := base || '-' || n;
    end loop;

    update public.ensino_turmas set slug = tentativa where id = t.id;
  end loop;
end;
$$;

create unique index if not exists ensino_turmas_slug_unico
  on public.ensino_turmas (slug) where slug is not null;
