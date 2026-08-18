'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

async function contexto() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: perfil } = await supabase.from('profiles').select('id, igreja_id, role').eq('id', user.id).single()
  return perfil ? { user, perfil } : null
}

export async function salvarAcessoSolicitacoesAction(usuarioId: string, permitir: boolean) {
  const ctx = await contexto()
  if (!ctx || !['pastor', 'admin'].includes(ctx.perfil.role)) return { sucesso: false, erro: 'Sem permissão' }
  const admin = createAdminClient()
  const result = permitir
    ? await admin.from('solicitacoes_acesso_delegado').upsert({ igreja_id: ctx.perfil.igreja_id, usuario_id: usuarioId, criado_por: ctx.user.id })
    : await admin.from('solicitacoes_acesso_delegado').delete().eq('igreja_id', ctx.perfil.igreja_id).eq('usuario_id', usuarioId)
  if (result.error) return { sucesso: false, erro: result.error.message }
  revalidatePath('/pastor')
  return { sucesso: true }
}
