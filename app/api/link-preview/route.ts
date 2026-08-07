import { NextResponse, type NextRequest } from 'next/server'
import net from 'node:net'
import dns from 'node:dns/promises'
import { createClient } from '@/lib/supabase/server'

/**
 * Prévia (título, descrição, imagem) de um link escrito na aula — o que dá o
 * cartãozinho que aparece ao passar o mouse ou segurar o dedo no chip.
 *
 * Busca a página do lado do servidor porque o navegador do aluno não pode
 * ler HTML de outro site (CORS). E como quem escolhe o endereço é o próprio
 * navegador de quem está vendo a aula, ele precisa passar pelas mesmas
 * checagens de um proxy exposto: só http(s), sem IP privado nem redirecionar
 * para um. Autenticação também é exigida — a rota não deve virar um proxy
 * aberto para quem não está logado.
 */

export const runtime = 'nodejs'

const TEMPO_LIMITE_MS = 5000
const TAMANHO_MAXIMO = 300_000
const MAX_REDIRECIONAMENTOS = 5

function ipPrivado(ip: string): boolean {
  const tipo = net.isIP(ip)
  if (tipo === 4) {
    const [a, b] = ip.split('.').map(Number)
    if (a === 10 || a === 127 || a === 0) return true
    if (a === 169 && b === 254) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    return false
  }
  if (tipo === 6) {
    const baixo = ip.toLowerCase()
    return baixo === '::1' || baixo.startsWith('fe80:') || baixo.startsWith('fc') || baixo.startsWith('fd')
  }
  return true
}

async function hostnameSeguro(hostname: string): Promise<boolean> {
  if (hostname === 'localhost') return false
  if (net.isIP(hostname)) return !ipPrivado(hostname)
  try {
    const enderecos = await dns.lookup(hostname, { all: true })
    return enderecos.length > 0 && enderecos.every((e) => !ipPrivado(e.address))
  } catch {
    return false
  }
}

function decodificarEntidades(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_t, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_t, dec: string) => String.fromCodePoint(parseInt(dec, 10)))
}

function pegaMeta(html: string, propriedades: string[]): string | null {
  for (const prop of propriedades) {
    const direto = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)["']`, 'i')
    const invertido = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`, 'i')
    const m = direto.exec(html) ?? invertido.exec(html)
    if (m?.[1]) return decodificarEntidades(m[1]).trim()
  }
  return null
}

/** Lê só o começo do corpo — o bastante para cobrir o `<head>` — e para por aí. */
async function lerInicio(resposta: Response): Promise<string> {
  const reader = resposta.body?.getReader()
  if (!reader) return ''
  const decoder = new TextDecoder('utf-8')
  let texto = ''
  let lidos = 0
  while (lidos < TAMANHO_MAXIMO) {
    const { done, value } = await reader.read()
    if (done) break
    lidos += value.byteLength
    texto += decoder.decode(value, { stream: true })
    if (/<\/head>/i.test(texto)) break
  }
  try {
    await reader.cancel()
  } catch {
    /* já terminou */
  }
  return texto
}

/**
 * Segue redirecionamento manualmente para checar cada endereço — um
 * redirecionamento automático poderia levar de um domínio público para um
 * IP interno sem essa checagem rodar de novo.
 */
async function buscarComRedirecionamentoSeguro(destino: URL): Promise<Response | null> {
  let atual = destino
  for (let i = 0; i < MAX_REDIRECIONAMENTOS; i++) {
    if (!(await hostnameSeguro(atual.hostname))) return null

    const resposta = await fetch(atual.toString(), {
      redirect: 'manual',
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SelahLinkPreview/1.0)' },
    })

    if (resposta.status >= 300 && resposta.status < 400) {
      const local = resposta.headers.get('location')
      if (!local) return null
      const proximo = new URL(local, atual)
      if (proximo.protocol !== 'http:' && proximo.protocol !== 'https:') return null
      atual = proximo
      continue
    }
    return resposta
  }
  return null
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ erro: 'Faça login para ver a prévia.' }, { status: 401 })
  }

  const bruto = request.nextUrl.searchParams.get('url')
  if (!bruto) {
    return NextResponse.json({ erro: 'Endereço não informado.' }, { status: 400 })
  }

  let destino: URL
  try {
    destino = new URL(bruto)
  } catch {
    return NextResponse.json({ erro: 'Endereço inválido.' }, { status: 400 })
  }
  if (destino.protocol !== 'http:' && destino.protocol !== 'https:') {
    return NextResponse.json({ erro: 'Endereço inválido.' }, { status: 400 })
  }

  const site = destino.hostname.replace(/^www\./, '')
  const vazio = { titulo: null, descricao: null, imagem: null, site }

  try {
    const resposta = await buscarComRedirecionamentoSeguro(destino)
    if (!resposta || !resposta.ok || !resposta.headers.get('content-type')?.includes('text/html')) {
      return NextResponse.json(vazio)
    }

    const html = await lerInicio(resposta)
    const tituloOg = pegaMeta(html, ['og:title', 'twitter:title'])
    const tituloTag = /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1]?.trim()
    const titulo = tituloOg ?? (tituloTag ? decodificarEntidades(tituloTag) : null)
    const descricao = pegaMeta(html, ['og:description', 'twitter:description', 'description'])
    const imagemBruta = pegaMeta(html, ['og:image', 'twitter:image'])
    const imagem = imagemBruta ? new URL(imagemBruta, resposta.url || destino).toString() : null

    return NextResponse.json(
      { titulo, descricao, imagem, site },
      { headers: { 'Cache-Control': 'private, max-age=3600' } }
    )
  } catch {
    return NextResponse.json(vazio)
  }
}
