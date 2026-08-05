-- Aparência customizável da rede: além da cor principal (coluna `cor`, que já
-- existe), permite escolher o tipo de fundo da capa e uma segunda cor para
-- degradê/nébula.

alter table public.redes
  add column if not exists cor_secundaria text,
  add column if not exists fundo_tipo     text not null default 'cor';

alter table public.redes
  drop constraint if exists redes_fundo_tipo_check;

alter table public.redes
  add constraint redes_fundo_tipo_check
  check (fundo_tipo in ('cor', 'gradiente', 'nebula', 'imagem'));

-- Redes que já têm capa continuam mostrando a imagem
update public.redes set fundo_tipo = 'imagem'
where capa_url is not null and fundo_tipo = 'cor';
