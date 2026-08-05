import { normalizarNome } from './texto'

/**
 * Leitura da planilha de controle publicada no Google Sheets.
 *
 * A publicação é do **documento inteiro**, então `/pubhtml` lista todas as abas
 * com seus `gid`. Republicar a planilha troca todos os gids, por isso nenhum
 * gid é gravado no código: descobrimos os disponíveis e identificamos cada aba
 * pelo **cabeçalho**, nunca pela posição nem pelo gid.
 */

/** Parser de CSV que respeita aspas, vírgulas dentro de aspas e "" escapado. */
export function parseCsv(texto: string): string[][] {
  const linhas: string[][] = []
  let campo = ''
  let linha: string[] = []
  let dentroDeAspas = false

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]

    if (dentroDeAspas) {
      if (c === '"') {
        if (texto[i + 1] === '"') { campo += '"'; i++ }
        else dentroDeAspas = false
      } else campo += c
      continue
    }

    if (c === '"') { dentroDeAspas = true; continue }
    if (c === ',') { linha.push(campo); campo = ''; continue }
    if (c === '\r') continue
    if (c === '\n') { linha.push(campo); linhas.push(linha); linha = []; campo = ''; continue }
    campo += c
  }

  if (campo !== '' || linha.length > 0) { linha.push(campo); linhas.push(linha) }
  return linhas.filter((l) => l.some((c) => c.trim() !== ''))
}

/**
 * Base da publicação, sem query: `https://.../pub`.
 * Aceita tanto a URL de uma aba (`/pub?gid=...&output=csv`) quanto `/pubhtml`.
 */
export function baseDaPublicacao(url: string): string {
  const semQuery = url.split('?')[0].trim()
  return semQuery.replace(/html$/, '').replace(/\/+$/, '')
}

/**
 * Baixa uma URL do Google seguindo redirect. O Sheets responde 307 no CSV;
 * sem seguir o redirect vem HTML e o parser devolveria lixo silenciosamente.
 */
async function baixarTexto(url: string): Promise<string> {
  const res = await fetch(url, { cache: 'no-store', redirect: 'follow' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

export type Aba = {
  gid: string
  cabecalho: string[]
  /** Linhas de dados, já sem o cabeçalho. */
  linhas: string[][]
}

/** Lê `/pubhtml` e baixa o CSV de cada aba encontrada. */
export async function baixarAbas(urlPublicacao: string): Promise<Aba[]> {
  const base = baseDaPublicacao(urlPublicacao)

  let html: string
  try {
    html = await baixarTexto(`${base}html`)
  } catch (e) {
    const motivo = e instanceof Error ? e.message : 'erro desconhecido'
    throw new Error(
      `Não consegui abrir a planilha publicada (${motivo}). Confirme em Arquivo → Compartilhar → Publicar na web que o "Documento inteiro" está publicado.`
    )
  }

  const gids = [...new Set([...html.matchAll(/gid=(\d+)/g)].map((m) => m[1]))]
  if (gids.length === 0) throw new Error('A planilha publicada não listou nenhuma aba (gid).')

  const abas = await Promise.all(
    gids.map(async (gid): Promise<Aba | null> => {
      try {
        const texto = await baixarTexto(`${base}?gid=${gid}&single=true&output=csv`)
        // Sem seguir redirect o Google devolve HTML; melhor descartar a aba do
        // que tentar interpretar a página de erro como CSV.
        if (texto.trimStart().startsWith('<')) return null
        const linhas = parseCsv(texto)
        if (linhas.length === 0) return null
        return { gid, cabecalho: linhas[0].map((c) => c.trim()), linhas: linhas.slice(1) }
      } catch {
        return null
      }
    })
  )

  return abas.filter((a): a is Aba => a !== null)
}

/**
 * Encontra a aba cujo cabeçalho contém todas as colunas da assinatura.
 * A comparação ignora acento, caixa e ordem das colunas.
 */
export function acharAba(abas: Aba[], assinatura: string[]): Aba | null {
  const alvo = assinatura.map(normalizarNome)
  return (
    abas.find((aba) => {
      const colunas = aba.cabecalho.map(normalizarNome)
      return alvo.every((c) => colunas.includes(c))
    }) ?? null
  )
}

/**
 * Índice da coluna: primeiro por nome exato (normalizado), depois por trecho.
 * Devolve -1 quando não existe.
 */
export function coluna(aba: Aba, ...candidatos: string[]): number {
  const colunas = aba.cabecalho.map(normalizarNome)
  for (const candidato of candidatos) {
    const alvo = normalizarNome(candidato)
    const exato = colunas.indexOf(alvo)
    if (exato >= 0) return exato
  }
  for (const candidato of candidatos) {
    const alvo = normalizarNome(candidato)
    const parcial = colunas.findIndex((c) => c.includes(alvo))
    if (parcial >= 0) return parcial
  }
  return -1
}

/** Valor da célula, já sem espaços nas pontas. `-1` devolve string vazia. */
export function celula(linha: string[], indice: number): string {
  return indice >= 0 ? (linha[indice] ?? '').trim() : ''
}
