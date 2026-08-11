-- Capa própria da página da turma.
--
-- `capa_url` continua sendo o card das listagens — retrato, arte de curso. O
-- topo da página pede uma arte larga, e usar a mesma imagem nos dois lugares
-- cortava uma das duas. Nulo aqui significa "mostre o card", como no evento.
alter table public.ensino_turmas
  add column if not exists capa_pagina_url text;

comment on column public.ensino_turmas.capa_pagina_url is
  'Capa exclusiva do topo da página. Nulo = usa capa_url (o card).';
