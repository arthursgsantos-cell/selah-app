-- ============================================================
-- Seções móveis da home
-- ============================================================
-- `home_secoes_ordem` guarda a ordem escolhida pela liderança para os quatro
-- cartões institucionais da home (ver `lib/home-secoes.ts` para a lista e a
-- razão de cada um estar ou não aqui). Array de ids em texto, ex.:
-- '["contribuir","eventos","proximo_passo","ensino"]'. Nulo = ordem padrão do
-- código.
--
-- `home_secoes_textos` guarda os títulos e subtítulos trocados, por id:
-- '{"ensino": {"titulo": "Estudos", "subtitulo": "..."}}'. Sem entrada para um
-- id, vale o texto padrão do código.

alter table public.igrejas
  add column if not exists home_secoes_ordem  jsonb,
  add column if not exists home_secoes_textos jsonb;

comment on column public.igrejas.home_secoes_ordem is
  'Ordem dos cartões institucionais da home. Array de ids; nulo = ordem padrão.';
comment on column public.igrejas.home_secoes_textos is
  'Título/subtítulo trocados por seção da home. Objeto {id: {titulo, subtitulo}}.';
