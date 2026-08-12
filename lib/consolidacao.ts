/**
 * Consolidação — o acompanhamento de quem chegou.
 *
 * O visitante já era registrado na presença do encontro, mas morria ali: virava
 * texto num campo e ninguém mais olhava. Aqui ele vira uma pessoa com
 * responsável, etapa e histórico de contato — e, principalmente, com alguém
 * respondendo por ele.
 *
 * A pergunta que este módulo existe para responder não é "quantos vieram", é
 * **"quem está sem ninguém falando com ele?"**. Por isso o alerta central é o
 * silêncio, não o volume.
 *
 * Este arquivo é a metade compartilhada: rótulos, tipos e contas puras, sem
 * nenhum acesso a banco. Ele é importado por componentes de cliente, e é essa
 * a razão da separação — a leitura fica em `lib/consolidacao-servidor.ts`,
 * que usa `next/headers` e por isso não pode entrar num bundle de navegador.
 */

import type {
  CanalContato, DecisaoConsolidacao, EtapaConsolidacao, OrigemConsolidacao,
  ResultadoContato,
} from '@/lib/supabase/types'

/**
 * Dias sem contato a partir dos quais a ficha esfria e aparece no alerta.
 *
 * Sete, e não trinta: quem visitou a igreja no domingo e não ouviu ninguém até
 * o domingo seguinte já entendeu que não fez falta. O prazo é curto de
 * propósito — é a janela em que o acompanhamento ainda parece acolhimento e
 * não cobrança.
 */
export const DIAS_SEM_CONTATO_ALERTA = 7

/** Ordem do funil. `afastado` fica de fora: é saída, não etapa seguinte. */
export const ETAPAS_FUNIL: EtapaConsolidacao[] = [
  'acolhido',
  'atribuido',
  'em_acompanhamento',
  'integrado',
]

export const ETAPA_LABELS: Record<EtapaConsolidacao, string> = {
  acolhido: 'Acolhido',
  atribuido: 'Atribuído',
  em_acompanhamento: 'Em acompanhamento',
  integrado: 'Integrado',
  afastado: 'Afastado',
}

export const ETAPA_AJUDA: Record<EtapaConsolidacao, string> = {
  acolhido: 'Chegou, e ainda não tem quem responda por ele.',
  atribuido: 'Já tem responsável, mas ninguém falou com a pessoa ainda.',
  em_acompanhamento: 'Alguém está em contato.',
  integrado: 'Está frequentando uma célula por conta própria.',
  afastado: 'Parou de responder ou pediu para não ser procurado.',
}

export const ORIGEM_LABELS: Record<OrigemConsolidacao, string> = {
  culto: 'Culto',
  celula: 'Célula',
  evento: 'Evento',
  indicacao: 'Indicação',
  outro: 'Outro',
}

export const DECISAO_LABELS: Record<DecisaoConsolidacao, string> = {
  aceitou_jesus: 'Aceitou Jesus',
  reconciliacao: 'Reconciliação',
  visitante: 'Visitante',
}

export const CANAL_LABELS: Record<CanalContato, string> = {
  whatsapp: 'WhatsApp',
  ligacao: 'Ligação',
  presencial: 'Presencial',
  outro: 'Outro',
}

export const RESULTADO_LABELS: Record<ResultadoContato, string> = {
  falou: 'Falou com a pessoa',
  sem_resposta: 'Sem resposta',
  remarcado: 'Remarcou',
}

export interface ContatoRegistrado {
  id: string
  canal: CanalContato
  resultado: ResultadoContato
  nota: string | null
  data: string
  autorNome: string | null
}

export interface FichaConsolidacao {
  id: string
  nome: string
  telefone: string | null
  origem: OrigemConsolidacao
  decisao: DecisaoConsolidacao | null
  etapa: EtapaConsolidacao
  observacao: string | null
  dataAcolhimento: string
  celulaId: string | null
  celulaNome: string | null
  responsavelId: string | null
  responsavelNome: string | null
  contatos: ContatoRegistrado[]
  /** Dias desde o último contato. `null` quando nunca houve nenhum. */
  diasSemContato: number | null
  /** Dias desde o acolhimento — o relógio que corre mesmo sem contato. */
  diasDesdeAcolhimento: number
  /**
   * Ficha esfriando: ninguém falou com a pessoa dentro do prazo. Vale para
   * quem nunca recebeu contato e para quem recebeu e parou.
   */
  esfriando: boolean
}

export interface AcessoConsolidacao {
  userId: string
  igrejaId: string
  role: string
  /** Enxerga e mexe em qualquer ficha da igreja. */
  direcao: boolean
  /** Pode cadastrar ficha — líder para cima. */
  podeAcolher: boolean
  /** Células que a pessoa lidera ou supervisiona. Vazio para a direção. */
  celulaIds: string[]
}

const MS_POR_DIA = 24 * 60 * 60 * 1000

/** Dias inteiros entre uma data ISO (`2026-08-12`) e hoje. */
export function diasAte(dataIso: string): number {
  return Math.floor((Date.now() - new Date(`${dataIso}T12:00:00`).getTime()) / MS_POR_DIA)
}

/**
 * A ficha esfriou?
 *
 * Quem já foi integrado ou se afastou saiu da fila de acompanhamento — cobrar
 * contato semanal de quem já está numa célula seria ruído. Sem contato nenhum,
 * o relógio corre desde o acolhimento.
 */
export function estaEsfriando(
  etapa: EtapaConsolidacao,
  diasSemContato: number | null,
  diasDesdeAcolhimento: number
): boolean {
  if (etapa === 'integrado' || etapa === 'afastado') return false
  return diasSemContato === null
    ? diasDesdeAcolhimento >= DIAS_SEM_CONTATO_ALERTA
    : diasSemContato >= DIAS_SEM_CONTATO_ALERTA
}

/** "há 3 dias", "falaram hoje", "nunca". */
export function textoSilencio(ficha: FichaConsolidacao): string {
  if (ficha.diasSemContato === null) {
    return ficha.diasDesdeAcolhimento === 0
      ? 'chegou hoje, sem contato'
      : `${ficha.diasDesdeAcolhimento} ${ficha.diasDesdeAcolhimento === 1 ? 'dia' : 'dias'} sem nenhum contato`
  }
  if (ficha.diasSemContato === 0) return 'falaram hoje'
  return `último contato há ${ficha.diasSemContato} ${ficha.diasSemContato === 1 ? 'dia' : 'dias'}`
}
