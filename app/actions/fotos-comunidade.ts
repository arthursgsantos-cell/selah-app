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

/**
 * Fotos tiradas no dia do encontro.
 *
 * Diferente da galeria da célula (restrita a líder), aqui qualquer membro pode
 * publicar — foi quem esteve lá e tirou as fotos.
 */
export async function uploadFotoEncontroAction(
  encontroId: string,
  formData: FormData
): Promise<{ id: string; url: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { data: profile } = await supabase
    .from('profiles').select('role, igreja_id').eq('id', user.id).single()
  if (!profile) throw new Error('Sem permissão')

  const admin = createAdminClient()
  const { data: encontro } = await admin
    .from('encontros').select('celula_id').eq('id', encontroId).single()
  if (!encontro) throw new Error('Encontro não encontrado')

  const isSuperior = ['pastor', 'admin', 'supervisor', 'supervisor_treinamento'].includes(profile.role)
  if (!isSuperior) {
    const { data: membro } = await supabase
      .from('celula_membros')
      .select('user_id')
      .eq('celula_id', encontro.celula_id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!membro) throw new Error('Só quem é da célula pode publicar fotos do encontro.')
  }

  const file = formData.get('file') as File
  if (!file) throw new Error('Arquivo não encontrado')

  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `encontro-${encontroId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const arrayBuffer = await file.arrayBuffer()

  const { error: uploadError } = await admin.storage
    .from('fotos-comunidade')
    .upload(path, arrayBuffer, { upsert: false, contentType: file.type })
  if (uploadError) throw new Error(uploadError.message)

  const { data: { publicUrl } } = admin.storage.from('fotos-comunidade').getPublicUrl(path)

  const { data: inserted, error: dbError } = await admin
    .from('fotos_comunidade')
    .insert({
      igreja_id: profile.igreja_id,
      celula_id: encontro.celula_id,
      encontro_id: encontroId,
      url: publicUrl,
      criado_por: user.id,
    })
    .select('id')
    .single()
  if (dbError) throw new Error(dbError.message)

  revalidatePath(`/encontro/${encontroId}`)
  revalidatePath(`/celula/${encontro.celula_id}`)

  return { id: inserted.id, url: publicUrl }
}

/** Só quem publicou, o líder da célula ou pastor/admin podem apagar. */
export async function deleteFotoEncontroAction(id: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const admin = createAdminClient()
  const { data: foto } = await admin
    .from('fotos_comunidade')
    .select('url, criado_por, celula_id, encontro_id')
    .eq('id', id)
    .single()
  if (!foto) throw new Error('Foto não encontrada')

  if (foto.criado_por !== user.id) {
    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    const isSuperior = ['pastor', 'admin', 'supervisor', 'supervisor_treinamento']
      .includes(profile?.role ?? '')

    if (!isSuperior) {
      // Sem célula na foto não há líder a consultar: só autor ou liderança apagam.
      if (!foto.celula_id) throw new Error('Sem permissão para apagar esta foto.')

      const { data: membro } = await supabase
        .from('celula_membros')
        .select('papel')
        .eq('celula_id', foto.celula_id)
        .eq('user_id', user.id)
        .maybeSingle()
      if (membro?.papel !== 'lider') throw new Error('Sem permissão para apagar esta foto.')
    }
  }

  try {
    const urlObj = new URL(foto.url)
    const marker = '/fotos-comunidade/'
    const idx = urlObj.pathname.indexOf(marker)
    if (idx !== -1) {
      await admin.storage.from('fotos-comunidade').remove([urlObj.pathname.slice(idx + marker.length)])
    }
  } catch { /* se o arquivo já sumiu, seguimos e limpamos o registro */ }

  await admin.from('fotos_comunidade').delete().eq('id', id)

  if (foto.encontro_id) revalidatePath(`/encontro/${foto.encontro_id}`)
  revalidatePath(`/celula/${foto.celula_id}`)
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
