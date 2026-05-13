'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createRedeAction(data: {
  nome: string
  descricao?: string
  cor?: string
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { data: profile } = await supabase
    .from('profiles')
    .select('igreja_id, role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'pastor' && profile.role !== 'admin')) throw new Error('Sem permissão')

  const { error } = await supabase.from('redes').insert({
    nome: data.nome,
    descricao: data.descricao ?? null,
    cor: data.cor ?? '#6366f1',
    igreja_id: profile.igreja_id,
  })

  if (error) throw new Error(error.message)
  revalidatePath('/pastor')
}
