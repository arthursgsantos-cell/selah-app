/**
 * Leitura da lista de alunos que vem da planilha.
 *
 * O combinado com a secretaria são três colunas — nome, telefone, e-mail —,
 * mas o arquivo real nunca chega exatamente assim: vem com cabeçalho ou sem,
 * separado por `;` ou por vírgula (o Excel em português usa `;`, o exportado
 * de outros sistemas usa `,`), com aspas em volta de campos e com linhas em
 * branco no fim. Este módulo aceita tudo isso e devolve linha por linha, com o
 * número original, para o relatório dizer "linha 12: sem nome" em vez de só
 * recusar o arquivo.
 *
 * Só o nome é obrigatório. Telefone e e-mail podem faltar — a turma prefere
 * ter a pessoa na chamada sem contato a não tê-la.
 */

export interface LinhaAluno {
  /** Número da linha no arquivo, contando a partir de 1. */
  linha: number
  nome: string
  telefone: string | null
  email: string | null
  /** Preenchido quando a linha não dá para aproveitar. */
  erro: string | null
}

/** Cabeçalhos que reconhecemos, para descartar a primeira linha. */
const CABECALHOS = ['nome', 'name', 'aluno']

/**
 * Separa uma linha respeitando aspas — "Silva, João";... não pode virar duas
 * colunas por causa da vírgula de dentro.
 */
function separarColunas(linha: string, separador: string): string[] {
  const colunas: string[] = []
  let atual = ''
  let dentroDeAspas = false

  for (let i = 0; i < linha.length; i++) {
    const c = linha[i]
    if (c === '"') {
      // Aspas duplicadas dentro do campo representam uma aspa literal.
      if (dentroDeAspas && linha[i + 1] === '"') { atual += '"'; i++ }
      else dentroDeAspas = !dentroDeAspas
    } else if (c === separador && !dentroDeAspas) {
      colunas.push(atual)
      atual = ''
    } else {
      atual += c
    }
  }
  colunas.push(atual)
  return colunas.map((c) => c.trim())
}

/**
 * Descobre o separador pela primeira linha com conteúdo: ganha o que aparece
 * mais vezes. Sem nenhum, o arquivo tem uma coluna só (lista de nomes), o que
 * também é aceito.
 */
function detectarSeparador(linhas: string[]): string {
  const amostra = linhas.find((l) => l.trim() !== '') ?? ''
  const candidatos = [';', '\t', ','] as const
  let melhor: string = ';'
  let maior = 0
  for (const sep of candidatos) {
    const n = amostra.split(sep).length - 1
    if (n > maior) { maior = n; melhor = sep }
  }
  return melhor
}

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function lerPlanilhaAlunos(texto: string): LinhaAluno[] {
  // BOM do Excel some aqui; sem isso o primeiro cabeçalho não casa e a linha
  // de título viraria um aluno chamado "﻿nome".
  const limpo = texto.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const brutas = limpo.split('\n')
  const separador = detectarSeparador(brutas)

  const resultado: LinhaAluno[] = []

  brutas.forEach((bruta, i) => {
    if (bruta.trim() === '') return

    const col = separarColunas(bruta, separador)
    const nome = (col[0] ?? '').trim()

    // Cabeçalho: só na primeira linha com conteúdo, e só se a primeira coluna
    // for uma das palavras conhecidas. Um aluno chamado "Nome" é improvável;
    // um aluno na primeira linha, não.
    if (resultado.length === 0 && CABECALHOS.includes(nome.toLowerCase())) return

    const telefoneBruto = (col[1] ?? '').trim()
    const emailBruto = (col[2] ?? '').trim().toLowerCase()

    // Telefone fica só com dígitos: a planilha vem com (84) 9 9999-0000,
    // +55 84 99999 0000 e tudo mais.
    const telefone = telefoneBruto.replace(/\D/g, '') || null
    const email = emailBruto || null

    let erro: string | null = null
    if (nome.length < 2) erro = 'sem nome'
    else if (email && !EMAIL_VALIDO.test(email)) erro = `e-mail inválido (${email})`

    resultado.push({ linha: i + 1, nome, telefone, email, erro })
  })

  return resultado
}

/** Separa o que dá para importar do que precisa ser corrigido antes. */
export function separarValidas(linhas: LinhaAluno[]): {
  validas: LinhaAluno[]
  invalidas: LinhaAluno[]
  duplicadas: LinhaAluno[]
} {
  const validas: LinhaAluno[] = []
  const invalidas: LinhaAluno[] = []
  const duplicadas: LinhaAluno[] = []
  const vistos = new Set<string>()

  for (const l of linhas) {
    if (l.erro) { invalidas.push(l); continue }
    // A mesma pessoa repetida na planilha viraria duas inscrições. A chave é o
    // e-mail quando existe (é identidade); senão, o nome.
    const chave = (l.email ?? l.nome).toLowerCase()
    if (vistos.has(chave)) { duplicadas.push(l); continue }
    vistos.add(chave)
    validas.push(l)
  }

  return { validas, invalidas, duplicadas }
}
