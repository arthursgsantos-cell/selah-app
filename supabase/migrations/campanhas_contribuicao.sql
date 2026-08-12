-- ============================================================
-- CAMPANHAS DE CONTRIBUIÇÃO
-- ============================================================
-- "Foi dízimo, oferta ou construção da nova sede?" — o extrato do banco não
-- responde, porque o PIX chega todo na mesma conta com o mesmo nome.
--
-- A tesouraria resolve isso há décadas com um combinado simples: cada destino
-- fica com um final de centavos seu. A campanha da construção termina em
-- `,23`, e quem lê o extrato separa por ali. Este é o campo `centavos`, e é o
-- que a página de contribuição aplica ao valor antes de montar o QR.
--
-- Por que não usar o `txid` do PIX, que existe justamente para identificar:
-- porque nem todo banco mostra esse campo no extrato, e o que a tesouraria
-- abre no fim do mês é o extrato. O `txid` vai junto de qualquer forma, para
-- quem tiver como ler — mas quem manda é o centavo.

create table if not exists public.campanhas_contribuicao (
  id         uuid primary key default gen_random_uuid(),
  igreja_id  uuid not null references public.igrejas(id) on delete cascade,
  nome       text not null,
  descricao  text,
  -- 1 a 99. O zero fica de fora de propósito: `,00` é o final de qualquer
  -- doação redonda, e uma campanha com ele seria indistinguível da oferta
  -- comum — que é exatamente o problema que a coluna existe para resolver.
  centavos   smallint not null check (centavos between 1 and 99),
  ativa      boolean not null default true,
  ordem      int not null default 0,
  criado_em  timestamptz not null default now()
);

-- Dois destinos ativos com o mesmo final voltariam a misturar o extrato. A
-- restrição vale só entre as ativas: campanha encerrada pode ceder o número
-- para a próxima.
create unique index if not exists campanhas_contribuicao_centavos_idx
  on public.campanhas_contribuicao (igreja_id, centavos)
  where ativa;

create index if not exists campanhas_contribuicao_igreja_idx
  on public.campanhas_contribuicao (igreja_id, ordem);

alter table public.campanhas_contribuicao enable row level security;

drop policy if exists "campanhas_select"     on public.campanhas_contribuicao;
drop policy if exists "campanhas_gerenciar"  on public.campanhas_contribuicao;

-- A página de contribuição é aberta a visitante — é o link que vai no telão e
-- na bio. Quem serve a lista é a service role, mas manter a leitura livre para
-- quem tem sessão evita um caminho privilegiado a mais para uma informação que
-- é pública por natureza: o nome da campanha e o final de centavos.
create policy "campanhas_select" on public.campanhas_contribuicao
  for select to authenticated using (true);

-- Mexer no destino do dinheiro é da direção da igreja.
create policy "campanhas_gerenciar" on public.campanhas_contribuicao
  for all to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.igreja_id = campanhas_contribuicao.igreja_id
        and p.role in ('pastor', 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.igreja_id = campanhas_contribuicao.igreja_id
        and p.role in ('pastor', 'admin')
    )
  );
