-- Duração do evento: horário de término, opcional.
alter table public.eventos
  add column if not exists data_hora_fim timestamptz;
