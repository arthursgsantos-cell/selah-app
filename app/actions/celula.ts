'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { Frequencia, PapelCelula } from '@/lib/supabase/types'

export async function createCelulaAction(data: {
  nome: string
  descricao?: string
  rede_id: string
  frequencia?: Frequencia
  local_padrao?: string
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { data: celula, error } = await supabase
    .from('celulas')
    .insert({
      nome: data.nome,
      descricao: data.descricao ?? null,
      rede_id: data.rede_id,
      frequencia: data.frequencia ?? 'semanal',
      local_padrao: data.local_padrao ?? null,
      ativa: true,
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  revalidatePath('/supervisor')
  redirect(`/celula/${celula.id}`)
}

export async function addMembroCelulaAction(
  celulaId: string,
  userId: string,
  papel: PapelCelula
) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('celula_membros')
    .upsert({ celula_id: celulaId, user_id: userId, papel }, { onConflict: 'celula_id,user_id' })
  if (error) throw new Error(error.message)
  revalidatePath(`/celula/${celulaId}`)
  revalidatePath('/supervisor')
}

export async function removeMembroCelulaAction(celulaId: string, userId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('celula_membros')
    .delete()
    .eq('celula_id', celulaId)
    .eq('user_id', userId)
  if (error) throw new Error(error.message)
  revalidatePath(`/celula/${celulaId}`)
  revalidatePath('/supervisor')
}
