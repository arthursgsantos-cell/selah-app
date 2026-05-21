'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

async function getCallerPastor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, igreja_id')
    .eq('id', user.id)
    .single()
  if (!profile || !['pastor', 'admin'].includes(profile.role)) throw new Error('Sem permissão')
  return { user, profile }
}

export async function uploadFotoComunidadeAction(
  formData: FormData
): Promise<{ id: string; url: string }> {
  const { user, profile } = await getCallerPastor()

  const file = formData.get('file') as File
  if (!file) throw new Error('Arquivo não encontrado')

  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${profile.igreja_id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const arrayBuffer = await file.arrayBuffer()

  const admin = createAdminClient()
  const { error: uploadError } = await admin.storage
    .from('fotos-comunidade')
    .upload(path, arrayBuffer, { upsert: false, contentType: file.type })
  if (uploadError) throw new Error(uploadError.message)

  const { data: { publicUrl } } = admin.storage.from('fotos-comunidade').getPublicUrl(path)

  const { data: inserted, error: dbError } = await admin
    .from('fotos_comunidade')
    .insert({ igreja_id: profile.igreja_id, url: publicUrl, criado_por: user.id })
    .select('id')
    .single()
  if (dbError) throw new Error(dbError.message)

  revalidatePath('/home')
  revalidatePath('/pastor')

  return { id: inserted.id, url: publicUrl }
}

export async function uploadFotoCelulaAction(
  celulaId: string,
  formData: FormData
): Promise<{ id: string; url: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, igreja_id')
    .eq('id', user.id)
    .single()
  if (!profile) throw new Error('Sem permissão')

  const isSuperior = ['pastor', 'admin', 'supervisor', 'supervisor_treinamento'].includes(profile.role)
  if (!isSuperior) {
    const { data: membro } = await supabase
      .from('celula_membros')
      .select('papel')
      .eq('celula_id', celulaId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!membro || membro.papel !== 'lider') throw new Error('Sem permissão')
  }

  const file = formData.get('file') as File
  if (!file) throw new Error('Arquivo não encontrado')

  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `celula-${celulaId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const arrayBuffer = await file.arrayBuffer()

  const admin = createAdminClient()
  const { error: uploadError } = await admin.storage
    .from('fotos-comunidade')
    .upload(path, arrayBuffer, { upsert: false, contentType: file.type })
  if (uploadError) throw new Error(uploadError.message)

  const { data: { publicUrl } } = admin.storage.from('fotos-comunidade').getPublicUrl(path)

  const { data: inserted, error: dbError } = await admin
    .from('fotos_comunidade')
    .insert({ igreja_id: profile.igreja_id, celula_id: celulaId, url: publicUrl, criado_por: user.id })
    .select('id')
    .single()
  if (dbError) throw new Error(dbError.message)

  revalidatePath('/home')
  revalidatePath(`/celula/${celulaId}`)

  return { id: inserted.id, url: publicUrl }
}

export async function deleteFotoCelulaAction(id: string, url: string): Promise<void> {
  await getCallerPastor()
  const admin = createAdminClient()
  try {
    const urlObj = new URL(url)
    const marker = '/fotos-comunidade/'
    const idx = urlObj.pathname.indexOf(marker)
    if (idx !== -1) {
      await admin.storage.from('fotos-comunidade').remove([urlObj.pathname.slice(idx + marker.length)])
    }
  } catch { /* ignore */ }
  await admin.from('fotos_comunidade').delete().eq('id', id)
  revalidatePath('/home')
}

export async function deleteFotoComunidadeAction(id: string, url: string): Promise<void> {
  await getCallerPastor()

  const admin = createAdminClient()

  // Extract storage path from public URL
  try {
    const urlObj = new URL(url)
    const marker = '/fotos-comunidade/'
    const idx = urlObj.pathname.indexOf(marker)
    if (idx !== -1) {
      const storagePath = urlObj.pathname.slice(idx + marker.length)
      await admin.storage.from('fotos-comunidade').remove([storagePath])
    }
  } catch {
    // ignore storage deletion errors — DB record still gets removed
  }

  await admin.from('fotos_comunidade').delete().eq('id', id)

  revalidatePath('/home')
  revalidatePath('/pastor')
}
