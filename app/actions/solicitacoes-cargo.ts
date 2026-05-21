'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function solicitarCargoAction(
  cargoSolicitado: string,
  mensagem?: string
): Promise<{ ok: boolean; erro?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, erro: 'Não autenticado' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, igreja_id')
    .eq('id', user.id)
    .single()
  if (!profile) return { ok: false, erro: 'Perfil não encontrado' }

  // Verifica se já tem uma solicitação pendente
  const { data: existente } = await supabase
    .from('solicitacoes_cargo')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'pendente')
    .maybeSingle()
  if (existente) return { ok: false, erro: 'Você já tem uma solicitação pendente.' }

  const { error } = await supabase
    .from('solicitacoes_cargo')
    .insert({
      user_id: user.id,
      igreja_id: profile.igreja_id,
      cargo_solicitado: cargoSolicitado,
      mensagem: mensagem?.trim() || null,
    })
  if (error) return { ok: false, erro: error.message }

  revalidatePath('/pendencias')
  revalidatePath('/perfil')
  return { ok: true }
}

export async function resolverSolicitacaoCargoAction(
  id: string,
  acao: 'aprovar' | 'rejeitar'
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
  const { data: sol } = await admin
    .from('solicitacoes_cargo')
    .select('user_id, cargo_solicitado, igreja_id')
    .eq('id', id)
    .single()
  if (!sol || sol.igreja_id !== caller.igreja_id)
    return { ok: false, erro: 'Solicitação não encontrada' }

  const { error } = await admin
    .from('solicitacoes_cargo')
    .update({
      status: acao === 'aprovar' ? 'aprovado' : 'rejeitado',
      resolvido_por: user.id,
      resolvido_em: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) return { ok: false, erro: error.message }

  // Se aprovado, atualiza o role do usuário
  if (acao === 'aprovar') {
    await admin
      .from('profiles')
      .update({ role: sol.cargo_solicitado, updated_at: new Date().toISOString() })
      .eq('id', sol.user_id)
  }

  revalidatePath('/pendencias')
  revalidatePath('/usuarios')
  return { ok: true }
}

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
