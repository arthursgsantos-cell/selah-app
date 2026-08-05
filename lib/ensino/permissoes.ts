/**
 * Quem é quem dentro do Ensino.
 *
 * O papel de professor não entra no enum `Role` (ver `supabase/migrations/ensino.sql`):
 * `ROLE_ORDER` compara cargos por hierarquia e dar aula não é um degrau dessa
 * escada. Então a resposta a "esta pessoa pode administrar o Ensino?" mora
 * aqui, e não em `canSeeNavItem`.
 *
 * As mesmas três perguntas existem em SQL (`ensino_e_coordenador`,
 * `ensino_e_professor`, `ensino_leciona`) e governam a RLS. Estas funções são a
 * cópia para a interface — servem para decidir o que renderizar, nunca como
 * única barreira: o banco continua sendo quem recusa o acesso indevido.
 */

import { cache } from 'react'
import { createClient, getAuthUser } from '@/lib/supabase/server'
import type { PapelEnsino, Role } from '@/lib/supabase/types'

export interface AcessoEnsino {
  userId: string
  igrejaId: string
  nome: string
  telefone: string | null
  email: string | null
  avatarUrl: string | null
  role: Role
  /** Cadastro em `ensino_equipe`; null para quem é só aluno. */
  papel: PapelEnsino | null
  /** Coordenador do Ensino, ou pastor/admin da igreja. */
  coordenador: boolean
  /** Qualquer um da equipe. Todo coordenador também conta como professor. */
  professor: boolean
}

/**
 * Deduplicado por request: layout, página e componentes chamam esta função
 * livremente sem multiplicar as idas ao banco.
 */
export const acessoEnsino = cache(async (): Promise<AcessoEnsino | null> => {
  const user = await getAuthUser()
  if (!user) return null

  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, igreja_id, nome, telefone, email, avatar_url, role')
    .eq('id', user.id)
    .single()

  if (!profile) return null

  const { data: equipe } = await supabase
    .from('ensino_equipe')
    .select('papel')
    .eq('profile_id', user.id)
    .maybeSingle()

  const papel = (equipe?.papel as PapelEnsino | undefined) ?? null
  const coordenador =
    profile.role === 'pastor' || profile.role === 'admin' || papel === 'coordenador'

  return {
    userId: profile.id,
    igrejaId: profile.igreja_id,
    nome: profile.nome,
    telefone: profile.telefone,
    email: profile.email ?? user.email ?? null,
    avatarUrl: profile.avatar_url,
    role: profile.role as Role,
    papel,
    coordenador,
    professor: coordenador || papel !== null,
  }
})

/**
 * IDs das turmas que a pessoa leciona. Coordenador recebe `null`, que significa
 * "todas" — quem chama trata o null como ausência de filtro, em vez de carregar
 * a lista inteira de turmas só para depois comparar.
 */
export async function turmasQueLeciono(acesso: AcessoEnsino): Promise<string[] | null> {
  if (acesso.coordenador) return null

  const supabase = await createClient()
  const { data } = await supabase
    .from('ensino_turma_professores')
    .select('turma_id')
    .eq('profile_id', acesso.userId)

  return (data ?? []).map((t) => t.turma_id)
}

/** Se a pessoa pode administrar aquela turma (criar aula, fazer chamada, postar material). */
export async function podeLecionar(acesso: AcessoEnsino | null, turmaId: string): Promise<boolean> {
  if (!acesso) return false
  if (acesso.coordenador) return true

  const supabase = await createClient()
  const { data } = await supabase
    .from('ensino_turma_professores')
    .select('turma_id')
    .eq('turma_id', turmaId)
    .eq('profile_id', acesso.userId)
    .maybeSingle()

  return data !== null
}
