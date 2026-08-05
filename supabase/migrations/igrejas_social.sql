-- Adiciona campos de presença digital e descrição à tabela igrejas
alter table public.igrejas
  add column if not exists descricao     text,
  add column if not exists instagram_url text,
  add column if not exists facebook_url  text,
  add column if not exists youtube_url   text,
  add column if not exists whatsapp      text;
