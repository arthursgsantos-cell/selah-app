-- ============================================================
-- RLS nas 13 tabelas centrais
-- ============================================================
-- Estas tabelas estavam com RLS DESLIGADA em produção. Como a chave anônima
-- do Supabase vai no bundle do navegador, na prática qualquer pessoa que
-- abrisse o app podia ler e escrever `profiles`, `celulas`, `encontros` e
-- companhia — de todas as igrejas, não só da sua.
--
-- Boa parte delas já tinha policies criadas. Só que quase todas diziam
-- `using (true)` para o papel `public`: ligar a RLS sobre elas seria teatro,
-- porque "libera tudo para todos" continua liberando tudo. Por isso este
-- arquivo REESCREVE as policies antes de ligar a chave.
--
-- ── O princípio ────────────────────────────────────────────────────────────
-- O app já faz o trabalho pesado com a service role (`createAdminClient`),
-- que ignora RLS por definição. O que passa pelo cliente de usuário é um
-- conjunto pequeno e conhecido, levantado arquivo por arquivo antes desta
-- migração. As policies abaixo permitem exatamente esses acessos — recortados
-- pela igreja de quem pergunta — e nada além.
--
-- ── A exceção do anônimo ───────────────────────────────────────────────────
-- `igrejas` é a única tabela legível sem sessão. A tela de cadastro roda no
-- navegador, antes de existir usuário, e precisa validar o código de convite.
-- Não há como fazer isso pelo servidor sem inventar um endpoint só para essa
-- pergunta. As demais leituras públicas (home do visitante) passaram a usar a
-- service role no servidor — ver `app/(app)/home/page.tsx`.

-- ============================================================
-- Funções auxiliares
-- ============================================================
-- `security definer` é o que evita recursão infinita: a policy de `profiles`
-- precisa consultar `profiles` para descobrir a igreja de quem pergunta, e
-- sem contornar a RLS isso se morderia a própria cauda.
--
-- `set search_path` fecha o buraco clássico de função `security definer`: sem
-- ele, quem controlasse o search_path da sessão poderia apontar `profiles`
-- para uma tabela sua.

create or replace function public.user_igreja_id()
returns uuid language sql stable security definer
set search_path = public
as $$ select igreja_id from public.profiles where id = auth.uid() $$;

create or replace function public.user_has_role(check_role text)
returns boolean language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role::text = check_role
  )
$$;

/** A direção da igreja: quem manda em tudo. */
create or replace function public.user_e_direcao()
returns boolean language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role::text in ('pastor', 'admin')
  )
$$;

/** Supervisão para cima — quem mexe na estrutura de redes e células. */
create or replace function public.user_e_gestao()
returns boolean language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role::text in ('supervisor', 'supervisor_treinamento', 'pastor', 'admin')
  )
$$;

/** Líder para cima — quem tem alguma responsabilidade sobre pessoas. */
create or replace function public.user_e_lideranca()
returns boolean language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role::text in ('lider', 'lider_treinamento', 'supervisor',
                         'supervisor_treinamento', 'pastor', 'admin')
  )
$$;

/** A célula é da igreja de quem pergunta? Atravessa célula → rede → igreja. */
create or replace function public.celula_da_minha_igreja(p_celula_id uuid)
returns boolean language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.celulas c
    join public.redes r on r.id = c.rede_id
    where c.id = p_celula_id and r.igreja_id = public.user_igreja_id()
  )
$$;

/** Lidera esta célula? É o que permite ao líder editar a própria célula. */
create or replace function public.user_lidera_celula(p_celula_id uuid)
returns boolean language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.celula_membros
    where celula_id = p_celula_id and user_id = auth.uid() and papel = 'lider'
  )
$$;

-- ============================================================
-- IGREJAS — leitura aberta, escrita fechada
-- ============================================================
alter table public.igrejas enable row level security;

drop policy if exists "igrejas_select"          on public.igrejas;
drop policy if exists "igrejas_insert_service"  on public.igrejas;
drop policy if exists "igrejas_update"          on public.igrejas;

-- Inclui `anon`: o cadastro valida o código de convite antes de existir sessão.
create policy "igrejas_select" on public.igrejas
  for select to anon, authenticated using (true);

-- Sem policy de insert/update/delete: alterar a igreja é coisa da service
-- role, pelo painel. Antes, qualquer um com a chave anônima podia reescrever
-- a chave PIX da igreja.

-- ============================================================
-- PROFILES
-- ============================================================
alter table public.profiles enable row level security;

drop policy if exists "profiles_select"            on public.profiles;
drop policy if exists "profiles_select_own_church" on public.profiles;
drop policy if exists "profiles_insert_own"        on public.profiles;
drop policy if exists "profiles_update_own"        on public.profiles;

-- A policy que estava no banco era `auth.uid() = id` — cada um só se via.
-- Isso quebraria o app inteiro: lista de membros, nome do líder na célula,
-- responsável na escala. O recorte certo é a igreja, que é o que o app já
-- mostra hoje em tela.
create policy "profiles_select" on public.profiles
  for select to authenticated
  using (igreja_id = public.user_igreja_id());

-- O cadastro cria o próprio perfil. Mexer no perfil de terceiro (mudar cargo,
-- vincular pré-cadastro) já passa pela service role, com checagem de cargo.
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check (id = auth.uid());

create policy "profiles_update_own" on public.profiles
  for update to authenticated using (id = auth.uid());

-- ============================================================
-- REDES
-- ============================================================
alter table public.redes enable row level security;

drop policy if exists "redes_select" on public.redes;
drop policy if exists "redes_insert" on public.redes;
drop policy if exists "redes_update" on public.redes;
drop policy if exists "redes_delete" on public.redes;

create policy "redes_select" on public.redes
  for select to authenticated using (igreja_id = public.user_igreja_id());

create policy "redes_insert" on public.redes
  for insert to authenticated
  with check (igreja_id = public.user_igreja_id() and public.user_e_direcao());

create policy "redes_update" on public.redes
  for update to authenticated
  using (igreja_id = public.user_igreja_id() and public.user_e_direcao());

create policy "redes_delete" on public.redes
  for delete to authenticated
  using (igreja_id = public.user_igreja_id() and public.user_e_direcao());

-- ============================================================
-- REDE_SUPERVISORES
-- ============================================================
alter table public.rede_supervisores enable row level security;

drop policy if exists "rede_supervisores_select" on public.rede_supervisores;
drop policy if exists "rede_supervisores_insert" on public.rede_supervisores;
drop policy if exists "rede_supervisores_delete" on public.rede_supervisores;
drop policy if exists "rede_supervisores_update" on public.rede_supervisores;

create policy "rede_supervisores_select" on public.rede_supervisores
  for select to authenticated
  using (exists (
    select 1 from public.redes r
    where r.id = rede_id and r.igreja_id = public.user_igreja_id()
  ));

-- Quem supervisiona qual rede é decisão da direção.
create policy "rede_supervisores_insert" on public.rede_supervisores
  for insert to authenticated
  with check (
    public.user_e_direcao()
    and exists (
      select 1 from public.redes r
      where r.id = rede_id and r.igreja_id = public.user_igreja_id()
    )
  );

create policy "rede_supervisores_update" on public.rede_supervisores
  for update to authenticated
  using (
    public.user_e_direcao()
    and exists (
      select 1 from public.redes r
      where r.id = rede_id and r.igreja_id = public.user_igreja_id()
    )
  );

create policy "rede_supervisores_delete" on public.rede_supervisores
  for delete to authenticated
  using (
    public.user_e_direcao()
    and exists (
      select 1 from public.redes r
      where r.id = rede_id and r.igreja_id = public.user_igreja_id()
    )
  );

-- ============================================================
-- CELULAS
-- ============================================================
alter table public.celulas enable row level security;

drop policy if exists "celulas_select" on public.celulas;
drop policy if exists "celulas_insert" on public.celulas;
drop policy if exists "celulas_update" on public.celulas;
drop policy if exists "celulas_delete" on public.celulas;

create policy "celulas_select" on public.celulas
  for select to authenticated
  using (exists (
    select 1 from public.redes r
    where r.id = rede_id and r.igreja_id = public.user_igreja_id()
  ));

-- Não existia policy de insert nenhuma. Com a RLS ligada e sem esta, criar
-- célula pararia de funcionar na hora.
create policy "celulas_insert" on public.celulas
  for insert to authenticated
  with check (
    public.user_e_gestao()
    and exists (
      select 1 from public.redes r
      where r.id = rede_id and r.igreja_id = public.user_igreja_id()
    )
  );

-- O líder edita a própria célula (nome, horário, local); a gestão edita
-- qualquer uma da igreja. É a mesma regra que `editCelulaAction` aplica.
create policy "celulas_update" on public.celulas
  for update to authenticated
  using (
    exists (
      select 1 from public.redes r
      where r.id = rede_id and r.igreja_id = public.user_igreja_id()
    )
    and (public.user_e_gestao() or public.user_lidera_celula(id))
  );

create policy "celulas_delete" on public.celulas
  for delete to authenticated
  using (
    public.user_e_gestao()
    and exists (
      select 1 from public.redes r
      where r.id = rede_id and r.igreja_id = public.user_igreja_id()
    )
  );

-- ============================================================
-- CELULA_MEMBROS
-- ============================================================
alter table public.celula_membros enable row level security;

drop policy if exists "celula_membros_select" on public.celula_membros;
drop policy if exists "celula_membros_insert" on public.celula_membros;
drop policy if exists "celula_membros_update" on public.celula_membros;
drop policy if exists "celula_membros_delete" on public.celula_membros;

create policy "celula_membros_select" on public.celula_membros
  for select to authenticated
  using (public.celula_da_minha_igreja(celula_id));

-- Quem entra e sai de célula é decisão de liderança. O upsert do app
-- (`addMembroCelulaAction`) precisa de insert e update.
create policy "celula_membros_insert" on public.celula_membros
  for insert to authenticated
  with check (public.user_e_lideranca() and public.celula_da_minha_igreja(celula_id));

create policy "celula_membros_update" on public.celula_membros
  for update to authenticated
  using (public.user_e_lideranca() and public.celula_da_minha_igreja(celula_id));

create policy "celula_membros_delete" on public.celula_membros
  for delete to authenticated
  using (public.user_e_lideranca() and public.celula_da_minha_igreja(celula_id));

-- ============================================================
-- ENCONTROS, ESCALAS, LANCHES
-- ============================================================
-- Só leitura pelo cliente de usuário; toda escrita já passa pela service role
-- depois de conferir cargo. As policies refletem isso: ninguém escreve por
-- aqui.

alter table public.encontros enable row level security;
drop policy if exists "encontros_select" on public.encontros;
drop policy if exists "encontros_insert" on public.encontros;
drop policy if exists "encontros_update" on public.encontros;
drop policy if exists "encontros_delete" on public.encontros;

create policy "encontros_select" on public.encontros
  for select to authenticated
  using (public.celula_da_minha_igreja(celula_id));

alter table public.escalas enable row level security;
drop policy if exists "escalas_select" on public.escalas;
drop policy if exists "escalas_insert" on public.escalas;
drop policy if exists "escalas_update" on public.escalas;
drop policy if exists "escalas_delete" on public.escalas;

create policy "escalas_select" on public.escalas
  for select to authenticated
  using (public.celula_da_minha_igreja(celula_id));

alter table public.lanches enable row level security;
drop policy if exists "lanches_select" on public.lanches;
drop policy if exists "lanches_insert" on public.lanches;
drop policy if exists "lanches_update" on public.lanches;
drop policy if exists "lanches_delete" on public.lanches;

-- `lanches` não tem célula direto — chega nela pelo encontro.
create policy "lanches_select" on public.lanches
  for select to authenticated
  using (exists (
    select 1 from public.encontros e
    where e.id = encontro_id and public.celula_da_minha_igreja(e.celula_id)
  ));

-- ============================================================
-- EVENTOS
-- ============================================================
alter table public.eventos enable row level security;
drop policy if exists "eventos_select" on public.eventos;
drop policy if exists "eventos_insert" on public.eventos;
drop policy if exists "eventos_update" on public.eventos;
drop policy if exists "eventos_delete" on public.eventos;

create policy "eventos_select" on public.eventos
  for select to authenticated
  using (igreja_id = public.user_igreja_id());

-- ============================================================
-- DEPENDENTES, RESUMOS_CULTO, CELULA_APELIDOS
-- ============================================================
alter table public.dependentes enable row level security;
drop policy if exists "dependentes_select" on public.dependentes;

-- Filhos de membro. Leitura dentro da igreja — é o que a tela de célula e a
-- de aniversários mostram. Escrita só pela service role.
create policy "dependentes_select" on public.dependentes
  for select to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = profile_id and p.igreja_id = public.user_igreja_id()
  ));

alter table public.resumos_culto enable row level security;
drop policy if exists "Membros da igreja veem resumos" on public.resumos_culto;
drop policy if exists "Pastor/admin cria resumos"      on public.resumos_culto;
drop policy if exists "Pastor/admin atualiza resumos"  on public.resumos_culto;
drop policy if exists "resumos_culto_select"           on public.resumos_culto;
drop policy if exists "resumos_culto_insert"           on public.resumos_culto;
drop policy if exists "resumos_culto_update"           on public.resumos_culto;

create policy "resumos_culto_select" on public.resumos_culto
  for select to authenticated
  using (igreja_id = public.user_igreja_id());

alter table public.celula_apelidos enable row level security;
drop policy if exists "celula_apelidos_select" on public.celula_apelidos;

-- Só a importação da planilha mexe nisto, e ela usa a service role. A leitura
-- fica liberada dentro da igreja para não travar nada que venha a precisar.
create policy "celula_apelidos_select" on public.celula_apelidos
  for select to authenticated
  using (public.celula_da_minha_igreja(celula_id));

-- ============================================================
-- RPCs que o anônimo não tem o que fazer com
-- ============================================================
-- Estas três não são auxiliares de policy: são consultas de verdade, chamadas
-- pelo servidor com a service role. `saude_celulas` e `presenca_serie`
-- devolvem presença agregada de qualquer célula cujo uuid a pessoa consiga
-- descobrir; `buscar_pre_cadastro_semelhantes` procura gente pelo nome.
--
-- As auxiliares de policy (`user_igreja_id`, `user_e_direcao`,
-- `celula_da_minha_igreja`…) ficam acessíveis de propósito: a expressão de uma
-- policy é avaliada com as permissões de quem faz a consulta, então revogar o
-- EXECUTE delas derrubaria a própria RLS que este arquivo acabou de ligar. O
-- que elas respondem é sobre quem pergunta, não sobre terceiros.

revoke execute on function public.saude_celulas(uuid[])                 from anon;
revoke execute on function public.presenca_serie(uuid[], text, int)     from anon;
revoke execute on function public.buscar_pre_cadastro_semelhantes(text) from anon;
