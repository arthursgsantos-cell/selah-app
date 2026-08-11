-- ============================================================
-- SAÚDE DA REDE – as duas perguntas do supervisor
-- ============================================================
-- "Onde eu olho primeiro?" e "a rede está crescendo ou encolhendo?".
--
-- As duas se respondem contando presença, e contar presença no Node exigiria
-- puxar todas as linhas de `presencas` para a memória a cada render — dezenas
-- de milhares numa igreja de porte médio. Então a conta acontece no banco e
-- volta agregada.
--
-- As duas funções são `security definer` e ficam FORA do alcance de
-- `authenticated`: quem chama é o servidor, com a service_role, depois de já
-- ter resolvido quais redes aquela pessoa supervisiona. Sem isso, qualquer
-- usuário logado poderia sondar números de células que não são dele passando
-- uuids no array.

-- ============================================================
-- Uma linha por célula: o retrato de agora
-- ============================================================
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
           count(*) filter (where p.status = 'confirmado')
             + count(*) filter (where p.status = 'confirmado' and p.com_conjuge)
             + coalesce(sum(p.num_visitantes) filter (where p.status = 'confirmado'), 0)
             as total
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
-- A série no tempo: como estava, como está
-- ============================================================
-- `p_granularidade` chega em português porque é o mesmo valor que a aba da
-- interface manda; o nome que o Postgres entende é resolvido aqui dentro.
--
-- Corta pelo fuso da igreja: o encontro das 20h de sábado é salvo como 23h
-- UTC, e agrupar pelo UTC jogaria metade dos sábados para o domingo — e,
-- pior, para a semana seguinte.
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
  )
  select b.ini,
         count(distinct b.id),
         count(*) filter (where p.status = 'confirmado'),
         count(*) filter (where p.status = 'confirmado' and p.com_conjuge),
         coalesce(sum(p.num_visitantes) filter (where p.status = 'confirmado'), 0)::bigint
    from base b
    left join public.presencas p on p.encontro_id = b.id
   group by b.ini
   order by b.ini;
end;
$$;

revoke execute on function public.saude_celulas(uuid[])              from public, authenticated;
revoke execute on function public.presenca_serie(uuid[], text, int)  from public, authenticated;
grant  execute on function public.saude_celulas(uuid[])              to service_role;
grant  execute on function public.presenca_serie(uuid[], text, int)  to service_role;
