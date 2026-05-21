'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

async function getUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')
  return user
}

export type MembroItem = { id: string; nome: string; avatar_url: string | null }
export type ConjugeInfo = { id: string; nome: string; avatar_url: string | null } | null

export async function buscarMembrosAction(busca: string): Promise<MembroItem[]> {
  if (!busca.trim() || busca.trim().length < 2) return []
  const user = await getUser()
  const supabase = await createClient()

  const { data: myProfile } = await supabase
    .from('profiles').select('igreja_id').eq('id', user.id).single()
  if (!myProfile) return []

  const { data } = await supabase
    .from('profiles')
    .select('id, nome, avatar_url')
    .eq('igreja_id', myProfile.igreja_id)
    .neq('id', user.id)
    .ilike('nome', `%${busca.trim()}%`)
    .limit(8)

  return (data ?? []) as MembroItem[]
}

export async function buscarConjugeAtualAction(): Promise<ConjugeInfo> {
  const user = await getUser()
  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles').select('conjuge_id').eq('id', user.id).single()

  if (!profile?.conjuge_id) return null

  const { data: conjuge } = await admin
    .from('profiles').select('id, nome, avatar_url').eq('id', profile.conjuge_id).single()

  return conjuge as ConjugeInfo
}

export async function vincularConjugeAction(conjugeId: string) {
  const user = await getUser()
  const admin = createAdminClient()

  // Link both ways
  await Promise.all([
    admin.from('profiles').update({ conjuge_id: conjugeId }).eq('id', user.id),
    admin.from('profiles').update({ conjuge_id: user.id }).eq('id', conjugeId),
  ])

  revalidatePath('/perfil')
}

export async function desvincularConjugeAction() {
  const user = await getUser()
  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles').select('conjuge_id').eq('id', user.id).single()

  await Promise.all([
    admin.from('profiles').update({ conjuge_id: null }).eq('id', user.id),
    profile?.conjuge_id
      ? admin.from('profiles').update({ conjuge_id: null }).eq('id', profile.conjuge_id)
      : Promise.resolve(),
  ])

  revalidatePath('/perfil')
}

export async function vincularConjugeAdminAction(userId: string, conjugeId: string) {
  const user = await getUser()
  const supabase = await createClient()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const canEdit = ['admin', 'pastor', 'supervisor', 'lider'].includes(profile?.role ?? '')
  if (!canEdit) throw new Error('Sem permissão')

  const admin = createAdminClient()
  await Promise.all([
    admin.from('profiles').update({ conjuge_id: conjugeId }).eq('id', userId),
    admin.from('profiles').update({ conjuge_id: userId }).eq('id', conjugeId),
  ])
  revalidatePath('/celula')
  revalidatePath('/usuarios')
}

export async function desvincularConjugeAdminAction(userId: string) {
  const user = await getUser()
  const supabase = await createClient()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const canEdit = ['admin', 'pastor', 'supervisor', 'lider'].includes(profile?.role ?? '')
  if (!canEdit) throw new Error('Sem permissão')

  const admin = createAdminClient()
  const { data: target } = await admin.from('profiles').select('conjuge_id').eq('id', userId).single()

  await Promise.all([
    admin.from('profiles').update({ conjuge_id: null }).eq('id', userId),
    target?.conjuge_id
      ? admin.from('profiles').update({ conjuge_id: null }).eq('id', target.conjuge_id)
      : Promise.resolve(),
  ])
  revalidatePath('/celula')
  revalidatePath('/usuarios')
  revalidatePath('/perfil')
}

export type DadosConjuge = {
  endereco: string | null
  endereco_maps: string | null
  data_nascimento_1: string | null
  data_casamento: string | null
  filhos: Array<{ nome: string; data_nascimento: string | null }>
}

export async function buscarDadosConjugeAction(): Promise<DadosConjuge | null> {
  const user = await getUser()
  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles').select('conjuge_id, data_casamento').eq('id', user.id).single()

  if (!profile?.conjuge_id) return null

  const { data: conjuge } = await admin
    .from('profiles')
    .select('endereco, endereco_maps, data_nascimento_1, data_casamento')
    .eq('id', profile.conjuge_id)
    .single()

  if (!conjuge) return null

  const { data: filhos } = await admin
    .from('dependentes')
    .select('nome, data_nascimento')
    .eq('profile_id', profile.conjuge_id)
    .eq('tipo', 'filho')
    .order('data_nascimento', { ascending: true })

  return {
    endereco: conjuge.endereco,
    endereco_maps: conjuge.endereco_maps,
    data_nascimento_1: conjuge.data_nascimento_1,
    data_casamento: conjuge.data_casamento ?? profile.data_casamento,
    filhos: (filhos ?? []) as Array<{ nome: string; data_nascimento: string | null }>,
  }
}

export async function buscarSugestaoConjugeAction(): Promise<{ profileId: string; nome: string; avatar_url: string | null } | null> {
  const user = await getUser()
  const admin = createAdminClient()

  const { data: myProfile } = await admin
    .from('profiles').select('nome, conjuge_id, igreja_id').eq('id', user.id).single()

  if (!myProfile || myProfile.conjuge_id) return null

  // Find if someone listed our name as their dependente cônjuge
  const { data: deps } = await admin
    .from('dependentes')
    .select('profile_id, nome')
    .eq('tipo', 'cônjuge')
    .ilike('nome', `%${myProfile.nome.split(' ')[0]}%`)

  if (!deps || deps.length === 0) return null

  const profileIds = deps.map((d: { profile_id: string }) => d.profile_id)

  const { data: profiles } = await admin
    .from('profiles')
    .select('id, nome, avatar_url, conjuge_id, igreja_id')
    .in('id', profileIds)
    .eq('igreja_id', myProfile.igreja_id)
    .is('conjuge_id', null)

  if (!profiles || profiles.length === 0) return null

  const match = profiles[0] as { id: string; nome: string; avatar_url: string | null }
  return { profileId: match.id, nome: match.nome, avatar_url: match.avatar_url }
}
