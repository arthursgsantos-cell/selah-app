'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export type SolicitacaoData = {
  nome: string
  telefone: string
  email: string
  idade: number | null
  estado_civil: string
  tem_filhos: boolean
  filhos_detalhes: string
  bairro: string
  tipo_membro: string
  melhor_dia: string
}

export async function solicitarCelulaAction(data: SolicitacaoData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const admin = createAdminClient()

  // Get igreja_id — from user profile if logged in, otherwise first church
  let igrejaId: string | null = null
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('igreja_id')
      .eq('id', user.id)
      .single()
    igrejaId = profile?.igreja_id ?? null
  }
  if (!igrejaId) {
    const { data: igreja } = await admin.from('igrejas').select('id').limit(1).single()
    igrejaId = igreja?.id ?? null
  }
  if (!igrejaId) throw new Error('Igreja não encontrada')

  const { error } = await admin.from('solicitacoes_celula').insert({
    ...data,
    user_id: user?.id ?? null,
    igreja_id: igrejaId,
  })

  if (error) throw new Error(error.message)

  // Sync telefone back to profile if not set yet
  if (user && data.telefone) {
    const { data: prof } = await supabase.from('profiles').select('telefone').eq('id', user.id).single()
    if (!(prof as any)?.telefone) {
      await admin.from('profiles').update({ telefone: data.telefone }).eq('id', user.id)
    }
  }

  revalidatePath('/pastor')
  revalidatePath('/supervisor')
}

export async function encaminharSolicitacaoAction(solicitacaoId: string, liderId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const canAssign = ['pastor', 'admin', 'supervisor', 'supervisor_treinamento'].includes(profile?.role ?? '')
  if (!canAssign) throw new Error('Sem permissão')

  const admin = createAdminClient()
  const { error } = await admin
    .from('solicitacoes_celula')
    .update({ status: 'encaminhado', lider_encaminhado_id: liderId })
    .eq('id', solicitacaoId)

  if (error) throw new Error(error.message)
  revalidatePath('/pastor')
  revalidatePath('/supervisor')
}

export async function marcarAtendidoAction(solicitacaoId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const admin = createAdminClient()
  const { error } = await admin
    .from('solicitacoes_celula')
    .update({ status: 'atendido' })
    .eq('id', solicitacaoId)

  if (error) throw new Error(error.message)
  revalidatePath('/pastor')
  revalidatePath('/supervisor')
}
