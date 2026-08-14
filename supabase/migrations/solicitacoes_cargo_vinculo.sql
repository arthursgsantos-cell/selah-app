-- ============================================================
-- DECLARAÇÃO DE VÍNCULO NO PRIMEIRO ACESSO
-- ============================================================
-- Quem entra pela primeira vez já sabe quem é na igreja: é membro há dez anos,
-- lidera a célula da quarta-feira, dá aula na Escola Bíblica. O app não sabia
-- de nada disso — a pessoa entrava como "membro" genérico e alguém da
-- secretaria precisava descobrir e corrigir depois, um por um.
--
-- A tabela de solicitação de cargo passa a carregar a declaração inteira:
-- o vínculo (membro, congregado, visitante), a célula de que a pessoa diz
-- fazer parte e a função que exerce — inclusive as do Ensino, que não são
-- cargo em `profiles` e sim linha em `ensino_equipe`.
--
-- Nada disso vale sozinho: a linha nasce `pendente` e só vira cargo de verdade
-- quando pastor ou admin confirma em /pendencias. É pré-cadastro, não
-- autoatribuição — senão qualquer um entraria como pastor.

alter table public.solicitacoes_cargo
  add column if not exists celula_id uuid references public.celulas(id) on delete set null,
  -- 'membro' | 'congregado' | 'visitante'. Nulo em quem só pediu cargo pela
  -- tela antiga, que não perguntava isso.
  add column if not exists vinculo text;

-- A lista antiga só previa líder e supervisor. Agora cabe a igreja inteira:
-- pastor e administrador (que continuam dependendo de confirmação), e os dois
-- papéis do Ensino.
alter table public.solicitacoes_cargo
  drop constraint if exists solicitacoes_cargo_cargo_solicitado_check;

alter table public.solicitacoes_cargo
  add constraint solicitacoes_cargo_cargo_solicitado_check
  check (cargo_solicitado in (
    'membro',
    'lider_treinamento',
    'lider',
    'supervisor_treinamento',
    'supervisor',
    'pastor',
    'admin',
    'ensino_coordenador',
    'ensino_professor'
  ));

-- O índice único (user_id, status) impedia uma segunda solicitação enquanto a
-- primeira estivesse pendente — o que é o certo — mas também travava para
-- sempre quem já teve uma aprovada, porque 'aprovado' também é único. Passa a
-- valer só entre as pendentes.
alter table public.solicitacoes_cargo
  drop constraint if exists solicitacoes_cargo_user_id_status_key;

create unique index if not exists solicitacoes_cargo_pendente_idx
  on public.solicitacoes_cargo (user_id)
  where status = 'pendente';
