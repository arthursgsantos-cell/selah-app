'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function confirmarPreCadastroAction(
  preCadastroId: string,
  profileId: string
): Promise<{ ok: boolean; erro?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, erro: 'Não autenticado' }

  const { data: caller } = await supabase
    .from('profiles')
    .select('role, igreja_id')
    .eq('id', user.id)
    .single()
  if (!caller || !['pastor', 'admin'].includes(caller.role))
    return { ok: false, erro: 'Sem permissão' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('membros_pre_cadastro')
    .update({ profile_id: profileId, status: 'confirmado' })
    .eq('id', preCadastroId)
    .eq('igreja_id', caller.igreja_id)
  if (error) return { ok: false, erro: error.message }

  revalidatePath('/pendencias')
  return { ok: true }
}

export async function descartarPreCadastroAction(
  preCadastroId: string
): Promise<{ ok: boolean; erro?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, erro: 'Não autenticado' }

  const { data: caller } = await supabase
    .from('profiles')
    .select('role, igreja_id')
    .eq('id', user.id)
    .single()
  if (!caller || !['pastor', 'admin'].includes(caller.role))
    return { ok: false, erro: 'Sem permissão' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('membros_pre_cadastro')
    .update({ status: 'rejeitado' })
    .eq('id', preCadastroId)
    .eq('igreja_id', caller.igreja_id)
  if (error) return { ok: false, erro: error.message }

  revalidatePath('/pendencias')
  return { ok: true }
}
