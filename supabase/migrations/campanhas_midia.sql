-- ============================================================
-- CAMPANHAS COM CARD, IMAGEM E VÍDEO
-- ============================================================
-- A campanha nasceu como uma linha de texto e um final de centavos — suficiente
-- para a tesouraria separar o extrato, insuficiente para alguém se comover e
-- contribuir. Quem vai construir uma sede mostra a planta; quem vai fazer uma
-- missão mostra o vídeo de quem foi.
--
-- `imagem_url` é o card: o retrato que a campanha leva para a página de
-- contribuição e, quando marcada como destaque, para a home.
-- `video_url` é o vídeo promocional (YouTube, Vimeo ou link direto) — abre
-- dentro da própria página, sem mandar a pessoa para fora do app.

alter table public.campanhas_contribuicao
  add column if not exists imagem_url text,
  add column if not exists video_url  text,
  -- Destaque leva o card para a home. Fica separado de `ativa` porque nem toda
  -- campanha em andamento merece o espaço nobre da primeira tela.
  add column if not exists destaque   boolean not null default false;

-- Bucket público do card e das imagens da campanha. Público como os outros
-- buckets de capa: o conteúdo é justamente o que a igreja quer divulgar.
insert into storage.buckets (id, name, public)
values ('campanhas', 'campanhas', true)
on conflict (id) do nothing;
