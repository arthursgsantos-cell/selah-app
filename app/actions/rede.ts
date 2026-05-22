'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function createRedeAction(data: {
  nome: string
  descricao?: string
  cor?: string
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { data: profile } = await supabase
    .from('profiles')
    .select('igreja_id, role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'pastor' && profile.role !== 'admin')) throw new Error('Sem permissão')

  const { error } = await supabase.from('redes').insert({
    nome: data.nome,
    descricao: data.descricao ?? null,
    cor: data.cor ?? '#6366f1',
    igreja_id: profile.igreja_id,
  })

  if (error) throw new Error(error.message)
  revalidatePath('/pastor')
}

export async function uploadCapaRedeAction(redeId: string, formData: FormData): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'pastor', 'supervisor'].includes(profile?.role ?? '')) throw new Error('Sem permissão')

  const file = formData.get('file') as File
  if (!file) throw new Error('Arquivo não encontrado')

  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `capas/${redeId}.${ext}`
  const arrayBuffer = await file.arrayBuffer()

  const admin = createAdminClient()
  const { error } = await admin.storage.from('rede-logos').upload(path, arrayBuffer, { contentType: file.type, upsert: true })
  if (error) throw new Error(error.message)

  const { data } = admin.storage.from('rede-logos').getPublicUrl(path)
  const url = `${data.publicUrl}?t=${Date.now()}`

  await admin.from('redes').update({ capa_url: url }).eq('id', redeId)

  revalidatePath('/pastor')
  revalidatePath('/supervisor')
  revalidatePath(`/rede/${redeId}`)

  return url
}

export async function uploadLogoRedeAction(redeId: string, formData: FormData): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!['admin', 'pastor', 'supervisor'].includes(profile?.role ?? '')) throw new Error('Sem permissão')

  const file = formData.get('file') as File
  if (!file) throw new Error('Arquivo não encontrado')

  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${redeId}.${ext}`
  const arrayBuffer = await file.arrayBuffer()

  const admin = createAdminClient()
  const { error } = await admin.storage
    .from('rede-logos')
    .upload(path, arrayBuffer, { contentType: file.type, upsert: true })
  if (error) throw new Error(error.message)

  const { data } = admin.storage.from('rede-logos').getPublicUrl(path)
  const url = `${data.publicUrl}?t=${Date.now()}`

  await admin.from('redes').update({ logo_url: url }).eq('id', redeId)

  revalidatePath('/pastor')
  revalidatePath('/supervisor')

  return url
}
