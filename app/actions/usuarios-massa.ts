'use server'

/**
 * Ações em massa da tela de usuários.
 *
 * Trocar o cargo de trinta pessoas uma a uma é o tipo de trabalho que faz a
 * secretaria desistir e deixar a lista desatualizada. Aqui a seleção vira uma
 * chamada só.
 *
 * Todas as ações confinam o alvo à igreja de quem chamou: sem isso, mandar uma
 * lista de ids na mão alcançaria o cadastro de outra igreja.
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import type { Role } from '@/lib/supabase/types'

export type ResultadoMassa = { ok: true; total: number } | { ok: false; erro: string }

/** Teto por chamada: protege contra um "selecionar tudo" acidental de milhares. */
const LIMITE = 500

async function direcao(): Promise<{ igrejaId: string; userId: string } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: perfil } = await supabase
    .from('profiles')
    .select('role, igreja_id')
    .eq('id', user.id)
    .single()

  if (!perfil || !['pastor', 'admin'].includes(perfil.role)) return null
  return { igrejaId: perfil.igreja_id, userId: user.id }
}

/** Dos ids recebidos, os que realmente são desta igreja. */
async function idsDaIgreja(ids: string[], igrejaId: string): Promise<string[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('profiles')
    .select('id')
    .eq('igreja_id', igrejaId)
    .in('id', ids)
  return ((data ?? []) as { id: string }[]).map((p) => p.id)
}

function conferir(ids: string[]): string | null {
  if (ids.length === 0) return 'Selecione pelo menos uma pessoa.'
  if (ids.length > LIMITE) return `Selecione no máximo ${LIMITE} pessoas por vez.`
  return null
}

export async function alterarCargoEmMassaAction(
  ids: string[],
  novoCargo: Role
): Promise<ResultadoMassa> {
  const dir = await direcao()
  if (!dir) return { ok: false, erro: 'Sem permissão.' }
  const invalido = conferir(ids)
  if (invalido) return { ok: false, erro: invalido }

  const alvos = await idsDaIgreja(ids, dir.igrejaId)
  if (alvos.length === 0) return { ok: false, erro: 'Nenhuma pessoa encontrada.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({ role: novoCargo, updated_at: new Date().toISOString() })
    .in('id', alvos)

  if (error) return { ok: false, erro: error.message }

  revalidatePath('/usuarios')
  return { ok: true, total: alvos.length }
}

export async function adicionarNaCelulaEmMassaAction(
  ids: string[],
  celulaId: string,
  papel: 'lider' | 'membro'
): Promise<ResultadoMassa> {
  const dir = await direcao()
  if (!dir) return { ok: false, erro: 'Sem permissão.' }
  const invalido = conferir(ids)
  if (invalido) return { ok: false, erro: invalido }

  const admin = createAdminClient()

  // A célula precisa ser de uma rede desta igreja — o id vem do formulário.
  const { data: celula } = await admin
    .from('celulas')
    .select('id, redes!inner(igreja_id)')
    .eq('id', celulaId)
    .maybeSingle()

  const celulaIgreja = (celula as unknown as { redes: { igreja_id: string } | null } | null)?.redes?.igreja_id
  if (!celula || celulaIgreja !== dir.igrejaId) {
    return { ok: false, erro: 'Célula não encontrada.' }
  }

  const alvos = await idsDaIgreja(ids, dir.igrejaId)
  if (alvos.length === 0) return { ok: false, erro: 'Nenhuma pessoa encontrada.' }

  const { error } = await admin
    .from('celula_membros')
    .upsert(
      alvos.map((user_id) => ({ celula_id: celulaId, user_id, papel })),
      { onConflict: 'celula_id,user_id' }
    )

  if (error) return { ok: false, erro: error.message }

  revalidatePath('/usuarios')
  revalidatePath('/celula')
  return { ok: true, total: alvos.length }
}

/**
 * Tira as pessoas selecionadas de uma célula, ou de todas em que estejam
 * (`celulaId` nulo) — é o caminho de quem está limpando cadastro antigo.
 */
export async function removerDaCelulaEmMassaAction(
  ids: string[],
  celulaId: string | null
): Promise<ResultadoMassa> {
  const dir = await direcao()
  if (!dir) return { ok: false, erro: 'Sem permissão.' }
  const invalido = conferir(ids)
  if (invalido) return { ok: false, erro: invalido }

  const alvos = await idsDaIgreja(ids, dir.igrejaId)
  if (alvos.length === 0) return { ok: false, erro: 'Nenhuma pessoa encontrada.' }

  const admin = createAdminClient()
  let q = admin.from('celula_membros').delete().in('user_id', alvos)
  if (celulaId) q = q.eq('celula_id', celulaId)

  const { error } = await q
  if (error) return { ok: false, erro: error.message }

  revalidatePath('/usuarios')
  revalidatePath('/celula')
  return { ok: true, total: alvos.length }
}
