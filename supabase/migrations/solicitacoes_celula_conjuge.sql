-- ============================================================
-- CÔNJUGE NA SOLICITAÇÃO DE CÉLULA
-- ============================================================
-- Quem pede célula casado(a) não entra sozinho: o casal é encaminhado junto,
-- e o líder precisa do contato dos dois para convidar. Antes o formulário
-- registrava só "Casado(a)" e a informação vinha depois, por WhatsApp.
--
-- As três colunas ficam nulas em quem não é casado — o formulário só mostra os
-- campos quando o estado civil pede.

alter table public.solicitacoes_celula
  add column if not exists conjuge_nome     varchar(120),
  add column if not exists conjuge_telefone varchar(40),
  add column if not exists conjuge_idade    integer;
