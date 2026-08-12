# Aba "Ensino" na planilha de controle da IBZS

Toda vez que uma turma do Ensino é criada, editada, destacada ou excluída no
app, o Selah grava a mesma informação na aba `Ensino` da planilha
[`Controle_Roteiros_IBZS`](https://docs.google.com/spreadsheets/d/1NSt294COEak1PDBs9jOZPS8fb4v4HUg-ogiZMfjK-1Y/edit).
É **registro secundário**: o Supabase continua sendo a fonte da verdade, e a
planilha serve para consultar, filtrar e imprimir sem depender do app.

A escrita nunca derruba a gravação da turma. Se a planilha estiver fora do ar ou
o script mal publicado, o erro vira log no servidor e a turma é salva do mesmo
jeito.

## Colunas

| Coluna | De onde vem |
| --- | --- |
| ID | `ensino_turmas.id` — é a chave: editar a turma **atualiza a linha**, não cria outra |
| Curso | nome do curso (`ensino_cursos.nome`) |
| Turma | nome da turma |
| Professores | equipe da turma, o principal primeiro |
| Período | "10/03 a 26/05" |
| Encontros | "Terças · 19h30 às 21h" |
| Local | local da turma |
| Modo | Presencial / Gravado |
| Status | Inscrições abertas / Em andamento / Concluída / Cancelada |
| Vagas | número ou "sem limite" |
| Inscritos | quantos estão aprovados ou concluíram |
| Inscrições | "abertas (pelo app)" / "fechadas" |
| Link do curso | o mesmo endereço que o botão de compartilhar da turma copia |
| Ação | Criada / Editada / **Excluída** |
| Quem mexeu | nome de quem salvou, ou "(retroativo)" nas linhas de carga inicial |
| Quando (Brasília) | data e hora da gravação |

Turma excluída **não some da planilha**: a linha fica com a Ação marcada como
"Excluída". Um segundo registro que apaga junto não serviria de registro.

## Estado atual

- A aba `Ensino` **já existe**, com cabeçalho congelado e as turmas que existiam
  até 12/08/2026 carregadas retroativamente (Ação "Criada", Quem mexeu
  "(retroativo)", Quando = data real de criação da turma).
- O projeto do Apps Script **já existe** e está com o código: chama-se
  `Selah - Ensino na planilha IBZS`, no
  [painel do Apps Script](https://script.google.com/home/all).
- **Falta publicar o Web App** e configurar as variáveis — sem isso o app ainda
  não escreve nada, e a aba fica parada no retroativo.

O script é **standalone** (aponta para a planilha por `SpreadsheetApp.openById`)
em vez de vinculado a ela. Funciona igual; só aparece como projeto separado no
painel, não em *Extensões › Apps Script* da planilha.

## O que falta ligar

### 1. Publicar o Web App

No projeto `Selah - Ensino na planilha IBZS`:

1. **Implantar › Nova implantação › Tipo: App da Web**, com:
   - *Executar como*: **Eu**
   - *Quem pode acessar*: **Qualquer pessoa**
2. Autorize quando o Google pedir. Vai aparecer "o Google não verificou este
   app" — *Avançado › Acessar (não seguro)*. É esperado: o app é seu, não
   passou por revisão do Google porque não precisa.
3. Copie a **URL do app da Web**.

O "qualquer pessoa" é o que permite o app chamar sem login do Google. Quem
protege é o segredo: sem ele o script recusa e não escreve nada.

### 2. Configurar o app

No `.env.local` e nas variáveis de ambiente da Vercel:

```
ENSINO_SHEET_WEBHOOK_URL=<a URL do app da Web>
ENSINO_SHEET_SECRET=<o mesmo segredo da constante SEGREDO no script>
NEXT_PUBLIC_SITE_URL=https://ibzs.vercel.app
```

Sem `ENSINO_SHEET_WEBHOOK_URL` a integração fica desligada — é assim que o
ambiente de desenvolvimento roda sem sujar a planilha de verdade.

`NEXT_PUBLIC_SITE_URL` só ajusta o domínio do link do curso; sem ela o código
cai em `https://ibzs.vercel.app`.

### 3. Conferir

Edite uma turma no app e veja se a linha dela na aba muda de "Criada
(retroativo)" para "Editada", com seu nome e o horário.

## Recarregar tudo

`POST /api/ensino/planilha` (pastor ou admin logado) reenvia **todas** as turmas
para a planilha. Serve para refazer o retroativo ou reconstruir a aba se ela for
apagada. Como a linha casa pelo `id` da turma, rodar de novo atualiza em vez de
duplicar.

## O script

Já está colado no projeto. Aqui pela referência — e para reconstruir se o
projeto se perder. Troque `SEGREDO` se algum dia vazar.

```javascript
const SEGREDO = 'troque-por-uma-frase-longa-e-aleatoria'
const PLANILHA = '1NSt294COEak1PDBs9jOZPS8fb4v4HUg-ogiZMfjK-1Y'
const ABA = 'Ensino'

const CABECALHO = [
  'ID', 'Curso', 'Turma', 'Professores', 'Período', 'Encontros', 'Local',
  'Modo', 'Status', 'Vagas', 'Inscritos', 'Inscrições', 'Link do curso',
  'Ação', 'Quem mexeu', 'Quando (Brasília)',
]

const ACAO = { criada: 'Criada', editada: 'Editada', excluida: 'Excluída' }

function doPost(e) {
  try {
    const corpo = JSON.parse(e.postData.contents)
    if (corpo.segredo !== SEGREDO) return responder({ ok: false, erro: 'segredo inválido' })

    const t = corpo.turma
    if (!t || !t.id) return responder({ ok: false, erro: 'turma sem id' })

    // A trava evita que duas gravações simultâneas escrevam na mesma linha.
    const trava = LockService.getScriptLock()
    trava.waitLock(20000)
    try {
      gravar(t, corpo.acao, corpo.quem)
    } finally {
      trava.releaseLock()
    }

    return responder({ ok: true })
  } catch (erro) {
    return responder({ ok: false, erro: String(erro) })
  }
}

function gravar(t, acao, quem) {
  const aba = pegarAba()

  const linha = [
    t.id, t.curso, t.turma, t.professores, t.periodo, t.encontros, t.local,
    t.modo, t.status, t.vagas, t.inscritos, t.inscricoes, t.link,
    ACAO[acao] || acao,
    quem || '',
    Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'dd/MM/yyyy HH:mm'),
  ]

  const alvo = acharLinha(aba, t.id)
  if (alvo > 0) {
    aba.getRange(alvo, 1, 1, linha.length).setValues([linha])
  } else {
    aba.appendRow(linha)
  }
}

/** A aba, criada com cabeçalho congelado se ainda não existir. */
function pegarAba() {
  const planilha = SpreadsheetApp.openById(PLANILHA)
  let aba = planilha.getSheetByName(ABA)
  if (aba) return aba

  aba = planilha.insertSheet(ABA)
  aba.getRange(1, 1, 1, CABECALHO.length).setValues([CABECALHO]).setFontWeight('bold')
  aba.setFrozenRows(1)
  aba.setColumnWidth(1, 240)
  return aba
}

/** Em que linha está a turma, pelo ID na coluna A. 0 quando ainda não existe. */
function acharLinha(aba, id) {
  const total = aba.getLastRow()
  if (total < 2) return 0

  const ids = aba.getRange(2, 1, total - 1, 1).getValues()
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]).trim() === id) return i + 2
  }
  return 0
}

function responder(dados) {
  return ContentService
    .createTextOutput(JSON.stringify(dados))
    .setMimeType(ContentService.MimeType.JSON)
}
```

## Onde isso vive no código

- [lib/planilha-ensino.ts](../lib/planilha-ensino.ts) — monta a linha e envia.
- [app/actions/ensino/turmas.ts](../app/actions/ensino/turmas.ts) — chama em
  `criarTurmaAction`, `editarTurmaAction`, `alternarDestaqueTurmaAction` e
  `excluirTurmaAction`.
- [app/api/ensino/planilha/route.ts](../app/api/ensino/planilha/route.ts) —
  recarga completa.
