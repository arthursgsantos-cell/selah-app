/**
 * Projeta as próximas datas de uma célula juntando duas fontes:
 * os encontros que já existem no banco e as datas que ainda vão acontecer
 * segundo a recorrência da célula (dia da semana + frequência).
 *
 * É isso que permite escalar alguém "de sobre aviso" para um dia que ainda
 * não virou encontro.
 */

import type { Frequencia, FuncaoEscala } from '@/lib/supabase/types'
import { dataLocalIso } from '@/lib/dia-semana'

/** Uma posição já escalada, seja num encontro existente ou de sobre aviso. */
export interface EscalaCalendario {
  data: string
  funcao: FuncaoEscala
  responsavel_id: string | null
  responsavel_nome: string | null
}

/** Formato cru vindo do banco (com o join opcional no encontro). */
export interface EscalaRowBanco {
  funcao: FuncaoEscala
  responsavel_id: string | null
  data_prevista: string | null
  encontro_id: string | null
  encontros: { data_hora: string } | null
}

/**
 * Normaliza as escalas do banco para o calendário: a data vem do encontro
 * quando a escala já está vinculada, e da data_prevista quando ainda não.
 */
export function montarEscalasCalendario(
  rows: EscalaRowBanco[],
  membros: { user_id: string; nome: string }[],
): EscalaCalendario[] {
  const saida: EscalaCalendario[] = []

  for (const e of rows) {
    const data = e.encontros?.data_hora ? dataLocalIso(e.encontros.data_hora) : e.data_prevista
    if (!data || !e.responsavel_id) continue

    saida.push({
      data,
      funcao: e.funcao,
      responsavel_id: e.responsavel_id,
      responsavel_nome: membros.find((m) => m.user_id === e.responsavel_id)?.nome ?? 'Membro',
    })
  }

  return saida
}

export interface DataCalendario {
  /** "AAAA-MM-DD" no fuso da igreja. */
  data: string
  /** Preenchido só quando o encontro daquele dia já foi criado. */
  encontroId: string | null
  local: string | null
  status: string | null
}

export interface EncontroExistente {
  id: string
  data_hora: string
  local: string | null
  status: string
}

const DIA_MS = 86_400_000

/** "AAAA-MM-DD" → Date local (evita o parse em UTC do construtor de string). */
export function isoParaDateLocal(iso: string): Date {
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(a, m - 1, d)
}

/**
 * Date → "AAAA-MM-DD" lendo os componentes direto, SEM converter fuso.
 *
 * Datas de calendário representam um dia no muro, não um instante. Passá-las
 * por conversão de fuso as desloca um dia (no servidor da Vercel, que roda em
 * UTC, meia-noite vira 21h do dia anterior em Brasília).
 */
function dateParaIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Data local (meia-noite) de um instante, no fuso da igreja. */
function inicioDoDia(instante: string): Date {
  return isoParaDateLocal(dataLocalIso(instante))
}

/**
 * Ajusta a primeira data para cair no mesmo ritmo quinzenal de uma âncora.
 * Sem isso, "quinzenal" seria ambíguo — não dá para saber quais semanas.
 */
function alinharQuinzenal(inicio: Date, ancora: Date): Date {
  const dias = Math.round((inicio.getTime() - ancora.getTime()) / DIA_MS)
  const resto = ((dias % 14) + 14) % 14
  if (resto === 0) return inicio
  const ajustada = new Date(inicio)
  ajustada.setDate(ajustada.getDate() + (14 - resto))
  return ajustada
}

/** Uma célula com o mínimo necessário para projetar o calendário dela. */
export interface CelulaParaCalendario {
  id: string
  nome: string
  dia_semana: number | null
  frequencia: Frequencia
  horario: string | null
}

/**
 * Agenda consolidada de várias células (visão do supervisor): as próximas datas
 * de cada célula, agrupadas por dia, já com quem está escalado.
 */
export function montarAgendaRede(
  celulas: CelulaParaCalendario[],
  encontros: (EncontroExistente & { celula_id: string })[],
  escalas: (EscalaRowBanco & { celula_id: string })[],
  nomePorUsuario: Map<string, string>,
  ocorrencias = 6,
) {
  const porDia = new Map<string, {
    data: string
    celulas: {
      celulaId: string
      celulaNome: string
      local: string | null
      encontroId: string | null
      escalas: { funcao: FuncaoEscala; responsavel_nome: string }[]
    }[]
  }>()

  for (const celula of celulas) {
    const dela = encontros.filter((e) => e.celula_id === celula.id)
    const datas = projetarDatasCelula(celula, dela, ocorrencias)

    const escalasDela = montarEscalasCalendario(
      escalas.filter((e) => e.celula_id === celula.id),
      [...nomePorUsuario].map(([user_id, nome]) => ({ user_id, nome })),
    )

    for (const d of datas) {
      if (!porDia.has(d.data)) porDia.set(d.data, { data: d.data, celulas: [] })
      porDia.get(d.data)!.celulas.push({
        celulaId: celula.id,
        celulaNome: celula.nome,
        local: d.local,
        encontroId: d.encontroId,
        escalas: escalasDela
          .filter((e) => e.data === d.data && e.responsavel_nome)
          .map((e) => ({ funcao: e.funcao, responsavel_nome: e.responsavel_nome! })),
      })
    }
  }

  return [...porDia.values()]
    .sort((a, b) => a.data.localeCompare(b.data))
    .map((d) => ({
      ...d,
      celulas: d.celulas.sort((a, b) => a.celulaNome.localeCompare(b.celulaNome)),
    }))
}

export function projetarDatasCelula(
  celula: {
    dia_semana: number | null
    frequencia: Frequencia
    horario: string | null
  },
  encontros: EncontroExistente[],
  ocorrencias = 10,
  agora: Date = new Date(),
): DataCalendario[] {
  const porData = new Map<string, DataCalendario>()

  // 1) Encontros já criados de hoje em diante entram sempre — inclusive os que
  //    fogem da recorrência (remarcados, extras).
  const hojeIso = dataLocalIso(agora)
  for (const e of encontros) {
    const iso = dataLocalIso(e.data_hora)
    if (iso < hojeIso || e.status === 'cancelado') continue
    porData.set(iso, { data: iso, encontroId: e.id, local: e.local, status: e.status })
  }

  // 2) Datas futuras segundo a recorrência, para escalar antes de existir encontro.
  if (celula.dia_semana !== null && celula.dia_semana !== undefined) {
    // Parte de "hoje em Brasília" e faz toda a conta em dias de calendário,
    // para o resultado não depender do fuso em que o servidor roda.
    const hoje = isoParaDateLocal(hojeIso)
    const cursor = new Date(hoje)
    cursor.setDate(cursor.getDate() + (((celula.dia_semana - hoje.getDay()) + 7) % 7))
    const passo = celula.frequencia === 'quinzenal' ? 14 : 7

    if (celula.frequencia === 'quinzenal') {
      // Âncora: o encontro mais recente da célula define quais semanas "contam".
      const datas = encontros
        .filter((e) => e.status !== 'cancelado')
        .map((e) => inicioDoDia(e.data_hora))
        .sort((a, b) => b.getTime() - a.getTime())
      if (datas.length > 0) {
        const alinhada = alinharQuinzenal(cursor, datas[0])
        cursor.setTime(alinhada.getTime())
      }
    }

    for (let i = 0; i < ocorrencias; i++) {
      const iso = dateParaIso(cursor)
      if (!porData.has(iso)) {
        porData.set(iso, { data: iso, encontroId: null, local: null, status: null })
      }
      cursor.setDate(cursor.getDate() + passo)
    }
  }

  return [...porData.values()].sort((a, b) => a.data.localeCompare(b.data))
}
