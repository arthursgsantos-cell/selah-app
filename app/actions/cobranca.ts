'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import type { ValorEvento, ParcelaEvento } from '@/lib/evento-cobranca'

const CARGOS_GESTAO = ['admin', 'pastor', 'supervisor', 'supervisor_treinamento', 'lider']

async function exigirGestao() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!CARGOS_GESTAO.includes(profile?.role ?? '')) throw new Error('Sem permissão')
  return user
}

/** Substitui a tabela de valores do evento. */
export async function salvarValoresEventoAction(
  eventoId: string,
  valores: { nome: string; valor: number; campo_id: string | null; opcao: string | null }[]
) {
  await exigirGestao()

  for (const v of valores) {
    if (!v.nome.trim()) throw new Error('Todo valor precisa de um nome.')
    if (!(v.valor >= 0)) throw new Error(`Valor inválido em "${v.nome}".`)
  }

  const admin = createAdminClient()
  const { error: erroDelete } = await admin.from('evento_valores').delete().eq('evento_id', eventoId)
  if (erroDelete) throw new Error(erroDelete.message)

  if (valores.length > 0) {
    const { error } = await admin.from('evento_valores').insert(
      valores.map((v, i) => ({
        evento_id: eventoId,
        nome: v.nome.trim(),
        valor: v.valor,
        campo_id: v.campo_id,
        opcao: v.opcao,
        ordem: i,
      })) as never
    )
    if (error) throw new Error(error.message)
  }

  revalidatePath(`/evento/${eventoId}`)
  revalidatePath(`/inscricoes/${eventoId}`)
}

/** Substitui o plano de parcelas do evento. */
export async function salvarParcelasEventoAction(
  eventoId: string,
  parcelas: { vencimento: string; percentual: number | null }[]
) {
  await exigirGestao()

  const soma = parcelas.reduce((acc, p) => acc + (p.percentual ?? 0), 0)
  const todasComPercentual = parcelas.length > 0 && parcelas.every((p) => p.percentual != null)
  if (todasComPercentual && Math.abs(soma - 100) > 0.01) {
    throw new Error(`Os percentuais somam ${soma}%. Precisa fechar em 100%.`)
  }

  const admin = createAdminClient()
  const { error: erroDelete } = await admin.from('evento_parcelas').delete().eq('evento_id', eventoId)
  if (erroDelete) throw new Error(erroDelete.message)

  if (parcelas.length > 0) {
    const { error } = await admin.from('evento_parcelas').insert(
      parcelas.map((p, i) => ({
        evento_id: eventoId,
        numero: i + 1,
        vencimento: p.vencimento,
        percentual: p.percentual,
      })) as never
    )
    if (error) throw new Error(error.message)
  }

  revalidatePath(`/evento/${eventoId}`)
  revalidatePath(`/inscricoes/${eventoId}`)
}

/** Tesoureiro lança um pagamento recebido. */
export async function registrarPagamentoAction(data: {
  inscricaoId: string
  eventoId: string
  valor: number
  pago_em: string
  metodo?: string | null
  observacao?: string | null
}) {
  const user = await exigirGestao()

  if (!(data.valor > 0)) throw new Error('O valor precisa ser maior que zero.')

  const admin = createAdminClient()
  const { error } = await admin.from('inscricao_pagamentos').insert({
    inscricao_id: data.inscricaoId,
    valor: data.valor,
    pago_em: data.pago_em,
    metodo: data.metodo ?? 'pix',
    observacao: data.observacao ?? null,
    registrado_por: user.id,
  } as never)
  if (error) throw new Error(error.message)

  revalidatePath(`/inscricoes/${data.eventoId}`)
  revalidatePath(`/inscricao/${data.eventoId}`)
}

export async function removerPagamentoAction(pagamentoId: string, eventoId: string) {
  await exigirGestao()

  const admin = createAdminClient()
  const { error } = await admin.from('inscricao_pagamentos').delete().eq('id', pagamentoId)
  if (error) throw new Error(error.message)

  revalidatePath(`/inscricoes/${eventoId}`)
  revalidatePath(`/inscricao/${eventoId}`)
}

export async function buscarCobrancaEventoAction(eventoId: string): Promise<{
  valores: ValorEvento[]
  parcelas: ParcelaEvento[]
}> {
  const admin = createAdminClient()
  const [{ data: valores }, { data: parcelas }] = await Promise.all([
    admin.from('evento_valores').select('id, nome, valor, campo_id, opcao, ordem').eq('evento_id', eventoId).order('ordem'),
    admin.from('evento_parcelas').select('id, numero, vencimento, percentual').eq('evento_id', eventoId).order('numero'),
  ])
  return {
    valores: (valores ?? []) as ValorEvento[],
    parcelas: (parcelas ?? []) as ParcelaEvento[],
  }
}
