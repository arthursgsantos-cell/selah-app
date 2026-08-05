-- ============================================================
-- 1) Padrão de aparência: nébula a 20% de opacidade para quem
--    nunca customizou o fundo (ainda em 'cor'/100%/sem cor 2ª).
-- ============================================================

alter table public.redes   alter column fundo_tipo set default 'nebula';
alter table public.redes   alter column fundo_opacidade set default 20;
alter table public.celulas alter column fundo_tipo set default 'nebula';
alter table public.celulas alter column fundo_opacidade set default 20;

update public.redes
set fundo_tipo = 'nebula', fundo_opacidade = 20
where fundo_tipo = 'cor' and fundo_opacidade = 100 and cor_secundaria is null;

update public.celulas
set fundo_tipo = 'nebula', fundo_opacidade = 20
where fundo_tipo = 'cor' and fundo_opacidade = 100 and cor_secundaria is null;

-- ============================================================
-- 2) Merge Conect 01 (e8083391-...) + Conect 02 (f68c26e9-...)
--    em uma só rede. Mantém o id da 01, apenas renomeia para "Conect".
-- ============================================================

update public.celulas
set rede_id = 'e8083391-f57f-4537-8a93-2ef07f318370'
where rede_id = 'f68c26e9-9cc7-4015-8389-f03af00c8adf';

update public.eventos
set rede_id = 'e8083391-f57f-4537-8a93-2ef07f318370'
where rede_id = 'f68c26e9-9cc7-4015-8389-f03af00c8adf';

-- (confirmado antes: nenhuma das duas tinha linhas em rede_supervisores,
-- então não há risco de conflito de chave primária aqui)
update public.rede_supervisores
set rede_id = 'e8083391-f57f-4537-8a93-2ef07f318370'
where rede_id = 'f68c26e9-9cc7-4015-8389-f03af00c8adf';

update public.redes
set nome = 'Conect',
    supervisor_nome = 'Lazaro e Flávia · Davidson e Gisele · Eduardo e Camila · Thiago e Délia'
where id = 'e8083391-f57f-4537-8a93-2ef07f318370';

delete from public.redes where id = 'f68c26e9-9cc7-4015-8389-f03af00c8adf';
