'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import type { Role } from '@/lib/supabase/types'

export async function updateUserRoleAction(userId: string, novoRole: Role) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { data: caller } = await supabase
    .from('profiles')
    .select('role, igreja_id')
    .eq('id', user.id)
    .single()

  if (!caller || (caller.role !== 'pastor' && caller.role !== 'admin'))
    throw new Error('Sem permissão')

  const { data: target } = await supabase
    .from('profiles')
    .select('role, igreja_id')
    .eq('id', userId)
    .single()

  if (!target || target.igreja_id !== caller.igreja_id)
    throw new Error('Usuário não encontrado')

  // Admin client to bypass the "update own profile only" RLS policy
  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({ role: novoRole, updated_at: new Date().toISOString() })
    .eq('id', userId)

  if (error) throw new Error(error.message)
  revalidatePath('/usuarios')
}
