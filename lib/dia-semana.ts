/** Utilitários de dia da semana para os encontros de célula. */

/** Fuso da igreja. Encontros são guardados em UTC, mas a data que importa é a local. */
export const TZ_IGREJA = 'America/Sao_Paulo'

/**
 * Data "AAAA-MM-DD" de um instante, no fuso da igreja.
 *
 * Necessário porque o encontro é salvo em UTC: um encontro às 21h de Brasília
 * vira 00h UTC do dia seguinte, e usar a data do UTC apontaria para o dia errado.
 */
export function dataLocalIso(instante: Date | string): string {
  const d = typeof instante === 'string' ? new Date(instante) : instante
  // 'en-CA' formata como AAAA-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ_IGREJA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

export const DIAS_SEMANA = [
  { valor: 0, nome: 'Domingo',       curto: 'Dom' },
  { valor: 1, nome: 'Segunda-feira', curto: 'Seg' },
  { valor: 2, nome: 'Terça-feira',   curto: 'Ter' },
  { valor: 3, nome: 'Quarta-feira',  curto: 'Qua' },
  { valor: 4, nome: 'Quinta-feira',  curto: 'Qui' },
  { valor: 5, nome: 'Sexta-feira',   curto: 'Sex' },
  { valor: 6, nome: 'Sábado',        curto: 'Sáb' },
] as const

export function nomeDoDia(dia: number | null | undefined): string | null {
  if (dia === null || dia === undefined) return null
  return DIAS_SEMANA.find((d) => d.valor === dia)?.nome ?? null
}

/** Nome do dia da semana de uma data (aceita Date ou "DD/MM/AAAA"). */
export function nomeDoDiaDaData(data: Date | string): string | null {
  const d = typeof data === 'string' ? dataBrParaDate(data) : data
  if (!d || isNaN(d.getTime())) return null
  return DIAS_SEMANA[d.getDay()].nome
}

/** "DD/MM/AAAA" → Date local (ou null se incompleta/inválida). */
export function dataBrParaDate(valor: string): Date | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(valor.trim())
  if (!m) return null
  const dia = Number(m[1]), mes = Number(m[2]), ano = Number(m[3])
  const d = new Date(ano, mes - 1, dia)
  // Rejeita datas que "transbordam" (ex: 31/02 vira 03/03)
  if (d.getDate() !== dia || d.getMonth() !== mes - 1 || d.getFullYear() !== ano) return null
  return d
}

export function dateParaDataBr(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`
}

/**
 * Próxima ocorrência do dia da semana informado, a partir de hoje.
 * Se hoje já é o dia, sugere hoje — a menos que o horário já tenha passado,
 * caso em que pula para a semana seguinte.
 */
export function proximaData(
  diaSemana: number,
  horario?: string | null,
  agora: Date = new Date()
): Date {
  const alvo = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate())
  let delta = (diaSemana - alvo.getDay() + 7) % 7

  if (delta === 0 && horario) {
    const [h, min] = horario.split(':').map(Number)
    if (!isNaN(h)) {
      const limite = new Date(alvo)
      limite.setHours(h, isNaN(min) ? 0 : min, 0, 0)
      if (agora.getTime() > limite.getTime()) delta = 7
    }
  }

  alvo.setDate(alvo.getDate() + delta)
  return alvo
}

/** Normaliza "19h", "19:30", "1930" → "19:30". Retorna '' se não der. */
export function normalizarHorario(valor: string | null | undefined): string {
  if (!valor) return ''
  const m = /^(\d{1,2})\D?(\d{2})?/.exec(valor.trim())
  if (!m) return ''
  const h = Number(m[1])
  const min = m[2] ? Number(m[2]) : 0
  if (h > 23 || min > 59) return ''
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}
