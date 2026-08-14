/**
 * Cobrança das turmas do Ensino.
 *
 * Reaproveita a matemática das parcelas dos eventos (`lib/evento-cobranca.ts`),
 * que já resolve a divisão com resto e o abatimento em ordem cronológica. O que
 * muda é de onde vem o total: no evento ele nasce das respostas do formulário;
 * aqui é o valor da turma, com a possibilidade de a secretaria combinar outro
 * com um aluno específico (bolsa, meia, isenção do obreiro).
 */

import { calcularParcelas, formatarBRL, type ParcelaCalculada } from '@/lib/evento-cobranca'

export type ParcelaTurma = {
  id: string
  numero: number
  vencimento: string
  percentual: number | null
}

export type PagamentoEnsino = {
  id: string
  valor: number
  pago_em: string
  metodo: string | null
  observacao: string | null
}

export type SituacaoAluno = {
  inscricaoId: string
  nome: string
  /** O que essa pessoa deve — o combinado dela, ou o valor da turma. */
  total: number
  pago: number
  restante: number
  /** Verdadeiro quando a secretaria combinou um valor diferente do da turma. */
  combinado: boolean
  parcelas: ParcelaCalculada[]
  status: 'gratuito' | 'quitado' | 'parcial' | 'atrasado' | 'aberto'
}

export { formatarBRL }

/** Quanto uma inscrição deve: o valor combinado manda; senão, o da turma. */
export function valorDevido(
  valorTurma: number | null,
  valorCombinado: number | null
): number {
  if (valorCombinado != null) return Number(valorCombinado)
  return Number(valorTurma ?? 0)
}

export function totalPagoEnsino(pagamentos: PagamentoEnsino[]): number {
  return Number(pagamentos.reduce((acc, p) => acc + Number(p.valor), 0).toFixed(2))
}

/**
 * A situação de um aluno: quanto deve, quanto pagou e se está atrasado.
 *
 * "Atrasado" só existe com plano de parcelas — sem vencimento definido não há
 * data para comparar, e chamar de atrasado quem nunca teve prazo seria injusto
 * com o aluno e inútil para a secretaria.
 */
export function situacaoAluno(params: {
  inscricaoId: string
  nome: string
  valorTurma: number | null
  valorCombinado: number | null
  parcelas: ParcelaTurma[]
  pagamentos: PagamentoEnsino[]
  hoje?: Date
}): SituacaoAluno {
  const total = valorDevido(params.valorTurma, params.valorCombinado)
  const pago = totalPagoEnsino(params.pagamentos)
  const restante = Number(Math.max(0, total - pago).toFixed(2))

  const parcelas = total > 0
    ? calcularParcelas(total, params.parcelas, params.pagamentos, params.hoje ?? new Date())
    : []

  let status: SituacaoAluno['status']
  if (total <= 0) status = 'gratuito'
  else if (restante <= 0) status = 'quitado'
  else if (parcelas.some((p) => p.status === 'vencida')) status = 'atrasado'
  else if (pago > 0) status = 'parcial'
  else status = 'aberto'

  return {
    inscricaoId: params.inscricaoId,
    nome: params.nome,
    total,
    pago,
    restante,
    combinado: params.valorCombinado != null,
    parcelas,
    status,
  }
}

export const STATUS_LABEL: Record<SituacaoAluno['status'], { texto: string; classe: string }> = {
  gratuito: { texto: 'Sem cobrança', classe: 'bg-muted text-muted-foreground' },
  quitado: { texto: 'Pago', classe: 'bg-green-100 text-green-700' },
  parcial: { texto: 'Parcial', classe: 'bg-amber-100 text-amber-700' },
  atrasado: { texto: 'Atrasado', classe: 'bg-red-100 text-red-700' },
  aberto: { texto: 'Em aberto', classe: 'bg-blue-100 text-blue-700' },
}
