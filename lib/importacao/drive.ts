import { normalizarNome } from './texto'

/**
 * Leitura da pasta compartilhada do Drive.
 *
 * Com GOOGLE_DRIVE_API_KEY usamos a API oficial; sem ela, lemos o HTML da
 * página pública da pasta — funciona sem credencial nenhuma, mas depende do
 * formato da página do Google.
 *
 * A pasta raiz tem os PDFs dos roteiros soltos e duas **subpastas**
 * ("Fotos das Células" e "Eventos"). Dentro de "Fotos das Células" há tanto
 * arquivos soltos quanto subpastas por célula, então a busca de uma foto olha
 * os dois lugares.
 */

export type ArquivoDrive = {
  rotulo: string
  id: string
  /** `undefined` quando a origem não soube dizer (rótulo sem sufixo de tipo). */
  pasta?: boolean
}

/**
 * Cada execução da importação lista a mesma pasta várias vezes (uma por linha
 * da planilha). O cache vive só enquanto a execução dura — memorizar entre
 * execuções faria a sincronização seguinte não enxergar arquivos novos.
 */
export type LeitorDrive = (folderId: string) => Promise<ArquivoDrive[]>

export function criarLeitorDrive(): LeitorDrive {
  const cache = new Map<string, Promise<ArquivoDrive[]>>()
  return (folderId) => {
    const emCache = cache.get(folderId)
    if (emCache) return emCache
    const promessa = listarArquivosDaPasta(folderId)
    cache.set(folderId, promessa)
    promessa.catch(() => cache.delete(folderId))
    return promessa
  }
}

const MIME_PASTA = 'application/vnd.google-apps.folder'

/** Lista os itens (arquivos e subpastas) de uma pasta do Drive. */
export async function listarArquivosDaPasta(folderId: string): Promise<ArquivoDrive[]> {
  const apiKey = process.env.GOOGLE_DRIVE_API_KEY

  if (apiKey) {
    const pelaApi = await listarPelaApi(folderId, apiKey)
    // Só a falha da API justifica cair para a raspagem: pasta vazia é resposta
    // legítima, e tratá-la como falha produzia o erro enganoso de "não está
    // compartilhada" para uma pasta que só não tem nada dentro.
    if (pelaApi) return pelaApi
  }

  return listarPelaPaginaPublica(folderId)
}

/**
 * Caminho oficial. Devolve `null` quando a API recusa (chave inválida, Drive
 * API desabilitada, pasta fora do alcance da chave) — aí vale tentar a página
 * pública.
 */
async function listarPelaApi(folderId: string, apiKey: string): Promise<ArquivoDrive[] | null> {
  const arquivos: ArquivoDrive[] = []
  let pageToken: string | undefined

  // Uma pasta de célula passa de 1000 fotos com o tempo; sem seguir o
  // nextPageToken as fotos além da primeira página simplesmente somem.
  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'nextPageToken,files(id,name,mimeType)',
      pageSize: '1000',
      key: apiKey,
    })
    if (pageToken) params.set('pageToken', pageToken)

    const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
      cache: 'no-store',
    })
    if (!res.ok) return null

    const json = (await res.json()) as {
      files?: { id: string; name: string; mimeType?: string }[]
      nextPageToken?: string
    }
    for (const f of json.files ?? []) {
      arquivos.push({ rotulo: f.name, id: f.id, pasta: f.mimeType === MIME_PASTA })
    }
    pageToken = json.nextPageToken
  } while (pageToken)

  return arquivos
}

/**
 * Modo sem credencial: lê o HTML da página pública da pasta.
 *
 * Funciona, mas depende do formato da página do Google e só enxerga os itens
 * que vêm no primeiro carregamento — o resto do Drive chega por scroll, que o
 * fetch não dispara. Com GOOGLE_DRIVE_API_KEY configurada este caminho nem é
 * usado.
 */
async function listarPelaPaginaPublica(folderId: string): Promise<ArquivoDrive[]> {
  const res = await fetch(`https://drive.google.com/drive/folders/${folderId}`, {
    cache: 'no-store',
    redirect: 'follow',
  })
  if (!res.ok) throw new Error(`Não consegui listar a pasta do Drive (HTTP ${res.status}). Ela está compartilhada por link?`)
  const html = await res.text()

  // Na página pública da pasta, cada item vira uma div no formato:
  //   <div class="JxSEve" aria-label="<nome> PDF Shared" ... ssk='5:xxxx:<ID>-0-16'>
  // O aria-label carrega sufixos de tipo/compartilhamento, então guardamos o
  // rótulo cru e resolvemos por prefixo na hora da busca.
  // A captura do id é preguiçosa e ancorada no sufixo "-<n>-<n>'", senão o
  // quantificador engole parte dele (ids do Drive também contêm hífens).
  //
  // O mesmo id aparece quatro vezes, uma por controle da linha: o nome vem
  // primeiro e depois "Modified ...", "Size ..." e "More actions". Fica só a
  // primeira ocorrência — os outros rótulos são texto da interface, e mantê-los
  // enchia a lista de entradas que não correspondem a arquivo nenhum.
  const porId = new Map<string, ArquivoDrive>()
  const re = /aria-label="([^"]+)"[^>]*?ssk='[^']*?:([a-zA-Z0-9_-]{20,}?)-\d+-\d+'/g
  for (const m of html.matchAll(re)) {
    if (porId.has(m[2])) continue
    porId.set(m[2], { rotulo: m[1], id: m[2], pasta: SUFIXO_PASTA.test(m[1]) })
  }

  if (porId.size === 0) {
    throw new Error('A pasta do Drive não retornou nenhum arquivo. Confirme que está compartilhada como "qualquer pessoa com o link".')
  }
  return [...porId.values()]
}

/** Sufixo de tipo que a página pública gruda no nome: "... Shared folder". */
const SUFIXO_PASTA = /\s+(Shared\s+)?(folder|pasta)\s*$/i

/**
 * O rótulo bate com o nome da planilha quando é igual a ele ou quando o nome
 * termina ali e o que sobra é o sufixo de tipo da página pública
 * ("foto.jpg Image Shared").
 *
 * A fronteira do espaço é o que impede um nome truncado na planilha de casar
 * com um arquivo qualquer: sem ela, "alelo_" casava com
 * "alelo_4.0_2026-07-31_22-56-54.jpg" e importava uma foto arbitrária da
 * célula no lugar da que a linha descrevia.
 */
function correspondeAoNome(rotulo: string, alvo: string): boolean {
  return rotulo === alvo || rotulo.startsWith(`${alvo} `)
}

/** Encontra o id do arquivo cujo rótulo corresponde ao nome vindo da planilha. */
export function acharIdDoArquivo(arquivos: ArquivoDrive[], nome: string): string | null {
  const alvo = nome.trim()
  if (!alvo) return null

  const exato = arquivos.find((a) => correspondeAoNome(a.rotulo, alvo))
  if (exato) return exato.id

  // Última tentativa ignorando acento e caixa: o rótulo do Drive e a planilha
  // nem sempre usam a mesma grafia (ex.: "Ágape" x "agape").
  const alvoNorm = normalizarNome(alvo)
  const porNormalizacao = arquivos.find((a) =>
    correspondeAoNome(normalizarNome(a.rotulo), alvoNorm)
  )
  return porNormalizacao?.id ?? null
}

/** Subpastas de uma listagem, para descer mais um nível na busca. */
export function subpastasDe(itens: ArquivoDrive[]): ArquivoDrive[] {
  return itens.filter((i) => i.pasta)
}

/**
 * Id do arquivo a partir do link que o Drive gera ("Copiar link"), nos dois
 * formatos que ele produz: `/file/d/<id>/view` e `?id=<id>`.
 *
 * Quando a planilha traz esse link, ele é a fonte mais confiável que existe —
 * aponta o arquivo exato, sem depender do nome bater com o rótulo no Drive
 * nem de vasculhar pasta por pasta.
 */
export function idDoLinkDrive(link: string): string | null {
  const texto = link.trim()
  if (!texto) return null
  const m = /\/d\/([a-zA-Z0-9_-]{15,})/.exec(texto) ?? /[?&]id=([a-zA-Z0-9_-]{15,})/.exec(texto)
  return m?.[1] ?? null
}

/**
 * Ids de TODAS as subpastas que correspondem ao nome — no plural porque o
 * Drive cria "Alpha (1)" ao lado de "Alpha" quando algo é reenviado, e a foto
 * procurada pode estar em qualquer uma das duas. O sufixo "(n)" é artefato do
 * Drive, não uma célula nova.
 */
export function acharIdsDasSubpastas(itens: ArquivoDrive[], nome: string): string[] {
  const alvo = normalizarNome(nome)
  if (!alvo) return []

  const ids: string[] = []
  for (const item of itens) {
    // Arquivo com o nome da célula não é a pasta da célula.
    if (item.pasta === false) continue
    // O rótulo vem com sufixo de tipo ("Alpha (1) Shared folder"): tiramos o
    // tipo e depois o "(n)" antes de comparar.
    const semTipo = item.rotulo.replace(SUFIXO_PASTA, '').replace(/\s+Shared\s*$/i, '')
    const semCopia = semTipo.replace(/\s*\(\d+\)\s*$/, '')
    if (normalizarNome(semCopia) === alvo && !ids.includes(item.id)) ids.push(item.id)
  }
  return ids
}

/** Primeira subpasta correspondente, quando só uma interessa. */
export function acharIdDaSubpasta(itens: ArquivoDrive[], nome: string): string | null {
  return acharIdsDasSubpastas(itens, nome)[0] ?? null
}

/** Baixa o conteúdo de um arquivo do Drive pelo id. */
export async function baixarArquivo(fileId: string): Promise<ArrayBuffer> {
  const res = await fetch(
    `https://drive.usercontent.google.com/download?id=${fileId}&export=download`,
    { cache: 'no-store', redirect: 'follow' }
  )
  if (!res.ok) throw new Error(`download falhou (HTTP ${res.status})`)
  return res.arrayBuffer()
}

const ASSINATURAS_IMAGEM: { tipo: string; bytes: number[] }[] = [
  { tipo: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { tipo: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47] },
  { tipo: 'image/gif', bytes: [0x47, 0x49, 0x46, 0x38] },
  { tipo: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46] },
]

/**
 * Confere pelos primeiros bytes que o download é mesmo uma imagem.
 * Quando o Drive recusa o download ele devolve HTML com status 200 — sem essa
 * checagem a página de erro entraria no storage como se fosse a foto.
 */
export function tipoDaImagem(buffer: ArrayBuffer): string | null {
  const inicio = new Uint8Array(buffer.slice(0, 4))
  for (const { tipo, bytes } of ASSINATURAS_IMAGEM) {
    if (bytes.every((b, i) => inicio[i] === b)) return tipo
  }
  return null
}

/** Extensão a partir do nome do arquivo da planilha, com "jpg" de reserva. */
export function extensaoDe(nome: string): string {
  const m = /\.([a-z0-9]{2,5})$/i.exec(nome.trim())
  return (m?.[1] ?? 'jpg').toLowerCase()
}

/** SHA-256 do conteúdo, em hexadecimal. É a chave de dedup das fotos. */
export async function hashDoConteudo(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
