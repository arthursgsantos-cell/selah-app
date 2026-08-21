-- ============================================================
-- FILHO COMPARTILHADO PELO CASAL
-- ============================================================
-- `dependentes` nasceu preso a um perfil só. Quando pai e mãe têm conta
-- separada, cada um cadastra os mesmos filhos e a aba de aniversários lista a
-- criança duas vezes — porque são, de fato, duas linhas.
--
-- `co_profile_id` é o segundo responsável. A linha continua tendo um dono
-- (`profile_id`, quem cadastrou), mas passa a valer para os dois: leituras que
-- perguntam "quais os filhos desta pessoa" precisam olhar as duas colunas.
--
-- Não viramos isto numa tabela `familias` porque o vínculo de casal já mora em
-- `profiles.conjuge_id`; uma terceira representação da mesma relação só criaria
-- mais um lugar para os dados discordarem.

alter table public.dependentes
  add column if not exists co_profile_id uuid references public.profiles(id) on delete set null;

comment on column public.dependentes.co_profile_id is
  'Segundo responsável pelo dependente (o cônjuge de profile_id). Preenchido no vínculo do casal e na mesclagem de duplicatas. Nulo = dependente de um responsável só.';

create index if not exists dependentes_co_profile_id_idx
  on public.dependentes (co_profile_id)
  where co_profile_id is not null;

-- Ninguém é o próprio co-responsável: isso duplicaria a linha nas leituras
-- que fazem `profile_id = X or co_profile_id = X`.
alter table public.dependentes
  drop constraint if exists dependentes_co_profile_id_distinto;

alter table public.dependentes
  add constraint dependentes_co_profile_id_distinto
  check (co_profile_id is null or co_profile_id <> profile_id);

-- A política antiga só enxergava a igreja pelo dono. Um dependente cujo dono
-- saiu da igreja mas cujo co-responsável ficou continuaria aparecendo para o
-- casal na aplicação e sumindo na leitura direta — a política acompanha os
-- dois lados agora.
drop policy if exists "dependentes_select" on public.dependentes;

create policy "dependentes_select" on public.dependentes
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = profile_id and p.igreja_id = public.user_igreja_id()
    )
    or exists (
      select 1 from public.profiles p
      where p.id = co_profile_id and p.igreja_id = public.user_igreja_id()
    )
  );
