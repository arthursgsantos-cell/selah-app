-- Página própria de cada evento: vídeo (trailer) e galeria de fotos do local.

alter table public.eventos
  add column if not exists video_url text;

create table if not exists public.evento_fotos (
  id         uuid primary key default gen_random_uuid(),
  evento_id  uuid not null references public.eventos(id) on delete cascade,
  url        text not null,
  legenda    text,
  ordem      int  not null default 0,
  criado_por uuid references public.profiles(id) on delete set null,
  criado_em  timestamptz not null default now()
);

create index if not exists evento_fotos_evento_idx
  on public.evento_fotos (evento_id, ordem);

alter table public.evento_fotos enable row level security;

drop policy if exists "evento_fotos_select" on public.evento_fotos;
drop policy if exists "evento_fotos_insert" on public.evento_fotos;
drop policy if exists "evento_fotos_update" on public.evento_fotos;
drop policy if exists "evento_fotos_delete" on public.evento_fotos;

-- Mesma convenção permissiva das demais tabelas deste banco
create policy "evento_fotos_select" on public.evento_fotos for select to authenticated using (true);
create policy "evento_fotos_insert" on public.evento_fotos for insert to authenticated with check (true);
create policy "evento_fotos_update" on public.evento_fotos for update to authenticated using (true);
create policy "evento_fotos_delete" on public.evento_fotos for delete to authenticated using (true);

-- Bucket das fotos do evento
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('evento-fotos', 'evento-fotos', true, 10485760,
        array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do nothing;

drop policy if exists "evento_fotos_obj_select" on storage.objects;
drop policy if exists "evento_fotos_obj_insert" on storage.objects;
drop policy if exists "evento_fotos_obj_delete" on storage.objects;

create policy "evento_fotos_obj_select" on storage.objects
  for select using (bucket_id = 'evento-fotos');
create policy "evento_fotos_obj_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'evento-fotos');
create policy "evento_fotos_obj_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'evento-fotos');
