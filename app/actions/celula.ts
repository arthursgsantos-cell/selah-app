'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
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

export async function uploadLogoCelulaAction(celulaId: string, formData: FormData): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { data: membro } = await supabase
    .from('celula_membros').select('papel').eq('celula_id', celulaId).eq('user_id', user.id).maybeSingle()
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()

  const canUpload = !!membro || ['admin', 'pastor', 'supervisor'].includes(profile?.role ?? '')
  if (!canUpload) throw new Error('Sem permissão')

  const file = formData.get('file') as File
  if (!file) throw new Error('Arquivo não encontrado')

  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${celulaId}.${ext}`
  const arrayBuffer = await file.arrayBuffer()

  const admin = createAdminClient()
  const { error } = await admin.storage
    .from('celula-logos')
    .upload(path, arrayBuffer, { contentType: file.type, upsert: true })
  if (error) throw new Error(error.message)

  const { data } = admin.storage.from('celula-logos').getPublicUrl(path)
  const url = `${data.publicUrl}?t=${Date.now()}`

  await admin.from('celulas').update({ logo_url: url }).eq('id', celulaId)

  revalidatePath('/celula')
  revalidatePath(`/celula/${celulaId}`)
  revalidatePath('/supervisor')

  return url
}

export async function editCelulaAction(data: {
  id: string
  nome: string
  descricao?: string | null
  local_padrao?: string | null
  cor?: string | null
  frequencia: Frequencia
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAdminRole = ['admin', 'pastor', 'supervisor', 'supervisor_treinamento'].includes(profile?.role ?? '')

  if (!isAdminRole) {
    const { data: membro } = await supabase
      .from('celula_membros')
      .select('papel')
      .eq('celula_id', data.id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (membro?.papel !== 'lider') throw new Error('Sem permissão')
  }

  const { error } = await supabase
    .from('celulas')
    .update({
      nome: data.nome,
      descricao: data.descricao ?? null,
      local_padrao: data.local_padrao ?? null,
      cor: data.cor ?? null,
      frequencia: data.frequencia,
    })
    .eq('id', data.id)

  if (error) throw new Error(error.message)
  revalidatePath('/celula')
  revalidatePath(`/celula/${data.id}`)
  revalidatePath('/supervisor')
}

export async function deleteCelulaAction(celulaId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const canDelete = ['admin', 'pastor', 'supervisor', 'supervisor_treinamento'].includes(profile?.role ?? '')
  if (!canDelete) throw new Error('Sem permissão')

  const { error } = await supabase.from('celulas').delete().eq('id', celulaId)
  if (error) throw new Error(error.message)
  revalidatePath('/supervisor')
  redirect('/supervisor')
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
