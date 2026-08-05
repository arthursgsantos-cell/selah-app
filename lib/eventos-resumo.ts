/**
 * Consolidado de inscrições e pagamentos de um evento.
 *
 * Existe porque três telas precisam do mesmo número: o card na lista de
 * eventos, o topo da página de acompanhamento e — quando a cobrança está
 * ligada — a conferência do tesoureiro. Calculado num lugar só, os três
 * concordam.
 */

import { createAdminClient } from '@/lib/supabase/admin'

export interface ResumoEvento {
  total: number
  confirmados: number
  pendentes: number
  cancelados: number
  /** Soma dos valores congelados nas inscrições ativas. */
  valorPrevisto: number
  valorPago: number
  /** Nunca negativo: pagamento a mais não vira saldo devedor. */
  saldo: number
  /** 0–100. `null` quando o evento não cobra nada. */
  percentualPago: number | null
}

const VAZIO: ResumoEvento = {
  total: 0, confirmados: 0, pendentes: 0, cancelados: 0,
  valorPrevisto: 0, valorPago: 0, saldo: 0, percentualPago: null,
}

/**
 * Resumo de vários eventos de uma vez.
 *
 * Vai pelo cliente admin: a RLS de `inscricoes_evento` limita o que cada
 * pessoa enxerga, e quem chama já conferiu o cargo antes de exibir.
 */
export async function resumosDeEventos(
  eventoIds: string[]
): Promise<Record<string, ResumoEvento>> {
  const resumos: Record<string, ResumoEvento> = {}
  for (const id of eventoIds) resumos[id] = { ...VAZIO }
  if (eventoIds.length === 0) return resumos

  const admin = createAdminClient()

  const { data: inscricoes } = await admin
    .from('inscricoes_evento')
    .select('id, evento_id, status, valor_total')
    .in('evento_id', eventoIds)

  const linhas = (inscricoes ?? []) as {
    id: string; evento_id: string; status: string; valor_total: number | null
  }[]

  // Mapa inscrição → evento, para distribuir os pagamentos depois.
  const eventoDaInscricao = new Map<string, string>()

  for (const i of linhas) {
    const r = resumos[i.evento_id]
    if (!r) continue
    eventoDaInscricao.set(i.id, i.evento_id)

    r.total += 1
    if (i.status === 'confirmado') r.confirmados += 1
    else if (i.status === 'pendente') r.pendentes += 1
    else if (i.status === 'cancelado') r.cancelados += 1

    // Cancelada não entra na previsão: o dinheiro dela não é esperado.
    if (i.status !== 'cancelado') r.valorPrevisto += i.valor_total ?? 0
  }

  const ids = [...eventoDaInscricao.keys()]
  if (ids.length > 0) {
    const { data: pagamentos } = await admin
      .from('inscricao_pagamentos')
      .select('inscricao_id, valor')
      .in('inscricao_id', ids)

    for (const p of (pagamentos ?? []) as { inscricao_id: string; valor: number }[]) {
      const eventoId = eventoDaInscricao.get(p.inscricao_id)
      if (!eventoId) continue
      const r = resumos[eventoId]
      if (r) r.valorPago += p.valor ?? 0
    }
  }

  for (const r of Object.values(resumos)) {
    r.saldo = Math.max(0, r.valorPrevisto - r.valorPago)
    r.percentualPago =
      r.valorPrevisto > 0 ? Math.round((r.valorPago / r.valorPrevisto) * 100) : null
  }

  return resumos
}

/** Atalho para uma única página de evento. */
export async function resumoDoEvento(eventoId: string): Promise<ResumoEvento> {
  const resumos = await resumosDeEventos([eventoId])
  return resumos[eventoId] ?? { ...VAZIO }
}

/** Cargos que enxergam inscrições e pagamentos. */
export const CARGOS_ACOMPANHAMENTO = [
  'pastor', 'admin', 'supervisor', 'supervisor_treinamento', 'lider',
]

/** Se o evento recebe inscrições pelo app — as únicas que o app acompanha. */
export function acompanhaInscricoes(tipoInscricao: string | null | undefined): boolean {
  return tipoInscricao === 'formulario' || tipoInscricao === 'pix'
}
