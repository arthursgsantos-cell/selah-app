-- ============================================================
-- LAYOUT DA HOME, POR PESSOA
-- ============================================================
-- A home passou a ter duas caras: a Landing Page completa, com todas as seções
-- que a liderança monta em `igrejas.home_secoes_*`, e o Modo Ícones, uma grade
-- de atalhos para quem abre o app só para chegar a algum lugar.
--
-- A escolha é de cada pessoa, não da igreja — por isso mora em `profiles` e não
-- em `igrejas`. Ficava no `localStorage` na primeira versão: quem trocava de
-- celular perdia a preferência e via o convite de escolha de novo.
--
-- `null` é um estado de verdade, e não "landing": significa "ainda não
-- escolheu", que é o que faz o convite aparecer uma única vez. Depois de
-- escolher, nunca mais volta a null — a troca vive em Meu perfil → Aparência.

alter table public.profiles
  add column if not exists home_layout text;

alter table public.profiles
  drop constraint if exists profiles_home_layout_check;

alter table public.profiles
  add constraint profiles_home_layout_check
  check (home_layout is null or home_layout in ('landing', 'icones'));

comment on column public.profiles.home_layout is
  'Layout da home escolhido pela pessoa: landing | icones. Null = ainda não escolheu.';
