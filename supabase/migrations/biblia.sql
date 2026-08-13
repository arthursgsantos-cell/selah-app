-- ============================================================
-- BÍBLIA — o texto dentro do app
-- ============================================================
-- Entra por causa dos desafios de leitura ("ler 30x a carta de Tiago",
-- "de Mateus a Apocalipse até o dia X"): para o app montar o cronograma ele
-- precisa saber quantos capítulos tem cada livro, e para o aluno cumprir a
-- meta sem sair do app ele precisa do texto.
--
-- ## Por que só versões em domínio público
--
-- NVI, ARA, NAA, NTLH e ACF são obras protegidas — SBB, Biblica e BV Books
-- licenciam cada uma. Guardar o texto integral delas aqui exigiria contrato.
-- As que entram são as livres, e o esquema não impede que uma licenciada seja
-- somada depois: é só mais uma linha em `biblia_versoes`, com
-- `dominio_publico = false` documentando de onde veio o direito.
--
-- ## Por que o texto no nosso banco, e não numa API
--
-- O plano de leitura conta capítulos e marca progresso a cada abertura de
-- tela. Numa API externa isso vira uma chamada de rede por leitura, com chave,
-- cota e uma tela em branco toda vez que a rede do salão cai. Aqui é um
-- `select` com índice.

-- ---------------------------------------------------------------------------
-- Livros — os mesmos 66 em qualquer versão, então tabela à parte
-- ---------------------------------------------------------------------------
-- O id é a ordem canônica (1 = Gênesis, 66 = Apocalipse). Um smallint
-- ordenável dispensa uma coluna `ordem` e deixa `order by livro_id` correto.

create table if not exists public.biblia_livros (
  id         smallint primary key,
  sigla      text not null unique,
  nome       text not null,
  testamento text not null check (testamento in ('AT', 'NT')),
  -- Quantos capítulos o livro tem. É o número de que o cronograma precisa, e
  -- tê-lo aqui evita um `count(distinct capitulo)` a cada cálculo.
  capitulos  smallint not null check (capitulos > 0)
);

-- ---------------------------------------------------------------------------
-- Versões
-- ---------------------------------------------------------------------------

create table if not exists public.biblia_versoes (
  id              text primary key,
  nome            text not null,
  abreviacao      text not null,
  ano             smallint,
  -- Falso só se um dia entrar uma versão licenciada; `fonte` então guarda o
  -- contrato ou a permissão que autoriza.
  dominio_publico boolean not null default true,
  fonte           text,
  ordem           smallint not null default 0
);

-- ---------------------------------------------------------------------------
-- Versículos
-- ---------------------------------------------------------------------------
-- A chave primária composta é também o índice de leitura: toda consulta da
-- tela é "esta versão, este livro, este capítulo", nesta ordem. Um id uuid
-- separado só acrescentaria 16 bytes por linha em ~31 mil linhas por versão.

create table if not exists public.biblia_versiculos (
  versao_id text     not null references public.biblia_versoes(id) on delete cascade,
  livro_id  smallint not null references public.biblia_livros(id)  on delete cascade,
  capitulo  smallint not null check (capitulo > 0),
  versiculo smallint not null check (versiculo > 0),
  texto     text     not null,
  primary key (versao_id, livro_id, capitulo, versiculo)
);

-- Busca por palavra. `portuguese` já derruba acento e reduz radical, então
-- "salvação" encontra "salvar".
create index if not exists biblia_versiculos_busca_idx
  on public.biblia_versiculos
  using gin (to_tsvector('portuguese', texto));

-- ---------------------------------------------------------------------------
-- Os 66 livros
-- ---------------------------------------------------------------------------

insert into public.biblia_livros (id, sigla, nome, testamento, capitulos) values
  (1,'gn','Gênesis','AT',50),            (2,'ex','Êxodo','AT',40),
  (3,'lv','Levítico','AT',27),           (4,'nm','Números','AT',36),
  (5,'dt','Deuteronômio','AT',34),       (6,'js','Josué','AT',24),
  (7,'jz','Juízes','AT',21),             (8,'rt','Rute','AT',4),
  (9,'1sm','1 Samuel','AT',31),          (10,'2sm','2 Samuel','AT',24),
  (11,'1rs','1 Reis','AT',22),           (12,'2rs','2 Reis','AT',25),
  (13,'1cr','1 Crônicas','AT',29),       (14,'2cr','2 Crônicas','AT',36),
  (15,'ed','Esdras','AT',10),            (16,'ne','Neemias','AT',13),
  (17,'et','Ester','AT',10),             (18,'jó','Jó','AT',42),
  (19,'sl','Salmos','AT',150),           (20,'pv','Provérbios','AT',31),
  (21,'ec','Eclesiastes','AT',12),       (22,'ct','Cantares','AT',8),
  (23,'is','Isaías','AT',66),            (24,'jr','Jeremias','AT',52),
  (25,'lm','Lamentações','AT',5),        (26,'ez','Ezequiel','AT',48),
  (27,'dn','Daniel','AT',12),            (28,'os','Oseias','AT',14),
  (29,'jl','Joel','AT',3),               (30,'am','Amós','AT',9),
  (31,'ob','Obadias','AT',1),            (32,'jn','Jonas','AT',4),
  (33,'mq','Miqueias','AT',7),           (34,'na','Naum','AT',3),
  (35,'hc','Habacuque','AT',3),          (36,'sf','Sofonias','AT',3),
  (37,'ag','Ageu','AT',2),               (38,'zc','Zacarias','AT',14),
  (39,'ml','Malaquias','AT',4),
  (40,'mt','Mateus','NT',28),            (41,'mc','Marcos','NT',16),
  (42,'lc','Lucas','NT',24),             (43,'jo','João','NT',21),
  (44,'at','Atos','NT',28),              (45,'rm','Romanos','NT',16),
  (46,'1co','1 Coríntios','NT',16),      (47,'2co','2 Coríntios','NT',13),
  (48,'gl','Gálatas','NT',6),            (49,'ef','Efésios','NT',6),
  (50,'fp','Filipenses','NT',4),         (51,'cl','Colossenses','NT',4),
  (52,'1ts','1 Tessalonicenses','NT',5), (53,'2ts','2 Tessalonicenses','NT',3),
  (54,'1tm','1 Timóteo','NT',6),         (55,'2tm','2 Timóteo','NT',4),
  (56,'tt','Tito','NT',3),               (57,'fm','Filemom','NT',1),
  (58,'hb','Hebreus','NT',13),           (59,'tg','Tiago','NT',5),
  (60,'1pe','1 Pedro','NT',5),           (61,'2pe','2 Pedro','NT',3),
  (62,'1jo','1 João','NT',5),            (63,'2jo','2 João','NT',1),
  (64,'3jo','3 João','NT',1),            (65,'jd','Judas','NT',1),
  (66,'ap','Apocalipse','NT',22)
on conflict (id) do update
  set nome = excluded.nome, capitulos = excluded.capitulos,
      sigla = excluded.sigla, testamento = excluded.testamento;

-- ---------------------------------------------------------------------------
-- As versões previstas
-- ---------------------------------------------------------------------------
-- As linhas entram agora, mesmo antes do texto: com o livro e a contagem de
-- capítulos já no banco, o cronograma de leitura funciona por completo antes
-- de qualquer versículo ser importado. A tela de leitura é que fica esperando.

insert into public.biblia_versoes (id, nome, abreviacao, ano, dominio_publico, fonte, ordem) values
  ('acf', 'Almeida Corrigida', 'AC', 1911, true,
   'João Ferreira de Almeida, edição de 1911 — domínio público', 1),
  ('aa',  'Almeida Revisada Imprensa Bíblica', 'AA', 1914, true,
   'Almeida Revisada segundo os melhores textos — domínio público', 2),
  ('blivre', 'Bíblia Livre', 'BLIVRE', 2018, true,
   'Projeto Bíblia Livre — domínio público / CC0', 3)
on conflict (id) do update
  set nome = excluded.nome, abreviacao = excluded.abreviacao,
      fonte = excluded.fonte, ordem = excluded.ordem;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
-- A Bíblia é leitura para todo mundo que entrou no app. Escrita não tem
-- policy nenhuma de propósito: o texto entra pela rota de importação, com o
-- cliente admin, e nada no app deveria poder alterá-lo.

alter table public.biblia_livros      enable row level security;
alter table public.biblia_versoes     enable row level security;
alter table public.biblia_versiculos  enable row level security;

drop policy if exists "biblia_livros_select"     on public.biblia_livros;
drop policy if exists "biblia_versoes_select"    on public.biblia_versoes;
drop policy if exists "biblia_versiculos_select" on public.biblia_versiculos;

create policy "biblia_livros_select" on public.biblia_livros
  for select to authenticated using (true);

create policy "biblia_versoes_select" on public.biblia_versoes
  for select to authenticated using (true);

create policy "biblia_versiculos_select" on public.biblia_versiculos
  for select to authenticated using (true);
