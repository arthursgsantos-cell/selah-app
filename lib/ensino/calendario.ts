/**
 * As datas das aulas de uma turma.
 *
 * Datas em "AAAA-MM-DD" são tratadas como calendário puro: `new Date('2026-03-10')`
 * seria meia-noite UTC, que em Natal ainda é o dia 9. Por isso tudo aqui monta
 * `Date` local com ano, mês e dia separados.
 *
 * Saiu de dentro de `gerarAulasAction` quando a cópia de turma passou a precisar
 * das mesmas datas: as aulas vêm da turma anterior, mas o calendário é o da
 * turma nova.
 */

/** Teto de varredura: dois anos de dias, para nunca virar laço infinito. */
const DIAS_MAXIMOS = 730

function partes(iso: string): [number, number, number] {
  const [ano, mes, dia] = iso.split('-').map(Number)
  return [ano, mes, dia]
}

function deIso(iso: string): Date {
  const [ano, mes, dia] = partes(iso)
  return new Date(ano, mes - 1, dia)
}

export function paraIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Hoje em "AAAA-MM-DD", pelo calendário local — não pelo UTC. */
export function hojeIso(): string {
  return paraIso(new Date())
}

export interface CalendarioTurma {
  dataInicio: string | null
  dataFim: string | null
  diasSemana: number[] | null
}

/**
 * As próximas `quantidade` datas que caem nos dias da semana da turma.
 *
 * `depoisDe` continua um calendário já começado: a varredura arranca no dia
 * seguinte à data informada, em vez do início da turma. Devolve menos datas que
 * o pedido — ou nenhuma — quando o período acaba antes; quem chama decide o que
 * fazer com a falta.
 */
export function datasNoCalendario(
  turma: CalendarioTurma,
  quantidade: number,
  depoisDe?: string | null
): string[] {
  if (quantidade <= 0) return []
  if (!turma.dataInicio || !turma.diasSemana?.length) return []

  const cursor = deIso(depoisDe ?? turma.dataInicio)
  if (depoisDe) cursor.setDate(cursor.getDate() + 1)

  const limite = turma.dataFim ? deIso(turma.dataFim) : null
  const dias = new Set(turma.diasSemana)
  const datas: string[] = []

  for (let i = 0; i < DIAS_MAXIMOS && datas.length < quantidade; i++) {
    if (limite && cursor > limite) break
    if (dias.has(cursor.getDay())) datas.push(paraIso(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }

  return datas
}
