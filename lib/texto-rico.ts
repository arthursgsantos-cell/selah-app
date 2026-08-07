/**
 * Texto formatado escrito por gente, não por programador.
 *
 * A descrição de uma aula é um artigo: o professor quer título, parágrafo,
 * lista de pontos, um versículo destacado e um link para o material. Guardar
 * HTML no banco resolveria, mas obrigaria a confiar no que vem do editor e a
 * higienizar na saída. Guardamos texto puro numa marcação enxuta (a mesma que
 * todo mundo já digita sem perceber: `**negrito**`, `- item`, `> citação`) e
 * montamos o HTML aqui.
 *
 * Por isso a ordem importa: primeiro escapa tudo, depois monta as tags. Nada
 * do que a pessoa escreveu chega ao navegador como marcação — o que vira tag é
 * só o que este arquivo decidiu criar.
 *
 * O que já estava salvo como texto corrido continua valendo: sem marcação
 * nenhuma, cada bloco vira um parágrafo, que é como aparecia antes.
 */

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
}

const escapar = (s: string) => s.replace(/[&<>"]/g, (c) => ESCAPES[c])

/** Só endereço de página, e-mail ou caminho interno viram link. */
const ENDERECO_SEGURO = /^(https?:\/\/|mailto:|\/)/i

const LINK_ABRE = (url: string) => `<a href="${url}" target="_blank" rel="noopener noreferrer">`

/**
 * Formatação dentro de uma linha.
 *
 * Links entram primeiro e saem de cena como marcador (`\u0000n\u0000`): o
 * endereço tem `*`, `_` e `~` com frequência, e sem tirá-lo do caminho um
 * `snake_case` no meio da URL viraria itálico.
 */
function comFormato(texto: string): string {
  const guardados: string[] = []
  const guardar = (html: string) => `\u0000${guardados.push(html) - 1}\u0000`

  let s = escapar(texto)

  // [rótulo](endereço)
  s = s.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (todo, rotulo: string, url: string) =>
    ENDERECO_SEGURO.test(url) ? guardar(`${LINK_ABRE(url)}${rotulo}</a>`) : todo
  )

  // Endereço solto, colado no meio da frase. A pontuação final fica de fora:
  // "veja em https://ibzs.com." não deve levar o ponto para dentro do link.
  s = s.replace(
    /(^|[\s(])(https?:\/\/[^\s<]*[^\s<.,;:!?)"'])/g,
    (_todo, antes: string, url: string) => `${antes}${guardar(`${LINK_ABRE(url)}${url}</a>`)}`
  )

  s = s
    .replace(/`([^`\n]+)`/g, (_todo, codigo: string) => guardar(`<code>${codigo}</code>`))
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/(^|[^_\w])_([^_\n]+)_(?![\w_])/g, '$1<em>$2</em>')
    .replace(/~~([^~\n]+)~~/g, '<s>$1</s>')

  return s.replace(/\u0000(\d+)\u0000/g, (_todo, i: string) => guardados[Number(i)])
}

type Lista = { tipo: 'ul' | 'ol'; itens: string[] }

/**
 * Converte a marcação em HTML pronto para `dangerouslySetInnerHTML`.
 *
 * "Dangerous" é o nome do prop, não do conteúdo: tudo que veio de fora já
 * passou por `escapar` antes de qualquer tag ser montada.
 */
export function textoRicoParaHtml(texto: string): string {
  const partes: string[] = []
  let paragrafo: string[] = []
  let citacao: string[] = []
  let lista: Lista | null = null

  const fecharParagrafo = () => {
    if (paragrafo.length === 0) return
    // Quebra de linha simples dentro do parágrafo é intencional (endereço,
    // verso de hino) — vira <br>, não parágrafo novo.
    partes.push(`<p>${paragrafo.map(comFormato).join('<br />')}</p>`)
    paragrafo = []
  }

  const fecharCitacao = () => {
    if (citacao.length === 0) return
    partes.push(`<blockquote>${citacao.map(comFormato).join('<br />')}</blockquote>`)
    citacao = []
  }

  const fecharLista = () => {
    if (!lista) return
    const itens = lista.itens.map((i) => `<li>${comFormato(i)}</li>`).join('')
    partes.push(`<${lista.tipo}>${itens}</${lista.tipo}>`)
    lista = null
  }

  const fecharTudo = () => {
    fecharParagrafo()
    fecharCitacao()
    fecharLista()
  }

  const empilharItem = (tipo: 'ul' | 'ol', item: string) => {
    fecharParagrafo()
    fecharCitacao()
    if (lista && lista.tipo === tipo) {
      lista.itens.push(item)
      return
    }
    fecharLista()
    lista = { tipo, itens: [item] }
  }

  for (const bruta of texto.replace(/\r\n/g, '\n').split('\n')) {
    const linha = bruta.trim()

    if (linha === '') {
      fecharTudo()
      continue
    }

    const titulo = /^(#{1,3})\s+(.+)$/.exec(linha)
    if (titulo) {
      fecharTudo()
      // `#` vira h2: o h1 da página já é o título da aula, e dois h1 numa
      // página só confundem quem navega por leitor de tela.
      const nivel = titulo[1].length + 1
      partes.push(`<h${nivel}>${comFormato(titulo[2])}</h${nivel}>`)
      continue
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(linha)) {
      fecharTudo()
      partes.push('<hr />')
      continue
    }

    const citada = /^>\s?(.*)$/.exec(linha)
    if (citada) {
      fecharParagrafo()
      fecharLista()
      citacao.push(citada[1])
      continue
    }

    const marcador = /^[-*+]\s+(.+)$/.exec(linha)
    if (marcador) {
      empilharItem('ul', marcador[1])
      continue
    }

    const numerado = /^\d+[.)]\s+(.+)$/.exec(linha)
    if (numerado) {
      empilharItem('ol', numerado[1])
      continue
    }

    fecharCitacao()
    fecharLista()
    paragrafo.push(linha)
  }

  fecharTudo()
  return partes.join('')
}

/**
 * A mesma marcação, sem formatação — para onde só cabe uma linha (resumo de
 * card, `<meta name="description">`, prévia numa lista).
 */
export function textoRicoEmTextoPuro(texto: string): string {
  return texto
    .replace(/\r\n/g, '\n')
    .replace(/^\s{0,3}(#{1,3}\s+|>\s?|[-*+]\s+|\d+[.)]\s+)/gm, '')
    .replace(/^(-{3,}|\*{3,}|_{3,})$/gm, '')
    .replace(/\[([^\]\n]+)\]\([^)\s]+\)/g, '$1')
    .replace(/(\*\*|~~|`)/g, '')
    .replace(/(^|[^*\w])\*([^*\n]+)\*/g, '$1$2')
    .replace(/\s+/g, ' ')
    .trim()
}
