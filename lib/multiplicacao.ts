/**
 * A linhagem das células — quem nasceu de quem, e o que a data-alvo está
 * dizendo hoje.
 *
 * Duas coisas moram aqui porque respondem à mesma pergunta a partir dos mesmos
 * campos (`celula_mae_id`, `multiplicacao_prevista`, `multiplicada_em`):
 *
 * - **a árvore**: uma lista plana de células vira gerações encadeadas, por
 *   rede. Porto → Leme → Cais é uma linha só, e não três pares soltos;
 * - **o estado da data**: "prevista para 16 de agosto" continua dizendo
 *   *prevista* depois do dia 16, e aí vira uma frase que engana. Data vencida
 *   é atraso, não previsão.
 *
 * Tudo aqui é função pura sobre dados já carregados — o servidor monta, o
 * componente desenha.
 */

const MS_POR_DIA = 24 * 60 * 60 * 1000

/**
 * Quantas filhas uma multiplicação pode gerar de uma vez.
 *
 * Mora aqui, e não no arquivo da action, porque `'use server'` só exporta
 * função assíncrona — e o diálogo precisa deste número para parar de oferecer
 * o botão de somar mais uma.
 */
export const MAX_FILHAS = 6

/** O mínimo que a árvore precisa saber de uma célula. */
export interface CelulaLinhagem {
  id: string
  nome: string
  redeId: string
  redeNome: string
  redeCor: string
  liderNome: string | null
  logoUrl: string | null
  cor: string | null
  celulaMaeId: string | null
  multiplicacaoPrevista: string | null
  multiplicadaEm: string | null
  nomeProvisorio: boolean
}

export interface NoArvore<C extends CelulaLinhagem = CelulaLinhagem> {
  celula: C
  /** 1 para a célula raiz, 2 para as filhas dela, e assim por diante. */
  geracao: number
  filhas: NoArvore<C>[]
  /** Quantas células descem desta, somando todas as gerações abaixo. */
  descendentes: number
}

export interface ArvoreDaRede<C extends CelulaLinhagem = CelulaLinhagem> {
  redeId: string
  redeNome: string
  redeCor: string
  /** Linhagens de verdade: raízes que já geraram pelo menos uma filha. */
  raizes: NoArvore<C>[]
  /** Células que ainda não multiplicaram nem vieram de multiplicação. */
  soltas: C[]
  /** Quantas gerações a rede alcançou (1 = ninguém multiplicou ainda). */
  geracoes: number
}

/**
 * Agrupa as células em árvores, uma por rede.
 *
 * Mãe fora do recorte recebido — célula desativada, ou de outra rede que a
 * pessoa não enxerga — não some da árvore: a filha sobe a raiz no lugar dela.
 * Perder a célula da tela seria pior que perder o galho.
 */
export function montarArvores<C extends CelulaLinhagem>(celulas: C[]): ArvoreDaRede<C>[] {
  const porId = new Map(celulas.map((c) => [c.id, c]))

  const maeVisivel = (c: C): C | null => {
    if (!c.celulaMaeId) return null
    const mae = porId.get(c.celulaMaeId)
    // Mãe noutra rede vira raiz aqui: a árvore é por rede, e um galho
    // atravessando duas redes não desenha em nenhuma das duas.
    return mae && mae.redeId === c.redeId ? mae : null
  }

  const filhasPorMae = new Map<string, C[]>()
  celulas.forEach((c) => {
    const mae = maeVisivel(c)
    if (!mae) return
    const lista = filhasPorMae.get(mae.id) ?? []
    lista.push(c)
    filhasPorMae.set(mae.id, lista)
  })

  const ordenar = (lista: C[]) =>
    [...lista].sort((a, b) => {
      // Quem nasceu primeiro aparece primeiro; sem data, ordem alfabética.
      const da = a.multiplicadaEm ?? ''
      const db = b.multiplicadaEm ?? ''
      if (da && db && da !== db) return da.localeCompare(db)
      if (da && !db) return -1
      if (!da && db) return 1
      return a.nome.localeCompare(b.nome, 'pt-BR')
    })

  // Ciclo em `celula_mae_id` não deveria existir (o banco impede a célula de
  // ser mãe de si mesma, e a edição confere), mas a recursão não pode ser a
  // primeira a descobrir que existe.
  const construir = (c: C, geracao: number, visitados: Set<string>): NoArvore<C> => {
    visitados.add(c.id)
    const filhas = ordenar(filhasPorMae.get(c.id) ?? [])
      .filter((f) => !visitados.has(f.id))
      .map((f) => construir(f, geracao + 1, visitados))
    return {
      celula: c,
      geracao,
      filhas,
      descendentes: filhas.reduce((total, f) => total + 1 + f.descendentes, 0),
    }
  }

  const porRede = new Map<string, C[]>()
  celulas.forEach((c) => {
    const lista = porRede.get(c.redeId) ?? []
    lista.push(c)
    porRede.set(c.redeId, lista)
  })

  const arvores: ArvoreDaRede<C>[] = []

  porRede.forEach((daRede, redeId) => {
    const raizes: NoArvore<C>[] = []
    const soltas: C[] = []

    ordenar(daRede)
      .filter((c) => maeVisivel(c) === null)
      .forEach((c) => {
        const temFilhas = (filhasPorMae.get(c.id) ?? []).length > 0
        if (temFilhas) raizes.push(construir(c, 1, new Set()))
        else soltas.push(c)
      })

    // Linhagem maior primeiro: é a história que a rede tem para contar.
    raizes.sort((a, b) => b.descendentes - a.descendentes || a.celula.nome.localeCompare(b.celula.nome, 'pt-BR'))

    const primeira = daRede[0]
    arvores.push({
      redeId,
      redeNome: primeira?.redeNome ?? '',
      redeCor: primeira?.redeCor ?? '#6366f1',
      raizes,
      soltas,
      geracoes: raizes.reduce((max, r) => Math.max(max, profundidade(r)), daRede.length > 0 ? 1 : 0),
    })
  })

  // Rede com linhagem antes de rede sem nenhuma.
  return arvores.sort(
    (a, b) => b.raizes.length - a.raizes.length || a.redeNome.localeCompare(b.redeNome, 'pt-BR'),
  )
}

function profundidade(no: NoArvore<CelulaLinhagem>): number {
  return no.filhas.length === 0 ? no.geracao : Math.max(...no.filhas.map(profundidade))
}

export type EstadoMultiplicacao = 'vencida' | 'proxima' | 'planejada' | 'sem-data'

export interface SituacaoMultiplicacao {
  estado: EstadoMultiplicacao
  /** Positivo = falta esse tanto de dias. Negativo = venceu há esse tanto. */
  dias: number | null
  /** Frase curta, pronta para a linha da lista: "venceu há 5 dias". */
  rotulo: string
}

/** Daqui em diante a data-alvo é tratada como "chegando", e não como plano. */
export const DIAS_MULTIPLICACAO_PROXIMA = 30

/**
 * O que a data-alvo está dizendo hoje.
 *
 * Data no passado é atraso: a rede combinou multiplicar e não multiplicou (ou
 * multiplicou e ninguém registrou). Chamar isso de "prevista" apaga justamente
 * o que o supervisor precisa ver.
 */
export function situacaoMultiplicacao(
  dataPrevista: string | null,
  hoje: Date = new Date(),
): SituacaoMultiplicacao {
  if (!dataPrevista) return { estado: 'sem-data', dias: null, rotulo: 'sem data definida' }

  // Meio-dia dos dois lados: a data vem pura do banco e o fuso não pode
  // empurrar o cálculo para o dia anterior.
  const alvo = new Date(`${dataPrevista}T12:00:00`)
  const referencia = new Date(hoje)
  referencia.setHours(12, 0, 0, 0)
  const dias = Math.round((alvo.getTime() - referencia.getTime()) / MS_POR_DIA)

  const quando = formatarData(dataPrevista)

  if (dias < 0) {
    const atraso = Math.abs(dias)
    return {
      estado: 'vencida',
      dias,
      rotulo:
        atraso === 1
          ? `era para ter multiplicado ontem (${quando})`
          : atraso < 30
            ? `${atraso} dias de atraso — era ${quando}`
            : `${meses(atraso)} de atraso — era ${quando}`,
    }
  }

  if (dias === 0) return { estado: 'proxima', dias, rotulo: `multiplica hoje (${quando})` }
  if (dias === 1) return { estado: 'proxima', dias, rotulo: `multiplica amanhã (${quando})` }
  if (dias <= DIAS_MULTIPLICACAO_PROXIMA) {
    return { estado: 'proxima', dias, rotulo: `em ${dias} dias — ${quando}` }
  }

  return { estado: 'planejada', dias, rotulo: `prevista para ${quando}` }
}

function meses(dias: number): string {
  const m = Math.round(dias / 30)
  return m === 1 ? 'um mês' : `${m} meses`
}

/** "16 de agosto" — e com o ano quando não é o ano corrente. */
export function formatarData(iso: string, hoje: Date = new Date()): string {
  const d = new Date(`${iso}T12:00:00`)
  const mesmoAno = d.getFullYear() === hoje.getFullYear()
  return d.toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    ...(mesmoAno ? {} : { year: 'numeric' }),
  })
}

/**
 * Nome de estreia da célula que acabou de nascer.
 *
 * Multiplicação acontece antes do nome — a liderança separa as pessoas numa
 * quarta e só batiza a célula semanas depois. Em vez de exigir um nome que
 * ainda não existe, a filha entra assim e a árvore passa a pedir o nome.
 */
export function nomeProvisorioDe(nomeMae: string, indice: number, total: number): string {
  const base = `Nova célula de ${nomeMae}`
  return total > 1 ? `${base} (${indice + 1})` : base
}
