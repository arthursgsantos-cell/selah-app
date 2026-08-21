'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import {
  analisarVinculo,
  vincularCasal,
  desvincularCasal,
  type AnaliseVinculo,
  type ResolucaoDuplicata,
} from '@/lib/familia-vinculo-servidor'

export type { AnaliseVinculo, ResolucaoDuplicata }

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

async function exigirPermissaoDeEdicao() {
  const user = await getUser()
  const supabase = await createClient()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const canEdit = ['admin', 'pastor', 'supervisor', 'lider'].includes(profile?.role ?? '')
  if (!canEdit) throw new Error('Sem permissão')
  return user
}

/**
 * O que vai acontecer com os cadastros de filhos se este vínculo for feito.
 * A tela chama antes de vincular: é aqui que a duplicata deixa de ser uma
 * surpresa e vira uma pergunta.
 */
export async function analisarVinculoConjugeAction(conjugeId: string): Promise<AnaliseVinculo> {
  const user = await getUser()
  const admin = createAdminClient()
  await exigirMesmaIgreja(admin, user.id, conjugeId)
  return analisarVinculo(admin, user.id, conjugeId)
}

export async function analisarVinculoConjugeAdminAction(
  userId: string,
  conjugeId: string
): Promise<AnaliseVinculo> {
  await exigirPermissaoDeEdicao()
  const admin = createAdminClient()
  await exigirMesmaIgreja(admin, userId, conjugeId)
  return analisarVinculo(admin, userId, conjugeId)
}

async function exigirMesmaIgreja(
  admin: ReturnType<typeof createAdminClient>,
  a: string,
  b: string
) {
  if (a === b) throw new Error('Não é possível vincular a própria conta')
  const { data } = await admin.from('profiles').select('id, igreja_id').in('id', [a, b])
  const perfis = (data ?? []) as Array<{ id: string; igreja_id: string | null }>
  if (perfis.length !== 2) throw new Error('Perfil não encontrado')
  if (perfis[0].igreja_id !== perfis[1].igreja_id) throw new Error('Perfis de igrejas diferentes')
}

/**
 * A mesma conferência, para um casal que já está vinculado. Serve para os
 * cadastros feitos em duplicidade antes do vínculo existir — e para os que
 * divergem demais para a limpeza automática resolver sozinha.
 */
export async function revisarFamiliaAction(): Promise<AnaliseVinculo | null> {
  const user = await getUser()
  const admin = createAdminClient()
  const { data } = await admin.from('profiles').select('conjuge_id').eq('id', user.id).single()
  const conjugeId = (data?.conjuge_id as string | null) ?? null
  if (!conjugeId) return null
  return analisarVinculo(admin, user.id, conjugeId)
}

export async function vincularConjugeAction(
  conjugeId: string,
  resolucoes: ResolucaoDuplicata[] = []
) {
  const user = await getUser()
  const admin = createAdminClient()
  await exigirMesmaIgreja(admin, user.id, conjugeId)
  await vincularCasal(admin, user.id, conjugeId, resolucoes)

  revalidatePath('/perfil')
  revalidatePath('/celula')
}

export async function desvincularConjugeAction() {
  const user = await getUser()
  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles').select('conjuge_id').eq('id', user.id).single()

  await desvincularCasal(admin, user.id, (profile?.conjuge_id as string | null) ?? null)

  revalidatePath('/perfil')
  revalidatePath('/celula')
}

export async function vincularConjugeAdminAction(
  userId: string,
  conjugeId: string,
  resolucoes: ResolucaoDuplicata[] = []
) {
  await exigirPermissaoDeEdicao()
  const admin = createAdminClient()
  await exigirMesmaIgreja(admin, userId, conjugeId)
  await vincularCasal(admin, userId, conjugeId, resolucoes)

  revalidatePath('/celula')
  revalidatePath('/usuarios')
  revalidatePath('/perfil')
}

export async function desvincularConjugeAdminAction(userId: string) {
  await exigirPermissaoDeEdicao()
  const admin = createAdminClient()
  const { data: target } = await admin.from('profiles').select('conjuge_id').eq('id', userId).single()

  await desvincularCasal(admin, userId, (target?.conjuge_id as string | null) ?? null)

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

  // Só o que ainda é exclusivamente dele(a): filho já compartilhado aparece na
  // minha própria lista editável, e listar de novo aqui seria a duplicata de
  // volta, agora só na tela.
  const { data: filhosBrutos } = await admin
    .from('dependentes')
    .select('nome, data_nascimento, co_profile_id')
    .eq('profile_id', profile.conjuge_id)
    .eq('tipo', 'filho')
    .order('data_nascimento', { ascending: true })

  const filhos = ((filhosBrutos ?? []) as Array<{
    nome: string
    data_nascimento: string | null
    co_profile_id: string | null
  }>)
    .filter((f) => f.co_profile_id !== user.id)
    .map(({ nome, data_nascimento }) => ({ nome, data_nascimento }))

  return {
    endereco: conjuge.endereco,
    endereco_maps: conjuge.endereco_maps,
    data_nascimento_1: conjuge.data_nascimento_1,
    data_casamento: conjuge.data_casamento ?? profile.data_casamento,
    filhos,
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
