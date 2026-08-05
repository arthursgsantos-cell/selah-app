'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function toggleLikeEventoAction(eventoId: string, pathname: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  // Check if already liked
  const { data: existing } = await supabase
    .from('evento_likes')
    .select('evento_id')
    .eq('evento_id', eventoId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    await supabase.from('evento_likes').delete().eq('evento_id', eventoId).eq('user_id', user.id)
  } else {
    await supabase.from('evento_likes').insert({ evento_id: eventoId, user_id: user.id })
  }

  revalidatePath(pathname)
  return { liked: !existing }
}
