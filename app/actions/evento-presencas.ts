'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function responderPresencaEventoAction(
  eventoId: string,
  resposta: 'vou' | 'nao_vou' | null
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  if (resposta === null) {
    await supabase
      .from('evento_presencas')
      .delete()
      .eq('evento_id', eventoId)
      .eq('user_id', user.id)
  } else {
    const { error } = await supabase
      .from('evento_presencas')
      .upsert({ evento_id: eventoId, user_id: user.id, resposta }, { onConflict: 'evento_id,user_id' })
    if (error) throw new Error(error.message)
  }

  revalidatePath('/home')
  revalidatePath('/celula')
}
