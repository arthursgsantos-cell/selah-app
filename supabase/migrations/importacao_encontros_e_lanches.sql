-- Libera os dois novos tipos da importação automática:
--
--   encontro_celula → o card de informações do encontro da célula
--   lanche          → um item da lista de lanche daquele encontro
--
-- O que entra em `chave`:
--   encontro_celula → "<celula_id>@<AAAA-MM-DD>"
--   lanche          → "<encontro_id>#<slug do item>"

alter table public.importacoes
  drop constraint if exists importacoes_tipo_check;

alter table public.importacoes
  add constraint importacoes_tipo_check
  check (tipo in ('roteiro', 'foto_celula', 'evento', 'encontro_celula', 'lanche'));
