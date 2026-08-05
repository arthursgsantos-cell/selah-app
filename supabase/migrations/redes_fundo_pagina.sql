-- Corrige o escopo da aparência: `fundo_tipo`, `cor_secundaria` e a nova
-- `fundo_imagem_url` descrevem o FUNDO DA PÁGINA da rede, não a capa.
-- A capa continua sendo a foto em `capa_url`.

alter table public.redes
  add column if not exists fundo_imagem_url text;

-- A migração anterior marcou fundo_tipo='imagem' para toda rede que tivesse
-- capa. Como agora isso se refere ao fundo da página (que ainda não tem
-- imagem), volta para cor sólida.
update public.redes
set fundo_tipo = 'cor'
where fundo_tipo = 'imagem' and fundo_imagem_url is null;
