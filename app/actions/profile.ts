'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import type { Role } from '@/lib/supabase/types'

async function getCallerPastor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { data: caller } = await supabase
    .from('profiles')
    .select('role, igreja_id')
    .eq('id', user.id)
    .single()

  if (!caller || (caller.role !== 'pastor' && caller.role !== 'admin'))
    throw new Error('Sem permissão')

  return { supabase, caller }
}

export async function updateUserRoleAction(userId: string, novoRole: Role) {
  const { supabase, caller } = await getCallerPastor()

  const { data: target } = await supabase
    .from('profiles')
    .select('role, igreja_id')
    .eq('id', userId)
    .single()

  if (!target || target.igreja_id !== caller.igreja_id)
    throw new Error('Usuário não encontrado')

  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({ role: novoRole, updated_at: new Date().toISOString() })
    .eq('id', userId)

  if (error) throw new Error(error.message)
  revalidatePath('/usuarios')
  // O cartão da liderança na home lê `titulo`: sem invalidar, o novo título só
  // apareceria na próxima vez que a página fosse gerada.
  revalidatePath('/home')
}

export async function addMembroCelulaAction(
  userId: string,
  celulaId: string,
  papel: 'lider' | 'membro'
) {
  const { supabase } = await getCallerPastor()

  const { error } = await supabase
    .from('celula_membros')
    .upsert({ celula_id: celulaId, user_id: userId, papel }, { onConflict: 'celula_id,user_id' })

  if (error) throw new Error(error.message)
  revalidatePath('/usuarios')
}

export async function removeMembroCelulaAction(userId: string, celulaId: string) {
  const { supabase } = await getCallerPastor()

  const { error } = await supabase
    .from('celula_membros')
    .delete()
    .eq('celula_id', celulaId)
    .eq('user_id', userId)

  if (error) throw new Error(error.message)
  revalidatePath('/usuarios')
}

export async function addSupervisorRedeAction(userId: string, redeId: string) {
  const { supabase } = await getCallerPastor()

  const { error } = await supabase
    .from('rede_supervisores')
    .upsert({ rede_id: redeId, supervisor_id: userId }, { onConflict: 'rede_id,supervisor_id' })

  if (error) throw new Error(error.message)
  revalidatePath('/usuarios')
}

export async function removeSupervisorRedeAction(userId: string, redeId: string) {
  const { supabase } = await getCallerPastor()

  const { error } = await supabase
    .from('rede_supervisores')
    .delete()
    .eq('rede_id', redeId)
    .eq('supervisor_id', userId)

  if (error) throw new Error(error.message)
  revalidatePath('/usuarios')
}

export async function updateUserProfileAdminAction(
  userId: string,
  data: {
    nome: string
    /** Título que aparece no cartão da liderança na home ("Pastor Titular"). */
    titulo?: string | null
    telefone?: string | null
    data_nascimento_1?: string | null
    data_nascimento_2?: string | null
    data_casamento?: string | null
    endereco?: string | null
    endereco_maps?: string | null
  }
) {
  const { supabase, caller } = await getCallerPastor()

  const { data: target } = await supabase
    .from('profiles')
    .select('igreja_id')
    .eq('id', userId)
    .single()

  if (!target || target.igreja_id !== caller.igreja_id)
    throw new Error('Usuário não encontrado')

  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({
      nome: data.nome.trim(),
      titulo: data.titulo?.trim() || null,
      telefone: data.telefone?.trim() || null,
      data_nascimento_1: data.data_nascimento_1 || null,
      data_nascimento_2: data.data_nascimento_2 || null,
      data_casamento: data.data_casamento || null,
      endereco: data.endereco?.trim() || null,
      endereco_maps: data.endereco_maps?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)

  if (error) throw new Error(error.message)
  revalidatePath('/usuarios')
}
