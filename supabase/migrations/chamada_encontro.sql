-- ============================================================
-- CHAMADA DO ENCONTRO – quem esteve, e não quem disse que viria
-- ============================================================
-- Até aqui `presencas` guardava uma coisa só: a resposta que o próprio irmão
-- dá antes do encontro ("Vou estar" / "Não vou"). Isso é intenção, e a
-- supervisão vinha contando intenção como se fosse presença — a média de
-- pessoas por célula e a série no tempo saíam do `status = 'confirmado'`.
--
-- A chamada é o outro lado: o líder, no dia, marca quem apareceu. São duas
-- informações diferentes sobre a mesma pessoa no mesmo encontro, então moram
-- na mesma linha em vez de em tabelas separadas:
--
--   status   → o que a pessoa respondeu antes (continua sendo dela)
--   presente → o que o líder viu (null = a chamada ainda não passou por ela)
--
-- Quem conta presença passa a ler `coalesce(presente, status = 'confirmado')`:
-- onde houve chamada vale a chamada; onde não houve, o histórico antigo
-- continua valendo exatamente como valia. Nenhum número muda de lugar sozinho.

-- ------------------------------------------------------------
-- Três tipos de linha, uma tabela
-- ------------------------------------------------------------
-- A chamada precisa listar mais gente do que `celula_membros` tem:
--
--   user_id         → membro com conta no app
--   pre_cadastro_id → pessoa já organizada na célula que nunca criou conta
--                     (hoje são a maioria: 32 contra 25)
--   visitante_nome  → quem chegou naquele dia e não está em lista nenhuma
--
-- Exatamente um dos três é preenchido por linha.

alter table public.presencas
  add column if not exists presente        boolean,
  add column if not exists marcado_por     uuid references public.profiles(id) on delete set null,
  add column if not exists marcado_em      timestamptz,
  add column if not exists pre_cadastro_id uuid references public.membros_pre_cadastro(id) on delete cascade,
  add column if not exists visitante_nome  text;

alter table public.presencas alter column user_id drop not null;

alter table public.presencas drop constraint if exists presencas_identidade_check;
alter table public.presencas
  add constraint presencas_identidade_check
  check (num_nonnulls(user_id, pre_cadastro_id, visitante_nome) = 1);

-- `presencas` já tem unique (encontro_id, user_id); a pessoa sem conta precisa
-- da sua, para o upsert da chamada corrigir a linha em vez de criar outra.
--
-- Índice inteiro, e não parcial: `on conflict` do PostgREST não sabe repetir o
-- `where` de um índice parcial, e a inferência falharia. Não precisa ser
-- parcial mesmo — no Postgres dois nulos são distintos, então as linhas de
-- membro e de visitante (com `pre_cadastro_id` nulo) não colidem entre si.
create unique index if not exists presencas_encontro_pre_cadastro_idx
  on public.presencas (encontro_id, pre_cadastro_id);

create index if not exists presencas_encontro_idx
  on public.presencas (encontro_id);

-- ============================================================
-- Saúde da célula: a mesma conta, agora sobre presença de verdade
-- ============================================================
-- Uma linha vale, no total de pessoas do encontro:
--
--   1  pela própria pessoa (membro, pré-cadastro ou visitante avulso)
--   +1 se veio com o cônjuge que não tem linha própria
--   +N visitantes que ela declarou no RSVP — **só enquanto a chamada não
--      passou por ela**. Depois da chamada, visitante é linha com nome; contar
--      os dois somaria a mesma pessoa duas vezes.

create or replace function public.saude_celulas(p_celula_ids uuid[])
returns table (
  celula_id       uuid,
  ultimo_encontro timestamptz,
  encontros_90d   bigint,
  media_presenca  numeric,
  ultima_supervisao date
)
language sql stable security definer
set search_path = public
as $$
  with recentes as (
    select e.id, e.celula_id,
           coalesce(sum(
             case when coalesce(p.presente, p.status = 'confirmado')
                  then 1
                       + (case when p.com_conjuge then 1 else 0 end)
                       + (case when p.presente is null then coalesce(p.num_visitantes, 0) else 0 end)
                  else 0 end
           ), 0) as total
      from public.encontros e
      left join public.presencas p on p.encontro_id = e.id
     where e.celula_id = any (p_celula_ids)
       and e.status = 'realizado'
       and e.data_hora >= now() - interval '90 days'
     group by e.id, e.celula_id
  )
  select c.id,
         (select max(e.data_hora) from public.encontros e
           where e.celula_id = c.id and e.status = 'realizado'),
         (select count(*) from recentes r where r.celula_id = c.id),
         (select round(avg(r.total), 1) from recentes r where r.celula_id = c.id),
         (select max(s.data) from public.supervisoes s where s.celula_id = c.id)
    from public.celulas c
   where c.id = any (p_celula_ids)
$$;

-- ============================================================
-- A série no tempo
-- ============================================================
-- Mesma regra da média, separada nas três barras. "Membros" aqui é toda pessoa
-- com nome na lista da célula — com conta ou não; visitante avulso vai para a
-- terceira barra, que é onde ele sempre esteve.

create or replace function public.presenca_serie(
  p_celula_ids    uuid[],
  p_granularidade text default 'semana',
  p_periodos      int  default 12
)
returns table (
  inicio     date,
  encontros  bigint,
  membros    bigint,
  conjuges   bigint,
  visitantes bigint
)
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_unidade text;
  v_desde   date;
begin
  v_unidade := case p_granularidade
                 when 'semana' then 'week'
                 when 'mes'    then 'month'
                 when 'ano'    then 'year'
                 else 'week'
               end;

  v_desde := (date_trunc(v_unidade, current_date)
              - ((p_periodos - 1)::text || ' ' || v_unidade)::interval)::date;

  return query
  with base as (
    select e.id,
           date_trunc(v_unidade, (e.data_hora at time zone 'America/Sao_Paulo'))::date as ini
      from public.encontros e
     where e.celula_id = any (p_celula_ids)
       and e.status = 'realizado'
       and (e.data_hora at time zone 'America/Sao_Paulo')::date >= v_desde
  ),
  marcas as (
    select b.ini, b.id,
           p.com_conjuge, p.num_visitantes, p.visitante_nome, p.presente,
           coalesce(p.presente, p.status = 'confirmado') as veio
      from base b
      left join public.presencas p on p.encontro_id = b.id
  )
  select m.ini,
         count(distinct m.id),
         count(*) filter (where m.veio and m.visitante_nome is null),
         count(*) filter (where m.veio and m.com_conjuge),
         (count(*) filter (where m.veio and m.visitante_nome is not null)
          + coalesce(sum(m.num_visitantes) filter (where m.veio and m.presente is null), 0))::bigint
    from marcas m
   group by m.ini
   order by m.ini;
end;
$$;

-- ============================================================
-- Frequência dos irmãos: quem está sumindo
-- ============================================================
-- A pergunta da supervisão não é "quantas pessoas foram" — é "quem parou de
-- ir". Uma linha por pessoa da célula, com quantos encontros houve, em quantos
-- ela apareceu e, o que realmente importa, há quantos encontros seguidos ela
-- não aparece.
--
-- Só entram encontros que passaram pela chamada. Sem esse filtro, "faltou nos
-- 5 últimos" diria apenas que o líder não fez chamada nenhuma — acusaria o
-- irmão pelo silêncio de outra pessoa.
--
-- `faltas_seguidas` sai de uma conta só: a posição do encontro mais recente em
-- que a pessoa esteve, contando de trás para frente. Esteve no último → 0.
-- Nunca esteve → todos os encontros do período.

create or replace function public.frequencia_irmaos(
  p_celula_ids uuid[],
  p_desde      date default null
)
returns table (
  celula_id       uuid,
  user_id         uuid,
  pre_cadastro_id uuid,
  nome            text,
  avatar_url      text,
  encontros       bigint,
  presencas       bigint,
  ultima_presenca timestamptz,
  faltas_seguidas int
)
language sql stable security definer
set search_path = public
as $$
  with encs as (
    select e.id, e.celula_id, e.data_hora,
           row_number() over (partition by e.celula_id order by e.data_hora desc) as recencia
      from public.encontros e
     where e.celula_id = any (p_celula_ids)
       and e.status = 'realizado'
       and (p_desde is null or (e.data_hora at time zone 'America/Sao_Paulo')::date >= p_desde)
       and exists (
         select 1 from public.presencas p
          where p.encontro_id = e.id and p.presente is not null
       )
  ),
  total as (
    select encs.celula_id, count(*) as n from encs group by encs.celula_id
  ),
  -- `chaves_pre` guarda os ids de pré-cadastro que já foram desta pessoa: quem
  -- criou conta depois não pode perder a frequência que construiu antes.
  pessoas as (
    select cm.celula_id,
           cm.user_id,
           null::uuid as pre_cadastro_id,
           pr.nome,
           pr.avatar_url,
           array(
             select mpc.id from public.membros_pre_cadastro mpc
              where mpc.profile_id = cm.user_id
           ) as chaves_pre
      from public.celula_membros cm
      join public.profiles pr on pr.id = cm.user_id
     where cm.celula_id = any (p_celula_ids)
    union all
    select mpc.celula_id,
           null::uuid,
           mpc.id,
           mpc.nome,
           null::text,
           array[mpc.id]
      from public.membros_pre_cadastro mpc
     where mpc.celula_id = any (p_celula_ids)
       and mpc.profile_id is null
  )
  select pe.celula_id,
         pe.user_id,
         pe.pre_cadastro_id,
         pe.nome,
         pe.avatar_url,
         t.n,
         count(*) filter (where p.presente),
         max(en.data_hora) filter (where p.presente),
         (coalesce(min(en.recencia) filter (where p.presente), t.n + 1) - 1)::int
    from pessoas pe
    join total t on t.celula_id = pe.celula_id
    left join encs en on en.celula_id = pe.celula_id
    left join public.presencas p
           on p.encontro_id = en.id
          and (
                (pe.user_id is not null and p.user_id = pe.user_id)
                or p.pre_cadastro_id = any (pe.chaves_pre)
              )
   group by pe.celula_id, pe.user_id, pe.pre_cadastro_id, pe.nome, pe.avatar_url, t.n
$$;

-- Mesma regra das outras duas: quem chama é o servidor com a service_role,
-- depois de já ter resolvido quais células aquela pessoa enxerga. Solto para
-- `authenticated`, qualquer um sondaria a frequência de células alheias
-- passando uuids no array.
revoke execute on function public.frequencia_irmaos(uuid[], date) from public, authenticated;
grant  execute on function public.frequencia_irmaos(uuid[], date) to service_role;
