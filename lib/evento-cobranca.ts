import type { CampoFormulario } from '@/lib/supabase/types'

export type ValorEvento = {
  id: string
  nome: string
  valor: number
  campo_id: string | null
  opcao: string | null
  ordem: number
}

export type ParcelaEvento = {
  id: string
  numero: number
  vencimento: string
  percentual: number | null
}

export type PagamentoInscricao = {
  id: string
  valor: number
  pago_em: string
  metodo: string | null
  observacao: string | null
}

export function formatarBRL(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/**
 * Determina quanto uma pessoa deve pagar, a partir das respostas do formulário.
 *
 * Regras, na ordem:
 *  1. Se algum valor está ligado a uma opção que a pessoa escolheu, usa ele.
 *  2. Senão, usa o valor "geral" (sem campo_id) como preço único.
 *  3. Sem nenhum dos dois, retorna 0 (evento gratuito).
 *
 * Campos de múltipla seleção guardam as opções separadas por vírgula; nesse
 * caso somamos todos os valores correspondentes (ex.: adicionais opcionais).
 */
export function calcularValorInscricao(
  valores: ValorEvento[],
  respostas: Record<string, string>
): number {
  const porOpcao = valores.filter((v) => v.campo_id && v.opcao)

  let total = 0
  let achou = false

  for (const v of porOpcao) {
    const resposta = respostas[v.campo_id as string]
    if (!resposta) continue
    const escolhidas = resposta.split(',').map((s) => s.trim())
    if (escolhidas.includes((v.opcao as string).trim())) {
      total += Number(v.valor)
      achou = true
    }
  }

  if (achou) return Number(total.toFixed(2))

  const geral = valores.find((v) => !v.campo_id)
  return geral ? Number(geral.valor) : 0
}

/** Campos do formulário que podem ser usados para definir preço. */
export function camposComOpcoes(campos: CampoFormulario[]): CampoFormulario[] {
  return campos.filter((c) => (c.tipo === 'opcoes' || c.tipo === 'checkbox') && (c.opcoes?.length ?? 0) > 0)
}

export type ParcelaCalculada = {
  numero: number
  vencimento: string
  valor: number
  pago: number
  restante: number
  status: 'paga' | 'parcial' | 'vencida' | 'aberta'
}

/**
 * Distribui o total entre as parcelas e aplica os pagamentos recebidos em
 * ordem cronológica — o dinheiro vai quitando da primeira parcela em diante.
 * O resto da divisão vai para a última parcela, para o somatório fechar exato.
 */
export function calcularParcelas(
  total: number,
  parcelas: ParcelaEvento[],
  pagamentos: PagamentoInscricao[],
  hoje: Date = new Date()
): ParcelaCalculada[] {
  if (parcelas.length === 0) return []

  const ordenadas = [...parcelas].sort((a, b) => a.numero - b.numero)

  const valores = ordenadas.map((p) =>
    p.percentual != null
      ? Number(((total * Number(p.percentual)) / 100).toFixed(2))
      : Number((total / ordenadas.length).toFixed(2))
  )

  // Ajusta a última para o somatório bater exatamente com o total
  const soma = valores.reduce((a, b) => a + b, 0)
  const diferenca = Number((total - soma).toFixed(2))
  if (valores.length > 0 && diferenca !== 0) {
    valores[valores.length - 1] = Number((valores[valores.length - 1] + diferenca).toFixed(2))
  }

  let saldo = pagamentos.reduce((acc, p) => acc + Number(p.valor), 0)
  const hojeStr = hoje.toISOString().split('T')[0]

  return ordenadas.map((p, i) => {
    const valor = valores[i]
    const pago = Number(Math.min(saldo, valor).toFixed(2))
    saldo = Number((saldo - pago).toFixed(2))
    const restante = Number((valor - pago).toFixed(2))

    let status: ParcelaCalculada['status']
    if (restante <= 0) status = 'paga'
    else if (p.vencimento < hojeStr) status = 'vencida'
    else if (pago > 0) status = 'parcial'
    else status = 'aberta'

    return { numero: p.numero, vencimento: p.vencimento, valor, pago, restante, status }
  })
}

export function totalPago(pagamentos: PagamentoInscricao[]): number {
  return Number(pagamentos.reduce((acc, p) => acc + Number(p.valor), 0).toFixed(2))
}
