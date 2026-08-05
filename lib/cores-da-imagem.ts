/**
 * Extrai duas cores dominantes de uma imagem, para pintar o fundo da página
 * de acordo com a capa.
 *
 * Roda no navegador: ler pixel exige canvas, e o servidor não tem
 * decodificador de imagem instalado. O resultado é gravado no banco, então
 * isso acontece uma vez por capa, não a cada visita.
 *
 * A regra foi calibrada contra as fotos reais das células. A primeira versão
 * pegava a cor mais FREQUENTE e devolvia cinza em toda foto — fotos de grupo
 * em ambiente fechado são dominadas por parede clara e roupa escura, e a média
 * dessa maioria é sempre neutra. O que dá um fundo com cara da foto é a cor
 * mais VIVA entre as relevantes.
 */

/** Quantiza cada canal em 8 níveis: agrupa tons parecidos no mesmo balde. */
const NIVEIS = 8

/** Um balde precisa de 3% dos pixels para valer como "cor da imagem". */
const PARTICIPACAO_MINIMA = 3

/** Abaixo disso a imagem é monocromática de fato e o tom dominante vence. */
const SATURACAO_MINIMA = 0.1

type Balde = { r: number; g: number; b: number; n: number }

function hex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0'))
      .join('')
  )
}

/** Saturação aproximada (HSL). */
function saturacao(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  if (max === min) return 0
  const l = (max + min) / 2 / 255
  return (max - min) / 255 / (l > 0.5 ? 2 - (max + min) / 255 : (max + min) / 255)
}

/** Afasta os canais da luminosidade: mesma matiz, mais viva. */
function vivificar(r: number, g: number, b: number, fator: number): [number, number, number] {
  const l = (Math.max(r, g, b) + Math.min(r, g, b)) / 2
  return [l + (r - l) * fator, l + (g - l) * fator, l + (b - l) * fator]
}

export type CoresDaCapa = { cor: string; corSecundaria: string }

/**
 * `null` quando a imagem não pôde ser lida — outro domínio sem CORS, formato
 * não suportado ou rede fora. A página mantém as cores atuais.
 */
export async function coresDaImagem(url: string): Promise<CoresDaCapa | null> {
  try {
    const img = new Image()
    // Os buckets públicos do Supabase mandam `Access-Control-Allow-Origin: *`;
    // sem isso o canvas fica "tainted" e getImageData lança.
    img.crossOrigin = 'anonymous'

    await new Promise<void>((ok, err) => {
      img.onload = () => ok()
      img.onerror = () => err(new Error('imagem não carregou'))
      img.src = url
    })

    // 64px de lado bastam para a distribuição de cores e mantêm o custo
    // desprezível, mesmo numa foto de 4000px.
    const lado = 64
    const canvas = document.createElement('canvas')
    canvas.width = lado
    canvas.height = lado
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null
    ctx.drawImage(img, 0, 0, lado, lado)

    const { data } = ctx.getImageData(0, 0, lado, lado)
    const baldes = new Map<string, Balde>()
    let total = 0

    for (let i = 0; i < data.length; i += 4) {
      const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]]
      if (a < 128) continue

      // Quase-branco e quase-preto dominam fotos sem dizer nada sobre a cor.
      const brilho = (r + g + b) / 3
      if (brilho > 240 || brilho < 15) continue

      total++
      const chave = [r, g, b].map((c) => Math.floor((c / 256) * NIVEIS)).join('-')
      const atual = baldes.get(chave)
      if (atual) {
        atual.r += r
        atual.g += g
        atual.b += b
        atual.n++
      } else {
        baldes.set(chave, { r, g, b, n: 1 })
      }
    }

    if (total === 0 || baldes.size === 0) return null

    const medias = [...baldes.values()].map((x) => {
      const r = x.r / x.n
      const g = x.g / x.n
      const b = x.b / x.n
      return { r, g, b, participacao: (100 * x.n) / total, sat: saturacao(r, g, b) }
    })

    const maisVivo = medias
      .filter((x) => x.participacao >= PARTICIPACAO_MINIMA)
      .sort((a, b) => b.sat - a.sat)[0]

    const maisComum = [...medias].sort((a, b) => b.participacao - a.participacao)[0]

    const escolhido = maisVivo && maisVivo.sat >= SATURACAO_MINIMA ? maisVivo : maisComum

    const [r1, g1, b1] = vivificar(escolhido.r, escolhido.g, escolhido.b, 1.6)
    // A segunda cor é a primeira escurecida: a nébula precisa de dois tons
    // para ter profundidade, e um par da mesma matiz fica coeso.
    return {
      cor: hex(r1, g1, b1),
      corSecundaria: hex(r1 * 0.42, g1 * 0.42, b1 * 0.42),
    }
  } catch {
    return null
  }
}
