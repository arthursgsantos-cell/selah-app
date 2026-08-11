-- ============================================================================
-- Videochamada da turma, e a inscrição pelo WhatsApp virando o próprio grupo
--
-- Duas mudanças do mesmo dia no módulo de Ensino. Nenhuma altera turma
-- existente: a videochamada nasce desligada e o campo que sai não era usado
-- por turma nenhuma.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Inscrição pelo WhatsApp: o destino é o grupo, não um número
--
-- O sentido dessa inscrição sempre foi entrar no grupo da turma — é lá que a
-- confirmação acontece. Guardar um número à parte, para mandar uma mensagem
-- pré-digitada, era um segundo campo para uma coisa só, e uma mensagem que
-- ninguém pediu. `whatsapp_url`, que já guardava o grupo, passa a ser também o
-- destino da inscrição, e por isso vira obrigatório quando o tipo é
-- `whatsapp` — sem ele o botão não teria para onde levar.
-- ---------------------------------------------------------------------------

alter table public.ensino_turmas
  drop column if exists whatsapp_inscricao;

-- ---------------------------------------------------------------------------
-- Videochamada
--
-- Turma que se reúne pelo Meet, Zoom ou Teams precisa de um "entrar na
-- chamada" do mesmo jeito que a presencial precisa de sala. No uso real há
-- dois arranjos: uma sala fixa para o curso inteiro, ou um link por encontro —
-- que é o que sai de quem agenda cada aula no Google Agenda.
--
-- O modo é escolha do professor ao criar a turma, e não dedução a partir dos
-- links preenchidos: sem ele, aula sem link ficaria ambígua entre "usa o da
-- turma" e "o professor ainda não colou o dela".
-- ---------------------------------------------------------------------------

alter table public.ensino_turmas
  add column if not exists video_chamada_modo text not null default 'nenhum'
    check (video_chamada_modo in ('nenhum', 'turma', 'aula')),
  -- Só vale em `video_chamada_modo = 'turma'`: a sala do curso inteiro.
  add column if not exists video_chamada_url text;

-- Só vale em `video_chamada_modo = 'aula'`: o link daquele encontro.
alter table public.ensino_aulas
  add column if not exists video_chamada_url text;
