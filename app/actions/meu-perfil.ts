'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function signOutAction() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

async function getCallerUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')
  return user
}

export async function updateMeuPerfilAction(data: {
  nome: string
  titulo?: string | null
  telefone?: string | null
  data_nascimento_1?: string | null
  data_nascimento_2?: string | null
  data_casamento?: string | null
  endereco?: string | null
  endereco_maps?: string | null
}) {
  const user = await getCallerUser()
  const admin = createAdminClient()

  const [{ error }, { data: myProfile }] = await Promise.all([
    admin.from('profiles').update({
      nome: data.nome.trim(),
      titulo: data.titulo?.trim() || null,
      telefone: data.telefone?.trim() || null,
      data_nascimento_1: data.data_nascimento_1 || null,
      data_nascimento_2: data.data_nascimento_2 || null,
      data_casamento: data.data_casamento || null,
      endereco: data.endereco?.trim() || null,
      endereco_maps: data.endereco_maps?.trim() || null,
      // A pessoa passou pela tela de perfil: o convite de boas-vindas não
      // aparece mais. Ver `supabase/migrations/profiles_perfil_completado.sql`.
      perfil_completado_em: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', user.id),
    admin.from('profiles').select('conjuge_id').eq('id', user.id).single(),
  ])
  if (error) throw new Error(error.message)

  // Sync shared couple fields to linked spouse
  if (myProfile?.conjuge_id) {
    await admin.from('profiles').update({
      data_casamento: data.data_casamento || null,
      endereco: data.endereco?.trim() || null,
      endereco_maps: data.endereco_maps?.trim() || null,
      updated_at: new Date().toISOString(),
    }).eq('id', myProfile.conjuge_id)
  }

  revalidatePath('/perfil')
  revalidatePath('/celula')
  revalidatePath('/home')
  // O layout é quem decide mostrar o convite de boas-vindas; sem invalidar,
  // ele reapareceria na próxima navegação mesmo com o perfil já salvo.
  revalidatePath('/', 'layout')
}

export async function uploadAvatarAdminAction(userId: string, formData: FormData): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')
  const { data: callerProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'pastor'].includes(callerProfile?.role ?? '')) throw new Error('Sem permissão')

  const file = formData.get('file') as File
  if (!file) throw new Error('Arquivo não encontrado')
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${userId}.${ext}`
  const arrayBuffer = await file.arrayBuffer()

  const admin = createAdminClient()
  const { error: uploadError } = await admin.storage
    .from('avatars')
    .upload(path, arrayBuffer, { upsert: true, contentType: file.type })
  if (uploadError) throw new Error(uploadError.message)

  const { data: { publicUrl } } = admin.storage.from('avatars').getPublicUrl(path)
  await admin.from('profiles')
    .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
    .eq('id', userId)

  revalidatePath('/usuarios')
  return publicUrl
}

export async function uploadAvatarAction(formData: FormData): Promise<string> {
  const user = await getCallerUser()
  const file = formData.get('file') as File
  if (!file) throw new Error('Arquivo não encontrado')

  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${user.id}.${ext}`
  const arrayBuffer = await file.arrayBuffer()

  const admin = createAdminClient()
  const { error: uploadError } = await admin.storage
    .from('avatars')
    .upload(path, arrayBuffer, { upsert: true, contentType: file.type })
  if (uploadError) throw new Error(uploadError.message)

  const { data: { publicUrl } } = admin.storage.from('avatars').getPublicUrl(path)

  const { error: updateError } = await admin
    .from('profiles')
    .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
    .eq('id', user.id)
  if (updateError) throw new Error(updateError.message)

  revalidatePath('/perfil')
  revalidatePath('/home')
  return publicUrl
}
