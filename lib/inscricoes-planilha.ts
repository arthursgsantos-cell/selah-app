import { baseDaPublicacao, parseCsv } from '@/lib/importacao/planilha'
import { normalizarNome } from '@/lib/importacao/texto'

/**
 * Contagem de inscritos a partir da planilha de respostas do Google Forms.
 *
 * Serve para eventos com inscrição por LINK externo: quem se inscreve não
 * passa pelo app, então o contador de "confirmados" do próprio site fica
 * sempre errado. A planilha de respostas é a fonte real.
 *
 * O formulário registra uma linha por FAMÍLIA — titular, cônjuge e os filhos
 * em texto livre. Por isso a contagem de pessoas soma o titular mais o
 * cônjuge, quando informado, e ignora os filhos.
 */

export type ContagemInscritos = {
  /** Linhas da planilha: cada uma é uma inscrição/família. */
  inscricoes: number
  /** Titulares + cônjuges informados. Não inclui filhos. */
  pessoas: number
}

/** Aceita a URL publicada em qualquer forma (`/pubhtml`, `/pub?...`). */
function urlDoCsv(urlPublicada: string, gid: string | null): string {
  const base = baseDaPublicacao(urlPublicada)
  return gid ? `${base}?gid=${gid}&single=true&output=csv` : `${base}?single=true&output=csv`
}

async function baixar(url: string): Promise<string> {
  // `revalidate` evita bater no Google a cada visita da página; a contagem
  // pode ficar até 5 minutos atrasada, o que é irrelevante aqui.
  const res = await fetch(url, { redirect: 'follow', next: { revalidate: 300 } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

/** Descobre o gid da primeira aba a partir do `/pubhtml`. */
async function primeiroGid(urlPublicada: string): Promise<string | null> {
  const base = baseDaPublicacao(urlPublicada)
  const daPropriaUrl = /[?&]gid=(\d+)/.exec(urlPublicada)
  if (daPropriaUrl) return daPropriaUrl[1]

  const html = await baixar(`${base}html`)
  const gids = [...new Set([...html.matchAll(/gid=(\d+)/g)].map((m) => m[1]))]
  return gids[0] ?? null
}

/**
 * `null` quando a planilha não pôde ser lida — link errado, publicação
 * revogada ou Google fora do ar. A página só não mostra o número; nada quebra.
 */
export async function contarInscritos(urlPublicada: string): Promise<ContagemInscritos | null> {
  try {
    const gid = await primeiroGid(urlPublicada)
    const texto = await baixar(urlDoCsv(urlPublicada, gid))

    // Sem seguir o redirect, o Google devolve HTML no lugar do CSV.
    if (texto.trimStart().startsWith('<')) return null

    const linhas = parseCsv(texto)
    if (linhas.length < 2) return { inscricoes: 0, pessoas: 0 }

    const cabecalho = linhas[0].map(normalizarNome)

    // O cabeçalho é escrito à mão no formulário, então casamos por trecho.
    // "nome do conjuge" contém "nome": a busca do titular exclui as colunas
    // de cônjuge e de filho para não pegar a coluna errada.
    const idxTitular = cabecalho.findIndex(
      (c) => c.includes('nome') && !c.includes('conjuge') && !c.includes('filho')
    )
    const idxConjuge = cabecalho.findIndex((c) => c.includes('conjuge'))
    if (idxTitular < 0) return null

    let inscricoes = 0
    let pessoas = 0

    for (const linha of linhas.slice(1)) {
      const titular = (linha[idxTitular] ?? '').trim()
      if (!titular) continue

      inscricoes++
      pessoas++

      const conjuge = idxConjuge >= 0 ? (linha[idxConjuge] ?? '').trim() : ''
      if (conjuge) pessoas++
    }

    return { inscricoes, pessoas }
  } catch {
    return null
  }
}
