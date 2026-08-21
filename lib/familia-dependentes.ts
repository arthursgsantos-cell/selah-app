/**
 * Casamento de dependentes entre os dois lados de um casal.
 *
 * O problema que isto resolve: pai e mãe têm contas separadas e cada um
 * cadastra os mesmos filhos. Antes do vínculo do cônjuge não há como o sistema
 * saber que "Miguel Cruz Marques" do Randson e "Miguel Cruz Marques" da Amanda
 * são a mesma criança — e a aba de aniversários acaba listando o menino duas
 * vezes.
 *
 * A comparação é conservadora de propósito. Um falso positivo apaga o cadastro
 * de uma criança de verdade; um falso negativo só deixa uma duplicata para a
 * pessoa resolver na mão. Por isso todo par que não é idêntico vai para
 * confirmação humana em vez de mesclar sozinho.
 */

export type DependenteComparavel = {
  id?: number
  nome: string
  data_nascimento: string | null
  /** 'cônjuge' ou 'filho'. Aceita `string` para as telas que leem o banco cru. */
  tipo: string
  sexo?: 'M' | 'F' | null
}

/** Partículas de nome que não ajudam a distinguir ninguém. */
const PARTICULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'del', 'di'])

export function normalizarNome(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokens(nome: string): string[] {
  return normalizarNome(nome)
    .split(' ')
    .filter((t) => t.length > 1 && !PARTICULAS.has(t))
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length

  let linha = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const anterior = linha
    linha = [i]
    for (let j = 1; j <= b.length; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1
      linha[j] = Math.min(anterior[j] + 1, linha[j - 1] + 1, anterior[j - 1] + custo)
    }
  }
  return linha[b.length]
}

/** 0 a 1, onde 1 é igual. */
function razaoLevenshtein(a: string, b: string): number {
  const maior = Math.max(a.length, b.length)
  if (maior === 0) return 1
  return 1 - levenshtein(a, b) / maior
}

/**
 * Semelhança entre dois nomes. Combina duas leituras porque elas erram em
 * situações opostas: a de tokens aguenta sobrenome faltando ("Miguel Marques"
 * vs "Miguel Cruz Marques"), a de caracteres aguenta grafia trocada
 * ("Luísa" vs "Luiza").
 */
export function similaridadeNome(a: string, b: string): number {
  const na = normalizarNome(a)
  const nb = normalizarNome(b)
  if (!na || !nb) return 0
  if (na === nb) return 1

  const ta = tokens(a)
  const tb = tokens(b)
  let porTokens = 0
  if (ta.length && tb.length) {
    // Cada token do lado menor procura o par mais parecido do lado maior:
    // "luiza cruz" casa com "luisa cruz marques" mesmo com a grafia trocada.
    const [menor, maior] = ta.length <= tb.length ? [ta, tb] : [tb, ta]
    const soma = menor.reduce(
      (acc, t) => acc + Math.max(...maior.map((o) => razaoLevenshtein(t, o))),
      0
    )
    porTokens = soma / menor.length
  }

  return Math.max(porTokens, razaoLevenshtein(na, nb))
}

/** O primeiro nome é o portão: irmãos dividem sobrenome, não o primeiro nome. */
function primeirosNomesBatem(a: string, b: string): boolean {
  const pa = tokens(a)[0] ?? normalizarNome(a)
  const pb = tokens(b)[0] ?? normalizarNome(b)
  if (!pa || !pb) return false
  return razaoLevenshtein(pa, pb) >= 0.8
}

export type Divergencia = 'nome' | 'data' | 'sexo'

export type ComparacaoDependentes = {
  duplicado: boolean
  /** Idêntico o bastante para mesclar sem perguntar nada. */
  automatico: boolean
  divergencias: Divergencia[]
  score: number
}

const NAO_DUPLICADO: ComparacaoDependentes = {
  duplicado: false,
  automatico: false,
  divergencias: [],
  score: 0,
}

export function compararDependentes(
  a: DependenteComparavel,
  b: DependenteComparavel
): ComparacaoDependentes {
  if (a.tipo !== b.tipo) return NAO_DUPLICADO
  if (!a.nome.trim() || !b.nome.trim()) return NAO_DUPLICADO
  if (!primeirosNomesBatem(a.nome, b.nome)) return NAO_DUPLICADO

  const nomesIguais = normalizarNome(a.nome) === normalizarNome(b.nome)
  const score = similaridadeNome(a.nome, b.nome)

  const temAmbasDatas = Boolean(a.data_nascimento && b.data_nascimento)
  const datasIguais = temAmbasDatas && a.data_nascimento === b.data_nascimento
  const semNenhumaData = !a.data_nascimento && !b.data_nascimento

  // Limiar do nome varia com o quanto a data corrobora: data igual é um
  // segundo fator forte e permite aceitar grafia mais solta; data ausente dos
  // dois lados deixa o nome sozinho como prova e exige mais dele.
  let duplicado = false
  if (datasIguais) duplicado = nomesIguais || score >= 0.55
  else if (temAmbasDatas) duplicado = nomesIguais || score >= 0.92
  else if (semNenhumaData) duplicado = nomesIguais || score >= 0.85
  else duplicado = nomesIguais || score >= 0.7

  if (!duplicado) return NAO_DUPLICADO

  const divergencias: Divergencia[] = []
  if (!nomesIguais) divergencias.push('nome')
  if (temAmbasDatas && !datasIguais) divergencias.push('data')
  if (a.sexo && b.sexo && a.sexo !== b.sexo) divergencias.push('sexo')

  return { duplicado: true, automatico: divergencias.length === 0, divergencias, score }
}

/**
 * Valor sugerido para o registro que sobra da mesclagem: o lado mais completo
 * vence. Empate em completude fica com `a` — quem chamou escolhe qual lado é
 * o `a` e, no vínculo, ele é sempre o de quem está clicando.
 */
export function sugerirMesclagem(a: DependenteComparavel, b: DependenteComparavel) {
  const nome = a.nome.trim().length >= b.nome.trim().length ? a.nome.trim() : b.nome.trim()
  return {
    nome,
    data_nascimento: a.data_nascimento ?? b.data_nascimento ?? null,
    sexo: a.sexo ?? b.sexo ?? null,
  }
}

/**
 * Emparelha duas listas resolvendo primeiro os pares mais parecidos, para que
 * dois irmãos de nome próximo não roubem o par um do outro. Cada dependente
 * entra em no máximo um par.
 */
export function emparelharDuplicatas<T extends DependenteComparavel>(
  listaA: T[],
  listaB: T[]
): Array<{ a: T; b: T; comparacao: ComparacaoDependentes }> {
  const candidatos: Array<{ a: T; b: T; comparacao: ComparacaoDependentes }> = []
  for (const a of listaA) {
    for (const b of listaB) {
      const comparacao = compararDependentes(a, b)
      if (comparacao.duplicado) candidatos.push({ a, b, comparacao })
    }
  }

  candidatos.sort((x, y) => {
    if (x.comparacao.automatico !== y.comparacao.automatico) return x.comparacao.automatico ? -1 : 1
    return y.comparacao.score - x.comparacao.score
  })

  const usadosA = new Set<T>()
  const usadosB = new Set<T>()
  const pares: Array<{ a: T; b: T; comparacao: ComparacaoDependentes }> = []
  for (const c of candidatos) {
    if (usadosA.has(c.a) || usadosB.has(c.b)) continue
    usadosA.add(c.a)
    usadosB.add(c.b)
    pares.push(c)
  }
  return pares
}

/**
 * Colapsa duplicatas dentro de uma única lista. Serve para as telas de leitura
 * não repetirem cadastros antigos que nunca passaram pela mesclagem.
 */
export function deduplicarDependentes<T extends DependenteComparavel>(lista: T[]): T[] {
  const resultado: T[] = []
  for (const item of lista) {
    const jaTem = resultado.some((r) => compararDependentes(r, item).duplicado)
    if (!jaTem) resultado.push(item)
  }
  return resultado
}
