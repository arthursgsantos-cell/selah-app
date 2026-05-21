-- Adiciona campos do pastor e informações de culto
alter table public.igrejas
  add column if not exists pastor_nome     text,
  add column if not exists pastor_titulo   text,
  add column if not exists pastor_foto_url text,
  add column if not exists horario_culto   text,
  add column if not exists endereco        text,
  add column if not exists fundada_em      integer;

-- Preenche dados da IBZona Sul
update public.igrejas set
  pastor_nome     = 'Marcelo França',
  pastor_titulo   = 'Pastor Titular',
  horario_culto   = 'Dom: 10h • 17h • 19h',
  endereco        = 'R. Cap. Aviador Heraldo Cunha, 1298 — Parnamirim, RN',
  fundada_em      = 1992
where id = (select id from public.igrejas limit 1);
