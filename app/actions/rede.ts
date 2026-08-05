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

async function exigirPermissaoRede() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'pastor', 'supervisor'].includes(profile?.role ?? '')) throw new Error('Sem permissão')

  return user
}

/**
 * Liga/desliga as cores tiradas da capa. Ao desligar, `origem` é limpa para
 * que religar volte a extrair.
 */
export async function alternarAutoCorRedeAction(redeId: string, ativo: boolean) {
  await exigirPermissaoRede()

  const admin = createAdminClient()
  const { error } = await admin
    .from('redes')
    .update({ fundo_auto_cor: ativo, ...(ativo ? {} : { fundo_auto_cor_origem: null }) } as never)
    .eq('id', redeId)
  if (error) throw new Error(error.message)

  revalidatePath(`/rede/${redeId}`)
}

/** Grava as cores que o navegador extraiu da capa. */
export async function salvarAutoCorRedeAction(
  redeId: string,
  cores: { cor: string; corSecundaria: string; origem: string }
) {
  await exigirPermissaoRede()

  const hex = /^#[0-9a-f]{6}$/i
  if (!hex.test(cores.cor) || !hex.test(cores.corSecundaria)) throw new Error('Cor inválida')

  const admin = createAdminClient()
  const { error } = await admin
    .from('redes')
    .update({
      cor: cores.cor,
      cor_secundaria: cores.corSecundaria,
      fundo_tipo: 'nebula',
      fundo_auto_cor_origem: cores.origem,
    } as never)
    .eq('id', redeId)
  if (error) throw new Error(error.message)

  revalidatePath(`/rede/${redeId}`)
}

/**
 * Galeria no fundo. Separada da aparência porque é uma camada independente:
 * convive com a cor, o degradê ou a nébula já escolhidos.
 */
export async function atualizarFundoGaleriaRedeAction(
  redeId: string,
  data: { ativo: boolean; opacidade: number }
) {
  await exigirPermissaoRede()

  const admin = createAdminClient()
  const { error } = await admin
    .from('redes')
    .update({
      fundo_galeria: data.ativo,
      fundo_galeria_opacidade: Math.min(100, Math.max(0, Math.round(data.opacidade))),
    } as never)
    .eq('id', redeId)
  if (error) throw new Error(error.message)

  revalidatePath(`/rede/${redeId}`)
}

export async function atualizarAparenciaRedeAction(
  redeId: string,
  data: { cor: string; cor_secundaria: string | null; fundo_tipo: string; fundo_opacidade?: number }
) {
  await exigirPermissaoRede()

  const hex = /^#[0-9a-f]{6}$/i
  if (!hex.test(data.cor)) throw new Error('Cor inválida')
  if (data.cor_secundaria && !hex.test(data.cor_secundaria)) throw new Error('Cor secundária inválida')
  if (!['cor', 'gradiente', 'nebula', 'imagem'].includes(data.fundo_tipo)) throw new Error('Tipo de fundo inválido')
  if (data.fundo_opacidade != null && (data.fundo_opacidade < 0 || data.fundo_opacidade > 100)) {
    throw new Error('Opacidade precisa estar entre 0 e 100')
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('redes')
    .update({
      cor: data.cor,
      cor_secundaria: data.cor_secundaria,
      fundo_tipo: data.fundo_tipo,
      ...(data.fundo_opacidade != null ? { fundo_opacidade: data.fundo_opacidade } : {}),
    } as never)
    .eq('id', redeId)

  if (error) throw new Error(error.message)

  revalidatePath('/pastor')
  revalidatePath('/supervisor')
  revalidatePath(`/rede/${redeId}`)
}

/** Imagem de fundo da PÁGINA da rede — distinta da capa. */
export async function uploadFundoRedeAction(redeId: string, formData: FormData): Promise<string> {
  await exigirPermissaoRede()

  const file = formData.get('file') as File
  if (!file) throw new Error('Arquivo não encontrado')

  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `fundos/${redeId}.${ext}`
  const arrayBuffer = await file.arrayBuffer()

  const admin = createAdminClient()
  const { error } = await admin.storage
    .from('rede-logos')
    .upload(path, arrayBuffer, { contentType: file.type, upsert: true })
  if (error) throw new Error(error.message)

  const { data } = admin.storage.from('rede-logos').getPublicUrl(path)
  const url = `${data.publicUrl}?t=${Date.now()}`

  await admin.from('redes').update({ fundo_imagem_url: url } as never).eq('id', redeId)

  revalidatePath(`/rede/${redeId}`)
  return url
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
