'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type Notificacao = {
  id: string
  tipo: string
  titulo: string
  mensagem: string
  dados: Record<string, string> | null
  lida: boolean
  created_at: string
}

export async function buscarNotificacoes(): Promise<Notificacao[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from('notificacoes')
    .select('id, tipo, titulo, mensagem, dados, lida, created_at')
    .eq('destinatario_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  return (data ?? []) as Notificacao[]
}

export async function contarNaoLidas(): Promise<number> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 0

  const { count } = await supabase
    .from('notificacoes')
    .select('id', { count: 'exact', head: true })
    .eq('destinatario_id', user.id)
    .eq('lida', false)

  return count ?? 0
}

export async function marcarComoLida(id: string): Promise<void> {
  const supabase = await createClient()
  await supabase.from('notificacoes').update({ lida: true }).eq('id', id)
  revalidatePath('/', 'layout')
}

export async function marcarTodasComoLidas(): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('notificacoes').update({ lida: true }).eq('destinatario_id', user.id)
  revalidatePath('/', 'layout')
}
