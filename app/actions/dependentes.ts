'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export type DependenteItem = {
  id?: number
  nome: string
  data_nascimento: string | null
  tipo: 'cônjuge' | 'filho'
  sexo?: 'M' | 'F' | null
}

async function getCallerUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')
  return user
}

export async function salvarDependentesAction(dependentes: DependenteItem[]) {
  const user = await getCallerUser()
  const admin = createAdminClient()

  const { error: delErr } = await admin
    .from('dependentes')
    .delete()
    .eq('profile_id', user.id)
  if (delErr) throw new Error(delErr.message)

  const validos = dependentes.filter((d) => d.nome.trim())
  if (validos.length === 0) return

  const { error: insErr } = await admin.from('dependentes').insert(
    validos.map((d) => ({
      profile_id: user.id,
      nome: d.nome.trim(),
      data_nascimento: d.data_nascimento || null,
      tipo: d.tipo,
      sexo: d.tipo === 'filho' ? d.sexo ?? null : null,
    }))
  )
  if (insErr) throw new Error(insErr.message)
}

export async function buscarDependentesAction(): Promise<DependenteItem[]> {
  const user = await getCallerUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('dependentes')
    .select('id, nome, data_nascimento, tipo, sexo')
    .eq('profile_id', user.id)
    .order('created_at')
  if (error) throw new Error(error.message)
  return (data ?? []) as DependenteItem[]
}

async function getCallerAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'pastor', 'supervisor', 'lider'].includes(profile?.role ?? ''))
    throw new Error('Sem permissão')
  return user
}

export async function buscarDependentesAdminAction(userId: string): Promise<DependenteItem[]> {
  await getCallerAdmin()
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('dependentes')
    .select('id, nome, data_nascimento, tipo, sexo')
    .eq('profile_id', userId)
    .order('created_at')
  if (error) throw new Error(error.message)
  return (data ?? []) as DependenteItem[]
}

export async function salvarDependentesAdminAction(userId: string, dependentes: DependenteItem[]) {
  await getCallerAdmin()
  const admin = createAdminClient()
  const { error: delErr } = await admin.from('dependentes').delete().eq('profile_id', userId)
  if (delErr) throw new Error(delErr.message)
  const validos = dependentes.filter((d) => d.nome.trim())
  if (validos.length === 0) return
  const { error: insErr } = await admin.from('dependentes').insert(
    validos.map((d) => ({
      profile_id: userId,
      nome: d.nome.trim(),
      data_nascimento: d.data_nascimento || null,
      tipo: d.tipo,
      sexo: d.tipo === 'filho' ? d.sexo ?? null : null,
    }))
  )
  if (insErr) throw new Error(insErr.message)
}
