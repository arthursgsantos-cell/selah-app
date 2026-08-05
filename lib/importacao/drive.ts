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

export type ArquivoDrive = { rotulo: string; id: string }

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

/** Lista os itens (arquivos e subpastas) de uma pasta do Drive. */
export async function listarArquivosDaPasta(folderId: string): Promise<ArquivoDrive[]> {
  const apiKey = process.env.GOOGLE_DRIVE_API_KEY

  if (apiKey) {
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`'${folderId}' in parents and trashed=false`)}&fields=files(id,name)&pageSize=1000&key=${apiKey}`
    const res = await fetch(url, { cache: 'no-store' })
    if (res.ok) {
      const json = (await res.json()) as { files?: { id: string; name: string }[] }
      const arquivos = (json.files ?? []).map((f) => ({ rotulo: f.name, id: f.id }))
      if (arquivos.length > 0) return arquivos
    }
    // Chave inválida ou sem permissão: segue para o modo sem credencial
  }

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
  const arquivos: ArquivoDrive[] = []
  const re = /aria-label="([^"]+)"[^>]*?ssk='[^']*?:([a-zA-Z0-9_-]{20,}?)-\d+-\d+'/g
  for (const m of html.matchAll(re)) {
    arquivos.push({ rotulo: m[1], id: m[2] })
  }

  if (arquivos.length === 0) {
    throw new Error('A pasta do Drive não retornou nenhum arquivo. Confirme que está compartilhada como "qualquer pessoa com o link".')
  }
  return arquivos
}

/** Encontra o id do arquivo cujo rótulo corresponde ao nome vindo da planilha. */
export function acharIdDoArquivo(arquivos: ArquivoDrive[], nome: string): string | null {
  const alvo = nome.trim()
  const exato = arquivos.find((a) => a.rotulo === alvo)
  if (exato) return exato.id
  const porPrefixo = arquivos.find((a) => a.rotulo.startsWith(alvo))
  if (porPrefixo) return porPrefixo.id
  // Última tentativa ignorando acento e caixa: o rótulo do Drive e a planilha
  // nem sempre usam a mesma grafia (ex.: "Ágape" x "agape").
  const alvoNorm = normalizarNome(alvo)
  const porNormalizacao = arquivos.find((a) => normalizarNome(a.rotulo).startsWith(alvoNorm))
  return porNormalizacao?.id ?? null
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
    // O rótulo vem com sufixo de tipo ("Alpha (1) Shared folder"): tiramos o
    // tipo e depois o "(n)" antes de comparar.
    const semTipo = item.rotulo.replace(/\s+(Shared\s+)?(folder|pasta)\s*$/i, '').replace(/\s+Shared\s*$/i, '')
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
