-- ============================================================
-- PRIMEIRO ACESSO: QUANDO A PESSOA COMPLETOU O PERFIL
-- ============================================================
-- Quem entra pela primeira vez tem só o nome e o e-mail que vieram do Google.
-- Sem telefone e sem data de nascimento, a liderança não consegue nem chamar
-- no WhatsApp nem parabenizar — e a pessoa não descobre sozinha que a tela de
-- perfil existe.
--
-- A coluna é o que decide se o convite de boas-vindas aparece. Fica preenchida
-- na primeira vez que a pessoa salva o perfil, e não volta mais.
--
-- Por que uma coluna e não "telefone is null": porque quem preencheu e depois
-- apagou o telefone veria o convite de novo, como se nunca tivesse entrado.

alter table public.profiles
  add column if not exists perfil_completado_em timestamptz;

-- Quem já está no app há tempo não deve receber o convite como se fosse novo:
-- se tem telefone ou data de nascimento, o perfil já passou pela mão da pessoa.
update public.profiles
   set perfil_completado_em = coalesce(updated_at, created_at, now())
 where perfil_completado_em is null
   and (telefone is not null or data_nascimento_1 is not null);
