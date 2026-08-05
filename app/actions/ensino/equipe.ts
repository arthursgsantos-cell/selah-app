'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { acessoEnsino } from '@/lib/ensino/permissoes'
import type { PapelEnsino } from '@/lib/supabase/types'
import type { ResultadoAcao } from '@/lib/ensino/tipos'

export interface MembroEquipe {
  profileId: string
  nome: string
  email: string | null
  avatarUrl: string | null
  papel: PapelEnsino
  turmas: number
}

/** Quem é professor ou coordenador na igreja, com quantas turmas leciona. */
export async function listarEquipe(): Promise<MembroEquipe[]> {
  const acesso = await acessoEnsino()
  if (!acesso) return []

  const supabase = await createClient()
  const { data } = await supabase
    .from('ensino_equipe')
    .select('profile_id, papel, profiles(nome, email, avatar_url)')
    .eq('igreja_id', acesso.igrejaId)

  const linhas = (data ?? []) as unknown as {
    profile_id: string
    papel: PapelEnsino
    profiles: { nome: string; email: string | null; avatar_url: string | null } | null
  }[]

  if (linhas.length === 0) return []

  const { data: vinculos } = await supabase
    .from('ensino_turma_professores')
    .select('profile_id')
    .in('profile_id', linhas.map((l) => l.profile_id))

  const porProfessor = new Map<string, number>()
  for (const v of vinculos ?? []) {
    porProfessor.set(v.profile_id, (porProfessor.get(v.profile_id) ?? 0) + 1)
  }

  return linhas
    .map((l) => ({
      profileId: l.profile_id,
      nome: l.profiles?.nome ?? 'Sem nome',
      email: l.profiles?.email ?? null,
      avatarUrl: l.profiles?.avatar_url ?? null,
      papel: l.papel,
      turmas: porProfessor.get(l.profile_id) ?? 0,
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome))
}

export async function definirPapelAction(
  profileId: string,
  papel: PapelEnsino
): Promise<ResultadoAcao> {
  const acesso = await acessoEnsino()
  if (!acesso?.coordenador) {
    return { ok: false, erro: 'Só a coordenação do Ensino altera permissões.' }
  }

  const admin = createAdminClient()

  // Confere que a pessoa é da mesma igreja: `profileId` chega da interface e
  // não pode virar porta para promover alguém de fora.
  const { data: alvo } = await admin
    .from('profiles')
    .select('id, igreja_id')
    .eq('id', profileId)
    .single()

  if (!alvo || alvo.igreja_id !== acesso.igrejaId) {
    return { ok: false, erro: 'Pessoa não encontrada nesta igreja.' }
  }

  const { error } = await admin
    .from('ensino_equipe')
    .upsert(
      { igreja_id: acesso.igrejaId, profile_id: profileId, papel },
      { onConflict: 'igreja_id,profile_id' }
    )

  if (error) return { ok: false, erro: error.message }
  revalidatePath('/ensino/admin')
  return { ok: true }
}

export async function removerDaEquipeAction(profileId: string): Promise<ResultadoAcao> {
  const acesso = await acessoEnsino()
  if (!acesso?.coordenador) {
    return { ok: false, erro: 'Só a coordenação do Ensino altera permissões.' }
  }
  if (profileId === acesso.userId) {
    return { ok: false, erro: 'Você não pode remover a si mesmo da equipe.' }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('ensino_equipe')
    .delete()
    .eq('igreja_id', acesso.igrejaId)
    .eq('profile_id', profileId)

  if (error) return { ok: false, erro: error.message }

  // Sai também das turmas: manter o vínculo deixaria alguém sem papel no
  // Ensino ainda fazendo chamada, já que `ensino_leciona` olha essa tabela.
  await admin.from('ensino_turma_professores').delete().eq('profile_id', profileId)

  revalidatePath('/ensino/admin')
  return { ok: true }
}

/** Candidatos a professor: membros da igreja que ainda não estão na equipe. */
export async function buscarCandidatos(termo: string): Promise<
  { id: string; nome: string; email: string | null; avatarUrl: string | null }[]
> {
  const acesso = await acessoEnsino()
  if (!acesso?.coordenador) return []

  const busca = termo.trim()
  if (busca.length < 2) return []

  const admin = createAdminClient()
  const { data: equipe } = await admin
    .from('ensino_equipe')
    .select('profile_id')
    .eq('igreja_id', acesso.igrejaId)

  const jaNaEquipe = new Set((equipe ?? []).map((e) => e.profile_id))

  const { data } = await admin
    .from('profiles')
    .select('id, nome, email, avatar_url')
    .eq('igreja_id', acesso.igrejaId)
    .ilike('nome', `%${busca}%`)
    .limit(20)

  return (data ?? [])
    .filter((p) => !jaNaEquipe.has(p.id))
    .map((p) => ({ id: p.id, nome: p.nome, email: p.email, avatarUrl: p.avatar_url }))
}
