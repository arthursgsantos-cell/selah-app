/**
 * O cronograma de um desafio de leitura.
 *
 * O professor diz o quê e até quando — "a carta de Tiago, 30 vezes, até 20 de
 * dezembro" — e daqui sai a lista de dias que o aluno vai riscando. É a peça
 * que transforma uma meta em algo cumprível: ninguém lê Tiago trinta vezes
 * olhando para o total, mas lê três capítulos por dia.
 *
 * Tudo aqui é função pura sobre `LivroBiblia[]`. O cálculo roda no servidor
 * (ao publicar a atividade) e no cliente (na prévia enquanto o professor
 * monta), e uma consulta ao banco no meio impediria a segunda.
 */

import type { ConfigLeitura, TrechoLeitura } from '@/lib/supabase/types'

export interface LivroBiblia {
  id: number
  sigla: string
  nome: string
  testamento: 'AT' | 'NT'
  capitulos: number
}

/** Uma linha do cronograma: o que ler, e em que dia. */
export interface ItemLeitura {
  ordem: number
  rotulo: string
  livroId: number
  capituloInicio: number
  capituloFim: number
  /** Em qual das N voltas esta linha está. 1 quando não há repetição. */
  rodada: number
  /** ISO `yyyy-mm-dd`. Nulo quando o desafio não tem prazo. */
  dataPrevista: string | null
}

export interface ResumoLeitura {
  /** Capítulos de uma volta pelos trechos. */
  porVolta: number
  /** Capítulos somando as repetições. É o tamanho real do desafio. */
  total: number
  dias: number
  /** A conta que responde "dá para fazer?". */
  capitulosPorDia: number
  itens: ItemLeitura[]
}

/** Data local em `yyyy-mm-dd`, sem passar por UTC. */
function iso(d: Date): string {
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

/**
 * Data a partir de `yyyy-mm-dd` sem cair no dia anterior.
 *
 * `new Date('2026-08-13')` é meia-noite UTC, que em Natal é dia 12 às 21h —
 * o mesmo motivo pelo qual `ensino_aulas.data` nunca vira Date direto.
 */
function daIso(texto: string): Date {
  const [ano, mes, dia] = texto.split('-').map(Number)
  return new Date(ano, mes - 1, dia)
}

function somarDias(base: Date, dias: number): Date {
  const d = new Date(base)
  d.setDate(d.getDate() + dias)
  return d
}

/** Dias entre duas datas, contando os dois extremos. Nunca menos que 1. */
export function diasEntre(inicio: string, fim: string): number {
  const ms = daIso(fim).getTime() - daIso(inicio).getTime()
  return Math.max(1, Math.floor(ms / 86_400_000) + 1)
}

export function nomeDoLivro(livros: LivroBiblia[], id: number): string {
  return livros.find((l) => l.id === id)?.nome ?? 'Livro'
}

/** "Tiago", "Tiago 1", "Tiago 1–3" — conforme o trecho seja o livro todo ou parte. */
export function rotuloTrecho(livros: LivroBiblia[], t: TrechoLeitura): string {
  const livro = livros.find((l) => l.id === t.livroId)
  const nome = livro?.nome ?? 'Livro'
  if (livro && t.capituloInicio === 1 && t.capituloFim >= livro.capitulos) return nome
  if (t.capituloInicio === t.capituloFim) return `${nome} ${t.capituloInicio}`
  return `${nome} ${t.capituloInicio}–${t.capituloFim}`
}

/** Um trecho por livro inteiro. É como quase todo desafio começa. */
export function trechoDoLivro(livro: LivroBiblia): TrechoLeitura {
  return { livroId: livro.id, capituloInicio: 1, capituloFim: livro.capitulos }
}

/** Normaliza limites invertidos ou fora do livro antes de qualquer conta. */
function saneado(livros: LivroBiblia[], t: TrechoLeitura): TrechoLeitura | null {
  const livro = livros.find((l) => l.id === t.livroId)
  if (!livro) return null
  const inicio = Math.min(Math.max(1, t.capituloInicio), livro.capitulos)
  const fim = Math.min(Math.max(inicio, t.capituloFim), livro.capitulos)
  return { livroId: livro.id, capituloInicio: inicio, capituloFim: fim }
}

export function capitulosDoTrecho(t: TrechoLeitura): number {
  return Math.max(0, t.capituloFim - t.capituloInicio + 1)
}

/**
 * Monta o cronograma.
 *
 * A distribuição não é "N capítulos por dia" fixo: com 108 capítulos em 30
 * dias daria 3,6, e arredondar para 4 termina a leitura três dias antes do
 * prazo — o aluno acha que se enganou. Em vez disso os capítulos são
 * repartidos pelos dias com o resto espalhado nos primeiros, de modo que a
 * última linha caia exatamente no prazo.
 *
 * Dentro de um dia, capítulos seguidos do mesmo livro viram uma linha só
 * ("Tiago 1–3"); a virada de livro abre outra. Assim o aluno marca por trecho
 * coerente, e não por dia genérico.
 *
 * Sem prazo, o cronograma sai sem datas: continua sendo uma lista de trechos
 * para riscar, só que no ritmo de cada um.
 */
export function montarCronograma(
  livros: LivroBiblia[],
  config: ConfigLeitura,
  inicio: string,
  prazo: string | null
): ResumoLeitura {
  const trechos = config.trechos
    .map((t) => saneado(livros, t))
    .filter((t): t is TrechoLeitura => t !== null && capitulosDoTrecho(t) > 0)

  const porVolta = trechos.reduce((s, t) => s + capitulosDoTrecho(t), 0)
  const voltas = config.modo === 'repeticoes' ? Math.max(1, config.repeticoes) : 1
  const total = porVolta * voltas

  if (total === 0) {
    return { porVolta: 0, total: 0, dias: 0, capitulosPorDia: 0, itens: [] }
  }

  // A fila de capítulos, na ordem em que serão lidos.
  const fila: { livroId: number; capitulo: number; rodada: number }[] = []
  for (let rodada = 1; rodada <= voltas; rodada++) {
    for (const t of trechos) {
      for (let c = t.capituloInicio; c <= t.capituloFim; c++) {
        fila.push({ livroId: t.livroId, capitulo: c, rodada })
      }
    }
  }

  const dataInicio = daIso(inicio)
  // Um dia por capítulo, no máximo: 5 capítulos em 60 dias não vira "0,08 por
  // dia", vira cinco dias de leitura e o resto de folga.
  const diasBrutos = prazo ? diasEntre(inicio, prazo) : total
  const dias = Math.max(1, Math.min(diasBrutos, total))

  const base = Math.floor(total / dias)
  const sobra = total % dias

  const itens: ItemLeitura[] = []
  let posicao = 0
  let ordem = 0

  for (let dia = 0; dia < dias; dia++) {
    // Os primeiros `sobra` dias levam um capítulo a mais. É o que faz a última
    // linha cair no prazo em vez de antes dele.
    const quantos = base + (dia < sobra ? 1 : 0)
    const doDia = fila.slice(posicao, posicao + quantos)
    posicao += quantos
    if (doDia.length === 0) continue

    const data = prazo ? iso(somarDias(dataInicio, dia)) : null

    // Agrupa capítulos seguidos do mesmo livro e da mesma volta.
    let bloco = [doDia[0]]
    const fechar = () => {
      const primeiro = bloco[0]
      const ultimo = bloco[bloco.length - 1]
      itens.push({
        ordem: ordem++,
        rotulo: rotuloTrecho(livros, {
          livroId: primeiro.livroId,
          capituloInicio: primeiro.capitulo,
          capituloFim: ultimo.capitulo,
        }),
        livroId: primeiro.livroId,
        capituloInicio: primeiro.capitulo,
        capituloFim: ultimo.capitulo,
        rodada: primeiro.rodada,
        dataPrevista: data,
      })
    }

    for (let i = 1; i < doDia.length; i++) {
      const anterior = bloco[bloco.length - 1]
      const atual = doDia[i]
      const seguido =
        atual.livroId === anterior.livroId &&
        atual.rodada === anterior.rodada &&
        atual.capitulo === anterior.capitulo + 1
      if (seguido) {
        bloco.push(atual)
      } else {
        fechar()
        bloco = [atual]
      }
    }
    fechar()
  }

  return {
    porVolta,
    total,
    dias,
    // Arredondado para cima: é o número que o aluno usa para se organizar, e
    // prometer 3 quando em metade dos dias são 4 seria enganoso.
    capitulosPorDia: Math.ceil(total / dias),
    itens,
  }
}

/**
 * Como vai o aluno em relação ao calendário.
 *
 * `atrasado` conta o que já venceu e não foi marcado — é a coluna que o
 * professor olha no painel. Um item sem data nunca atrasa.
 */
export function progressoLeitura(
  itens: { feito: boolean; dataPrevista: string | null }[],
  hoje: string
): { feitos: number; total: number; atrasados: number; percentual: number } {
  const feitos = itens.filter((i) => i.feito).length
  const atrasados = itens.filter(
    (i) => !i.feito && i.dataPrevista !== null && i.dataPrevista < hoje
  ).length
  return {
    feitos,
    total: itens.length,
    atrasados,
    percentual: itens.length > 0 ? Math.round((feitos / itens.length) * 100) : 0,
  }
}
