-- Confirmação de presença em eventos ("vou" / "não vou").
-- Não existia migração para esta tabela, apesar de o código já usá-la em
-- app/actions/evento-presencas.ts e app/(app)/home/page.tsx.
-- Estrutura derivada de lib/supabase/types.ts e do upsert com
-- onConflict 'evento_id,user_id'.

create table if not exists public.evento_presencas (
  evento_id uuid not null references public.eventos(id)  on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  resposta  text not null check (resposta in ('vou', 'nao_vou')),
  primary key (evento_id, user_id)
);

create index if not exists evento_presencas_evento_idx
  on public.evento_presencas (evento_id);

alter table public.evento_presencas enable row level security;

drop policy if exists "evento_presencas_select" on public.evento_presencas;
drop policy if exists "evento_presencas_insert" on public.evento_presencas;
drop policy if exists "evento_presencas_update" on public.evento_presencas;
drop policy if exists "evento_presencas_delete" on public.evento_presencas;

-- Todos veem quem confirmou; cada um só mexe na própria resposta
create policy "evento_presencas_select" on public.evento_presencas
  for select to authenticated using (true);

create policy "evento_presencas_insert" on public.evento_presencas
  for insert to authenticated with check (user_id = auth.uid());

create policy "evento_presencas_update" on public.evento_presencas
  for update to authenticated using (user_id = auth.uid());

create policy "evento_presencas_delete" on public.evento_presencas
  for delete to authenticated using (user_id = auth.uid());
