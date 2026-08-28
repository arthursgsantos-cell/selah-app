'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { exigirPermissaoEncontro } from '@/lib/celula-permissoes'
import type { StatusPresenca } from '@/lib/supabase/types'

export type PresencaOptions = {
  comConjuge?: boolean
  comFilhos?: boolean
  numVisitantes?: number
  nomesVisitantes?: string[]
  observacao?: string
}

export type PresencaItem = {
  user_id: string
  nome: string
  avatar_url: string | null
  status: StatusPresenca
  com_conjuge: boolean
  com_filhos: boolean
  num_visitantes: number
}

export async function confirmarPresencaAction(
  encontroId: string,
  status: StatusPresenca,
  opts: PresencaOptions = {}
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const admin = createAdminClient()
  const { error } = await admin.from('presencas').upsert({
    encontro_id: encontroId,
    user_id: user.id,
    status,
    com_conjuge: opts.comConjuge ?? false,
    com_filhos: opts.comFilhos ?? false,
    num_visitantes: opts.nomesVisitantes?.length ?? opts.numVisitantes ?? 0,
    observacao: opts.nomesVisitantes ? JSON.stringify(opts.nomesVisitantes) : (opts.observacao ?? null),
  }, { onConflict: 'encontro_id,user_id' })

  if (error) throw new Error(error.message)
  revalidatePath(`/encontro/${encontroId}`)
}

export async function buscarPresencasEncontroAction(encontroId: string): Promise<PresencaItem[]> {
  // Quem esteve no encontro é assunto da célula: sem esta checagem, o id de um
  // encontro qualquer devolvia a lista de nomes de outra célula.
  await exigirPermissaoEncontro(encontroId)

  try {
    const admin = createAdminClient()
    const { data } = await admin
      .from('presencas')
      .select('user_id, status, com_conjuge, com_filhos, num_visitantes, profiles(nome, avatar_url)')
      .eq('encontro_id', encontroId)
      .neq('status', 'pendente')
    return ((data ?? []) as unknown as {
      user_id: string
      status: StatusPresenca
      com_conjuge: boolean
      com_filhos: boolean
      num_visitantes: number
      profiles: { nome: string; avatar_url: string | null } | null
    }[]).map((p) => ({
      user_id: p.user_id,
      nome: p.profiles?.nome ?? 'Membro',
      avatar_url: p.profiles?.avatar_url ?? null,
      status: p.status,
      com_conjuge: p.com_conjuge,
      com_filhos: p.com_filhos,
      num_visitantes: p.num_visitantes,
    }))
  } catch {
    return []
  }
}

export async function buscarMinhaPresencaAction(encontroId: string): Promise<{
  status: StatusPresenca
  com_conjuge: boolean
  com_filhos: boolean
  num_visitantes: number
  observacao: string | null
} | null> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data } = await supabase
      .from('presencas')
      .select('status, com_conjuge, com_filhos, num_visitantes, observacao')
      .eq('encontro_id', encontroId)
      .eq('user_id', user.id)
      .maybeSingle()
    return data as { status: StatusPresenca; com_conjuge: boolean; com_filhos: boolean; num_visitantes: number; observacao: string | null } | null
  } catch {
    return null
  }
}
