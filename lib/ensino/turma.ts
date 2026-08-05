/**
 * Formatação e contas das turmas.
 *
 * Está separado das telas porque a mesma frase ("Terças e quintas · 19h30")
 * aparece no card da listagem, no cabeçalho da turma e no painel do professor;
 * quando muda, muda em um lugar só.
 */

import { DIAS_SEMANA } from '@/lib/dia-semana'
import type { StatusAula, StatusInscricaoEnsino, StatusTurma } from '@/lib/supabase/types'

/** "Terças e quintas", "Segundas, quartas e sextas", "" quando não há dias. */
export function diasSemanaTexto(dias: number[] | null | undefined): string {
  if (!dias || dias.length === 0) return ''

  const nomes = [...dias]
    .sort((a, b) => a - b)
    .map((d) => {
      const nome = DIAS_SEMANA.find((x) => x.valor === d)?.nome
      if (!nome) return null
      // "Segunda-feira" → "Segundas"; "Sábado" → "Sábados"
      return nome.endsWith('-feira') ? nome.replace('-feira', 's') : `${nome}s`
    })
    .filter((n): n is string => n !== null)

  if (nomes.length === 0) return ''
  if (nomes.length === 1) return nomes[0]
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`
}

/** "19h30", "19h30 às 21h", "" — o formato usado no resto do app. */
export function horarioTexto(
  inicio: string | null | undefined,
  fim?: string | null
): string {
  const fmt = (h: string) => {
    const [hora, min] = h.split(':')
    return min && min !== '00' ? `${Number(hora)}h${min}` : `${Number(hora)}h`
  }
  if (!inicio) return ''
  return fim ? `${fmt(inicio)} às ${fmt(fim)}` : fmt(inicio)
}

/** "Terças · 19h30" — dias e horário numa linha só. */
export function encontrosTexto(
  dias: number[] | null | undefined,
  inicio: string | null | undefined,
  fim?: string | null
): string {
  return [diasSemanaTexto(dias), horarioTexto(inicio, fim)].filter(Boolean).join(' · ')
}

/**
 * "10/03 a 26/05", "a partir de 10/03", "" — sem `date-fns` porque as datas
 * vêm como "AAAA-MM-DD" e criar um `Date` a partir disso reintroduziria o
 * problema de fuso que o tipo `date` justamente evita.
 */
export function periodoTexto(inicio: string | null, fim: string | null): string {
  const br = (iso: string) => {
    const [ano, mes, dia] = iso.split('-')
    return `${dia}/${mes}/${ano.slice(2)}`
  }
  if (inicio && fim) return `${br(inicio)} a ${br(fim)}`
  if (inicio) return `a partir de ${br(inicio)}`
  if (fim) return `até ${br(fim)}`
  return ''
}

/** "AAAA-MM-DD" → "10/03/2026". */
export function dataBr(iso: string): string {
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}

/** Vagas que sobraram. `null` quando a turma não tem limite. */
export function vagasRestantes(
  vagas: number | null,
  aprovados: number
): number | null {
  if (vagas === null || vagas === undefined) return null
  return Math.max(0, vagas - aprovados)
}

/**
 * Se ainda dá para pedir inscrição. Pendentes não ocupam vaga — quem reserva é
 * a aprovação, senão um pedido esquecido bloquearia a turma para sempre.
 */
export function inscricoesDisponiveis(turma: {
  status: StatusTurma
  inscricoes_abertas: boolean
  vagas: number | null
}, aprovados: number): boolean {
  if (!turma.inscricoes_abertas) return false
  if (turma.status === 'concluida' || turma.status === 'cancelada') return false
  const restantes = vagasRestantes(turma.vagas, aprovados)
  return restantes === null || restantes > 0
}

export const STATUS_TURMA: Record<StatusTurma, { label: string; classe: string }> = {
  aberta:       { label: 'Inscrições abertas', classe: 'bg-green-100 text-green-700' },
  em_andamento: { label: 'Em andamento',       classe: 'bg-blue-100 text-blue-700'   },
  concluida:    { label: 'Concluída',          classe: 'bg-gray-100 text-gray-600'   },
  cancelada:    { label: 'Cancelada',          classe: 'bg-red-100 text-red-700'     },
}

export const STATUS_INSCRICAO: Record<
  StatusInscricaoEnsino,
  { label: string; classe: string }
> = {
  pendente:  { label: 'Aguardando aprovação', classe: 'bg-amber-100 text-amber-700' },
  aprovada:  { label: 'Aprovada',             classe: 'bg-green-100 text-green-700' },
  recusada:  { label: 'Recusada',             classe: 'bg-red-100 text-red-700'     },
  cancelada: { label: 'Cancelada',            classe: 'bg-gray-100 text-gray-600'   },
  concluida: { label: 'Concluída',            classe: 'bg-blue-100 text-blue-700'   },
}

export const STATUS_AULA: Record<StatusAula, { label: string; classe: string }> = {
  agendada:  { label: 'Agendada',  classe: 'bg-blue-100 text-blue-700'  },
  realizada: { label: 'Realizada', classe: 'bg-green-100 text-green-700' },
  cancelada: { label: 'Cancelada', classe: 'bg-red-100 text-red-700'     },
}

/**
 * Percentual de presença. Considera só as aulas já realizadas: contar as
 * futuras faria todo aluno começar o curso com 0% de frequência.
 */
export function percentualPresenca(presencas: { presente: boolean }[]): number | null {
  if (presencas.length === 0) return null
  const presentes = presencas.filter((p) => p.presente).length
  return Math.round((presentes / presencas.length) * 100)
}

/** Verde acima de 75%, âmbar acima de 50%, vermelho abaixo. */
export function corFrequencia(percentual: number | null): string {
  if (percentual === null) return 'text-muted-foreground'
  if (percentual >= 75) return 'text-green-600'
  if (percentual >= 50) return 'text-amber-600'
  return 'text-red-600'
}
