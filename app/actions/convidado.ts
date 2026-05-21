'use server'

import { createAdminClient } from '@/lib/supabase/admin'

export async function criarPerfilConvidadoAction(userId: string) {
  const admin = createAdminClient()

  // Check if profile already exists
  const { data: existing } = await admin
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle()

  if (existing) return

  // Find the first church in the system
  const { data: igreja } = await admin
    .from('igrejas')
    .select('id')
    .limit(1)
    .single()

  if (!igreja) throw new Error('Nenhuma igreja encontrada')

  await admin.from('profiles').insert({
    id: userId,
    igreja_id: igreja.id,
    nome: 'Convidado',
    role: 'membro',
    email: null,
  })
}
