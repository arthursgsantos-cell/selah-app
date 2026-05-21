-- Bucket público para avatares de perfil
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/jpeg','image/png','image/webp','image/heic'])
on conflict (id) do update set public = true;

-- Leitura pública (qualquer um pode ver fotos de perfil)
create policy "avatars_select" on storage.objects
  for select using (bucket_id = 'avatars');

-- Apenas admin/pastor pode fazer upload de avatar de outro usuário
-- O próprio usuário pode fazer upload do seu avatar (path = seu user_id)
create policy "avatars_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'avatars');

create policy "avatars_update" on storage.objects
  for update to authenticated using (bucket_id = 'avatars');

create policy "avatars_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'avatars');
