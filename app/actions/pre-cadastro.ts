'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

async function getAdminProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, igreja_id, nome')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'pastor'].includes(profile.role)) return null
  return { user, profile, supabase }
}

export async function adicionarPreCadastro(formData: FormData): Promise<{ sucesso: boolean; erro?: string }> {
  const ctx = await getAdminProfile()
  if (!ctx) return { sucesso: false, erro: 'Sem permissão.' }

  const nome = (formData.get('nome') as string)?.trim()
  const telefone = (formData.get('telefone') as string)?.trim() || null
  const obs = (formData.get('obs') as string)?.trim() || null

  if (!nome) return { sucesso: false, erro: 'Nome é obrigatório.' }

  const { error } = await ctx.supabase.from('membros_pre_cadastro').insert({
    igreja_id: ctx.profile.igreja_id,
    nome,
    telefone,
    obs,
    created_by: ctx.user.id,
  })

  if (error) return { sucesso: false, erro: 'Erro ao adicionar membro.' }
  revalidatePath('/usuarios')
  return { sucesso: true }
}

export async function atualizarPreCadastro(id: string, formData: FormData): Promise<{ sucesso: boolean; erro?: string }> {
  const ctx = await getAdminProfile()
  if (!ctx) return { sucesso: false, erro: 'Sem permissão.' }

  const nome = (formData.get('nome') as string)?.trim()
  const telefone = (formData.get('telefone') as string)?.trim() || null
  const obs = (formData.get('obs') as string)?.trim() || null

  if (!nome) return { sucesso: false, erro: 'Nome é obrigatório.' }

  const { error } = await ctx.supabase
    .from('membros_pre_cadastro')
    .update({ nome, telefone, obs, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { sucesso: false, erro: 'Erro ao atualizar.' }
  revalidatePath('/usuarios')
  return { sucesso: true }
}

export async function removerPreCadastro(id: string): Promise<{ sucesso: boolean; erro?: string }> {
  const ctx = await getAdminProfile()
  if (!ctx) return { sucesso: false, erro: 'Sem permissão.' }

  const { error } = await ctx.supabase.from('membros_pre_cadastro').delete().eq('id', id)
  if (error) return { sucesso: false, erro: 'Erro ao remover.' }
  revalidatePath('/usuarios')
  return { sucesso: true }
}

export async function adminVincularPreCadastro(preCadastroId: string, profileId: string): Promise<{ sucesso: boolean; erro?: string }> {
  const ctx = await getAdminProfile()
  if (!ctx) return { sucesso: false, erro: 'Sem permissão.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('membros_pre_cadastro')
    .update({ profile_id: profileId, status: 'confirmado', updated_at: new Date().toISOString() })
    .eq('id', preCadastroId)

  if (error) return { sucesso: false, erro: 'Erro ao vincular.' }
  revalidatePath('/usuarios')
  return { sucesso: true }
}

export async function adminDesvincularPreCadastro(preCadastroId: string): Promise<{ sucesso: boolean; erro?: string }> {
  const ctx = await getAdminProfile()
  if (!ctx) return { sucesso: false, erro: 'Sem permissão.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('membros_pre_cadastro')
    .update({ profile_id: null, status: 'pendente', updated_at: new Date().toISOString() })
    .eq('id', preCadastroId)

  if (error) return { sucesso: false, erro: 'Erro ao desvincular.' }
  revalidatePath('/usuarios')
  return { sucesso: true }
}

// Chamado pelo usuário durante onboarding para confirmar que é ele
export async function confirmarMatchPreCadastro(preCadastroId: string): Promise<{ sucesso: boolean; erro?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { sucesso: false, erro: 'Não autenticado.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('nome, igreja_id')
    .eq('id', user.id)
    .single()

  if (!profile) return { sucesso: false, erro: 'Perfil não encontrado.' }

  const admin = createAdminClient()

  const { data: pre, error: erroPre } = await admin
    .from('membros_pre_cadastro')
    .update({ profile_id: user.id, status: 'confirmado', updated_at: new Date().toISOString() })
    .eq('id', preCadastroId)
    .eq('status', 'pendente')
    .select('nome')
    .single()

  if (erroPre || !pre) return { sucesso: false, erro: 'Erro ao confirmar identificação.' }

  // Notificar admin/pastor
  const { data: admins } = await admin
    .from('profiles')
    .select('id')
    .eq('igreja_id', profile.igreja_id)
    .in('role', ['admin', 'pastor'])

  if (admins && admins.length > 0) {
    await (admin as any).from('notificacoes').insert(
      admins.map((a) => ({
        igreja_id: profile.igreja_id,
        destinatario_id: a.id,
        tipo: 'match_confirmado',
        titulo: 'Membro identificado na lista',
        mensagem: `${profile.nome} confirmou ser "${pre.nome}" da lista de pré-cadastro. Verifique se está correto.`,
        dados: { profile_id: user.id, pre_cadastro_id: preCadastroId },
      }))
    )
  }

  return { sucesso: true }
}

// Notifica admins quando alguém faz login pela primeira vez (sem match)
export async function notificarNovoLogin(): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: profile } = await supabase
    .from('profiles')
    .select('nome, igreja_id')
    .eq('id', user.id)
    .single()

  if (!profile) return

  const admin = createAdminClient()

  const { data: admins } = await admin
    .from('profiles')
    .select('id')
    .eq('igreja_id', profile.igreja_id)
    .in('role', ['admin', 'pastor'])
    .neq('id', user.id)

  if (!admins || admins.length === 0) return

  await (admin as any).from('notificacoes').insert(
    admins.map((a) => ({
      igreja_id: profile.igreja_id,
      destinatario_id: a.id,
      tipo: 'novo_login',
      titulo: 'Novo membro entrou',
      mensagem: `${profile.nome} acabou de criar uma conta na igreja.`,
      dados: { profile_id: user.id },
    }))
  )
}
