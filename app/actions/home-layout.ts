'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import type { HomeLayout } from '@/lib/supabase/types'

const LAYOUTS: HomeLayout[] = ['landing', 'icones']

/**
 * Grava o layout da home escolhido por quem está logado.
 *
 * Vai pela service role como o resto de `meu-perfil`: a linha alterada é sempre
 * a da própria pessoa (`.eq('id', user.id)`), então não há o que uma policy
 * decidiria aqui além do que o `user.id` já decide.
 *
 * Revalida `/home` porque é o servidor quem escolhe qual das duas homes
 * renderizar — sem isso a página voltaria do cache com o layout antigo, e a
 * troca só apareceria no recarregamento seguinte.
 */
export async function definirHomeLayoutAction(layout: HomeLayout): Promise<void> {
  if (!LAYOUTS.includes(layout)) throw new Error('Layout inválido')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({ home_layout: layout, updated_at: new Date().toISOString() })
    .eq('id', user.id)
  if (error) throw new Error(error.message)

  revalidatePath('/home')
  revalidatePath('/perfil')
}
