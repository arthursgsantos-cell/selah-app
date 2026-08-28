'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { calcularValorInscricao, type ValorEvento } from '@/lib/evento-cobranca'

export async function inscreverEventoAction(params: {
  eventoId: string
  formularioId: string | null
  nome: string
  telefone?: string
  dados: Record<string, string>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  // Verifica inscrição duplicada
  const { data: existente } = await supabase
    .from('inscricoes_evento')
    .select('id')
    .eq('evento_id', params.eventoId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existente) return { ok: false, erro: 'Você já está inscrito neste evento.' }

  // Congela o valor devido conforme as respostas do formulário. Guardar aqui
  // evita que uma mudança futura na tabela de preços altere quem já se inscreveu.
  const admin = createAdminClient()
  const { data: valoresData } = await admin
    .from('evento_valores')
    .select('id, nome, valor, campo_id, opcao, ordem')
    .eq('evento_id', params.eventoId)
    .order('ordem')

  const valores = (valoresData ?? []) as ValorEvento[]
  const valorTotal = valores.length > 0 ? calcularValorInscricao(valores, params.dados) : null

  const { error } = await supabase
    .from('inscricoes_evento')
    .insert({
      evento_id: params.eventoId,
      formulario_id: params.formularioId,
      user_id: user.id,
      nome: params.nome,
      telefone: params.telefone ?? null,
      dados: params.dados,
      valor_total: valorTotal,
    })

  if (error) return { ok: false, erro: error.message }
  revalidatePath('/home')
  revalidatePath('/eventos')
  return { ok: true }
}

export async function cancelarInscricaoAction(inscricaoId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { error } = await supabase
    .from('inscricoes_evento')
    .update({ status: 'cancelado' })
    .eq('id', inscricaoId)
    .eq('user_id', user.id)

  if (error) throw new Error(error.message)
  revalidatePath('/home')
}


export async function atualizarStatusInscricaoAction(
  id: string,
  status: 'pendente' | 'confirmado' | 'cancelado'
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const admin = createAdminClient()
  const { error } = await admin
    .from('inscricoes_evento')
    .update({ status })
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/inscricoes')
}

export async function buscarMinhaInscricaoAction(eventoId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('inscricoes_evento')
    .select('id, status')
    .eq('evento_id', eventoId)
    .eq('user_id', user.id)
    .neq('status', 'cancelado')
    .maybeSingle()

  return data
}
