'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { FuncaoEscala } from '@/lib/supabase/types'

export async function createEncontroAction(celulaId: string, dataHora: string, local?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { data, error } = await supabase
    .from('encontros')
    .insert({ celula_id: celulaId, data_hora: dataHora, local: local || null, status: 'agendado', created_by: user.id })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  revalidatePath('/celula')
  redirect(`/encontro/${data.id}`)
}

export async function updateEncontroAction(
  id: string,
  data: { local?: string; avisos?: string; data_hora?: string; edificacao_resumo?: string }
) {
  const supabase = await createClient()
  const { error } = await supabase.from('encontros').update(data).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath(`/encontro/${id}`)
}

export async function upsertEscalaAction(
  encontroId: string,
  funcao: FuncaoEscala,
  responsavelId: string | null
) {
  const supabase = await createClient()

  if (responsavelId === null) {
    await supabase.from('escalas').delete().eq('encontro_id', encontroId).eq('funcao', funcao)
  } else {
    await supabase.from('escalas').upsert(
      { encontro_id: encontroId, funcao, responsavel_id: responsavelId },
      { onConflict: 'encontro_id,funcao' }
    )
  }
  revalidatePath(`/encontro/${encontroId}`)
}

export async function addLancheAction(encontroId: string, emoji: string, item: string, ordem: number) {
  const supabase = await createClient()
  const { error } = await supabase.from('lanches').insert({ encontro_id: encontroId, emoji: emoji || null, item, ordem })
  if (error) throw new Error(error.message)
  revalidatePath(`/encontro/${encontroId}`)
}

export async function deleteLancheAction(id: string, encontroId: string) {
  const supabase = await createClient()
  await supabase.from('lanches').delete().eq('id', id)
  revalidatePath(`/encontro/${encontroId}`)
}

export async function marcarLancheAction(id: string, encontroId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { data: profile } = await supabase
    .from('profiles').select('nome').eq('id', user.id).single()

  await supabase.from('lanches').update({
    responsavel_id: user.id,
    responsavel: profile?.nome ?? 'Você',
  }).eq('id', id)

  revalidatePath(`/encontro/${encontroId}`)
}

export async function desmarcarLancheAction(id: string, encontroId: string) {
  const supabase = await createClient()
  await supabase.from('lanches').update({ responsavel_id: null, responsavel: null }).eq('id', id)
  revalidatePath(`/encontro/${encontroId}`)
}
