'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

type InfoIgrejaData = {
  nome?: string
  descricao?: string
  horario_culto?: string
  endereco?: string
  fundada_em?: string
  instagram_url?: string
  facebook_url?: string
  youtube_url?: string
  pastor_nome?: string
  pastor_titulo?: string
}

export async function atualizarInfoIgrejaAction(
  igrejaId: string,
  data: InfoIgrejaData
): Promise<{ sucesso: boolean; erro?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { sucesso: false, erro: 'Não autenticado' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, igreja_id')
    .eq('id', user.id)
    .single()

  if (!profile) return { sucesso: false, erro: 'Perfil não encontrado' }
  if (!['pastor', 'admin'].includes(profile.role)) return { sucesso: false, erro: 'Sem permissão' }
  if (profile.igreja_id !== igrejaId) return { sucesso: false, erro: 'Sem permissão' }

  const admin = createAdminClient()
  const { error } = await admin.from('igrejas').update(data).eq('id', igrejaId)
  if (error) return { sucesso: false, erro: error.message }

  revalidatePath('/pastor')
  revalidatePath('/')
  revalidatePath('/home')

  return { sucesso: true }
}

export async function uploadLogoIgrejaAction(igrejaId: string, formData: FormData): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, igreja_id')
    .eq('id', user.id)
    .single()

  if (!profile) throw new Error('Perfil não encontrado')
  if (!['pastor', 'admin'].includes(profile.role)) throw new Error('Sem permissão')
  if (profile.igreja_id !== igrejaId) throw new Error('Sem permissão')

  const file = formData.get('file') as File
  if (!file) throw new Error('Arquivo não encontrado')

  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${igrejaId}.${ext}`
  const arrayBuffer = await file.arrayBuffer()

  const admin = createAdminClient()
  const { error } = await admin.storage
    .from('igreja-logos')
    .upload(path, arrayBuffer, { contentType: file.type, upsert: true })
  if (error) throw new Error(error.message)

  const { data } = admin.storage.from('igreja-logos').getPublicUrl(path)
  const url = `${data.publicUrl}?t=${Date.now()}`

  await admin.from('igrejas').update({ logo_url: url }).eq('id', igrejaId)

  revalidatePath('/pastor')
  revalidatePath('/', 'layout')

  return url
}
