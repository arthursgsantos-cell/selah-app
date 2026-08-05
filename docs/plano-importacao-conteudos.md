# Ampliação da importação de conteúdos (roteiros, fotos de célula, eventos)

Especificação acordada com o Arthur em 29/07/2026. A importação de **roteiros já
funciona e não deve ser alterada** — serve de modelo para as duas novas.

## O que já existe (não mexer)

`lib/roteiros-sync.ts` + `app/api/roteiros/sync/route.ts` (cron diário às 6h UTC):

- Lê uma **planilha publicada do Google Sheets em CSV** (`ROTEIROS_SHEET_CSV_URL`)
- Resolve o id de cada arquivo listando a **pasta compartilhada do Drive**
  (`ROTEIROS_DRIVE_FOLDER_ID`), com ou sem `GOOGLE_DRIVE_API_KEY`
- Deduplica por `resumos_culto.arquivo_nome`
- Peças reaproveitáveis: `parseCsv`, `listarArquivosDaPasta`, `acharIdDoArquivo`,
  `normalizarData`

## Fonte confirmada (29/07/2026)

Planilha publicada como documento inteiro:

```
https://docs.google.com/spreadsheets/d/e/2PACX-1vSUr0ln0Ku94tsKXeUfxAK9Pt0iyNOlxVvvDrHuZchLmGqJ7EKNqT3mBfm-tOSXQw/pub
```

Pasta do Drive (mesma dos PDFs, já em `ROTEIROS_DRIVE_FOLDER_ID`):
`1eLkIWBptd2kC_OKcqz0wUV6x8TM7oJSn`

**NUNCA gravar `gid` fixo no código.** Verificado na prática: republicar a
planilha troca todos os gids (de `796592018/370468935/39939655` para
`13685567/485884091/1557160570` em minutos). A importação deve:

1. baixar `.../pubhtml`
2. extrair os `gid` disponíveis
3. baixar cada `?gid=<g>&single=true&output=csv` **seguindo redirect** (o Google
   responde 307; sem `-L`/`redirect: follow` vem HTML em vez de CSV)
4. identificar a aba **pelo cabeçalho**, não pela posição nem pelo gid

Assinaturas de cabeçalho para reconhecer cada aba:

| Aba | Colunas |
|---|---|
| Roteiros | `Nome, Data, Quem Publicou, Resumo, Resumo Detalhado` |
| Fotos das Células | `Nome do arquivo, Quem publicou, Nome da célula, Data e hora da publicação (Brasília)` |
| Eventos | `Nome da imagem, Quem publicou, Nome do evento, Data do evento, Data e hora da publicação (Brasília), Local do evento, Resumo do evento, Link de inscrição, Destino` |

### Correções necessárias nos roteiros

- `ROTEIROS_SHEET_CSV_URL` aponta para uma publicação **morta** (HTTP 500). Trocar
  pela nova.
- O código pega a **primeira** coluna que contém "resumo" — que é `Resumo`, a
  curta. A spec pede `Resumo Detalhado`. Corrigir a seleção de coluna.

### Estado dos dados em 29/07/2026

- Roteiros: 2 linhas, ambas o mesmo `roteiro_celula_2026-07-26.pdf` (a dedup por
  nome já cobre)
- Fotos: 5 linhas — Omega, Impacto, Renascer, Ágape, Alpha
- Eventos: só cabeçalho, sem dados ainda

**Células das fotos — resolvido em 29/07/2026:**

- `Omega` → criada (rede **Conect**, chute meu; Arthur precisa confirmar a rede)
- `Alpha` → é a célula `Alfa` escrita errada no WhatsApp. Virou **apelido**, não
  célula nova.

### Resolução de nome de célula na importação

Criada a tabela `celula_apelidos` + a função `public.normalizar_nome(text)`
(minúsculas, sem acento, sem espaços nas pontas).

A importação deve resolver o nome vindo da planilha nesta ordem:

1. `normalizar_nome(celulas.nome)` = `normalizar_nome(nome da planilha)`
2. `normalizar_nome(celula_apelidos.apelido)` = idem
3. não achou → **pendência** em `importacoes`, sem criar célula

O site sempre exibe `celulas.nome`. O apelido serve só para a importação
entender a grafia do WhatsApp. Novos apelidos são linhas na tabela — nenhuma
mudança de código.

### Estrutura da pasta do Drive (importante)

A pasta `1eLkIWBptd2kC_OKcqz0wUV6x8TM7oJSn` contém:

```
Controle_Roteiros_IBZS.xlsx      <- a planilha
roteiro_celula_2026-07-26.pdf    <- PDFs dos roteiros ficam na raiz
Fotos das Células/               <- SUBPASTA
Eventos/                         <- SUBPASTA
```

**As fotos e os cards estão em subpastas**, não na raiz. `listarArquivosDaPasta()`
hoje só olha a pasta informada — precisa passar a resolver o id de cada subpasta
(pelo nome) e listar dentro dela. Os PDFs de roteiro continuam na raiz.

### Status da fonte em 29/07/2026 (após o ajuste do Zapia)

Verificado: o Zapia passou a escrever na planilha existente em vez de re-subir o
arquivo. Os gids se mantiveram estáveis entre duas verificações
(`13685567` Roteiros, `485884091` Fotos, `1557160570` Eventos) e o
`ROTEIROS_SHEET_CSV_URL` em produção já aponta para a publicação válida.

Mesmo assim, **manter a descoberta dinâmica pelo cabeçalho** — é o que protege de
uma futura recriação de aba.

## Dependência bloqueante (RESOLVIDA)

**A URL publicada atual está morta.** Em 29/07/2026 o `ROTEIROS_SHEET_CSV_URL`
retorna HTTP 500 de forma consistente (três tentativas), devolvendo a página de
erro do Google em vez do CSV. O último roteiro importado com sucesso foi
`roteiro_celula_2026-07-26.pdf` em 27/07 — ou seja, a importação de roteiros
está quebrada desde então, apesar de parecer estar funcionando.

Causa provável: a planilha foi reorganizada nas três abas atuais
(`Controle_Roteiros_IBZS.xlsx`) e a publicação antiga deixou de valer.

O que resolve tudo de uma vez: republicar a planilha em
**Arquivo → Compartilhar → Publicar na web**, escolhendo **"Documento inteiro"**
(não uma aba só) e formato CSV. Com o documento inteiro publicado:

- `.../pubhtml` passa a listar todas as abas com seus `gid`
- cada aba vira `.../pub?gid=<gid>&single=true&output=csv`
- a descoberta é automática pelo nome da aba — **nenhuma variável nova**, e abas
  futuras funcionam sem mexer no código

A fonte é sempre o Google Sheets, nunca o `.xlsx` local.

Verificar também se as imagens (fotos e cards) estão na mesma pasta do Drive dos
PDFs. Se não, será preciso um id de pasta adicional.

## Tabela de controle (seção 6 da spec)

```sql
create table public.importacoes (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references public.igrejas(id) on delete cascade,
  tipo text not null check (tipo in ('roteiro','foto_celula','evento')),
  -- Identificador estável do item na origem. Para foto: hash do conteúdo.
  chave text not null,
  arquivo_nome text,
  celula_id uuid references public.celulas(id) on delete set null,
  destino text,
  grupo_origem text,
  registro_id uuid,           -- id da linha criada no destino final
  status text not null default 'importado'
    check (status in ('importado','ignorado','pendente','erro')),
  motivo text,
  importado_em timestamptz not null default now(),
  unique (igreja_id, tipo, chave)
);
```

A `unique (igreja_id, tipo, chave)` é o que torna a importação repetível com
segurança — rodar de novo não duplica.

## Fotos das células

Colunas: Nome do arquivo · Quem publicou · Nome da célula · Data e hora.

- Chave de dedup: **hash SHA-256 do conteúdo da imagem**, não o nome do arquivo.
  A spec pede ignorar "cópia idêntica" mesmo com nome diferente, e preservar
  fotos diferentes da mesma célula.
- Destino: `fotos_comunidade` com `celula_id` preenchido (a tabela já aceita
  `encontro_id` opcional, adicionado em 28/07).
- Célula resolvida por nome, sem diferenciar acento/caixa.
- **Célula inexistente:** registrar em `importacoes` com `status='pendente'` e o
  nome da célula em `motivo`. Não criar célula automaticamente sem confirmação —
  um erro de digitação na planilha criaria célula fantasma.

## Eventos

Colunas: Nome da imagem · Quem publicou · Nome do evento · Data do evento ·
Data/hora da publicação · Local · Resumo · Link de inscrição · Destino.

- Chave de dedup: `slug(nome do evento) + data do evento`. Segundas chamadas,
  lembretes e cards diferentes do mesmo evento caem na mesma chave.
- Ao reencontrar um evento já importado: **atualizar**, nunca criar outro.
  Preencher campos vazios; substituir a imagem só se a nova for maior
  (heurística para "card mais completo").
- `Destino` é a fonte oficial e **não deve ser inferido nem alterado**:
  - "Rede One" / "Rede Connect" → `eventos.rede_id` da rede correspondente,
    `tipo = 'rede'`
  - "Igreja" ou vazio → `rede_id = null`, `tipo = 'igreja'`
  - Rede não encontrada pelo nome → `status='pendente'`, sem descartar
- Link de inscrição → `tipo_inscricao = 'link'` + `link_inscricao_url`

## Ordem sugerida de implementação

1. Migração da tabela `importacoes`
2. Refatorar `roteiros-sync.ts`: extrair as partes genéricas (CSV, Drive) para
   `lib/importacao/` sem mudar o comportamento dos roteiros
3. Fotos de célula (mais simples, valida a mecânica de hash e pendências)
4. Eventos (mais complexo pelo update incremental)
5. Página de controle mostrando importados / ignorados / pendentes / erros

## Verificações que a spec exige (só possíveis executando)

- Roteiros antigos continuam funcionando
- Fotos vão para a galeria correta
- Eventos respeitam o `Destino`
- Nada apagado, nada duplicado

Rodar a importação duas vezes seguidas e conferir que a segunda execução só
produz "ignorados" é o teste que cobre a maior parte disso.

## Implementado em 03/08/2026

Código em `lib/importacao/` (`planilha`, `drive`, `destinos`, `registro`,
`texto`, `fotos`, `eventos`) + `lib/roteiros-sync.ts`. Rota única
`/api/importacao/sync` (GET cron com `CRON_SECRET`, POST para pastor/admin);
o cron do `vercel.json` aponta para ela. Painel em `/pastor`.

Verificado em produção: duas execuções seguidas produziram só "ignorados"
(2 roteiros, 5 fotos, 1 evento). Nenhuma variável de ambiente nova.

Decisões que a spec não cobria:

- **Fotos em dois lugares.** A subpasta "Fotos das Células" tem arquivos
  soltos *e* subpastas por célula. A busca olha a raiz primeiro e só desce
  para a subpasta da célula quando não acha — evita listar 40 subpastas.
- **Rerrodada barata.** A chave de dedup é o hash, mas `arquivo_nome` também
  fica gravado: se a foto já foi resolvida, a execução seguinte a ignora sem
  baixar a imagem de novo. Pendências e erros usam a chave provisória
  `arquivo:<nome>` e são retentados.
- **Hora presumida.** "Data do evento" costuma vir sem horário
  ("20 e 21/11/2026"). Nesse caso o evento entra às **19h** de Brasília — ver
  `HORA_PADRAO` em `lib/importacao/texto.ts`. 00h apareceria como "às 00h00"
  na tela.
- **Colisão com evento criado à mão.** O retiro da Rede One já existia no app
  como "1º Retiro Rede One"; a planilha traz "1º Retiro **da** Rede One", e o
  slug não bateu. Resolvido apontando `importacoes.registro_id` para o evento
  manual — a partir daí a planilha atualiza aquele registro. É o remédio
  sempre que a importação duplicar algo que já existia.
