'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { vincularInscricoesEnsino } from '@/lib/ensino/vinculo-aluno'

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
  const email = (formData.get('email') as string)?.trim().toLowerCase() || null
  const cargo = (formData.get('cargo') as string)?.trim() || null
  const telefone = (formData.get('telefone') as string)?.trim() || null
  const obs = (formData.get('obs') as string)?.trim() || null

  if (!nome) return { sucesso: false, erro: 'Nome é obrigatório.' }

  const { error } = await ctx.supabase.from('membros_pre_cadastro').insert({
    igreja_id: ctx.profile.igreja_id,
    nome,
    email,
    cargo: cargo as never,
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
  const email = (formData.get('email') as string)?.trim().toLowerCase() || null
  const cargo = (formData.get('cargo') as string)?.trim() || null
  const telefone = (formData.get('telefone') as string)?.trim() || null
  const obs = (formData.get('obs') as string)?.trim() || null

  if (!nome) return { sucesso: false, erro: 'Nome é obrigatório.' }

  const { error } = await ctx.supabase
    .from('membros_pre_cadastro')
    .update({ nome, email, cargo: cargo as never, telefone, obs, updated_at: new Date().toISOString() })
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

  // O que o professor tiver lançado no Ensino para esta pessoa passa a ser
  // dela — inclusive as presenças anteriores ao cadastro.
  await vincularInscricoesEnsino(admin, preCadastroId, profileId)

  revalidatePath('/usuarios')
  revalidatePath('/ensino/alunos')
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

  await vincularInscricoesEnsino(admin, preCadastroId, user.id)

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

/**
 * Move um pré-cadastrado para uma célula (ou tira dela) antes mesmo de a pessoa
 * criar a conta — permite montar a composição das células com antecedência.
 * Quando ela se cadastrar, o onboarding a coloca automaticamente nessa célula.
 */
export async function atribuirCelulaPreCadastroAction(
  id: string,
  celulaId: string | null
): Promise<{ sucesso: boolean; erro?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { sucesso: false, erro: 'Não autenticado' }

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()

  const permitido = ['admin', 'pastor', 'supervisor', 'supervisor_treinamento', 'lider']
  if (!profile || !permitido.includes(profile.role)) {
    return { sucesso: false, erro: 'Sem permissão' }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('membros_pre_cadastro')
    .update({ celula_id: celulaId, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { sucesso: false, erro: error.message }

  revalidatePath('/usuarios')
  revalidatePath('/celula')
  if (celulaId) revalidatePath(`/celula/${celulaId}`)
  return { sucesso: true }
}

/**
 * Liga (ou desliga) dois pré-cadastrados como casal, antes de ambos terem conta.
 * Os dois passam a compartilhar o mesmo código de vínculo — o mesmo mecanismo
 * que veio da planilha —, e o onboarding preenche o `conjuge_id` de cada um
 * assim que os dois criarem a conta.
 */
export async function vincularConjugePreCadastroAction(
  id: string,
  conjugeId: string | null
): Promise<{ sucesso: boolean; erro?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { sucesso: false, erro: 'Não autenticado' }

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()

  const permitido = ['admin', 'pastor', 'supervisor', 'supervisor_treinamento', 'lider']
  if (!profile || !permitido.includes(profile.role)) {
    return { sucesso: false, erro: 'Sem permissão' }
  }

  const admin = createAdminClient()
  const agora = new Date().toISOString()

  // Desvincular: quem ficar sozinho no código perde o vínculo junto.
  if (!conjugeId) {
    const { data: atual } = await admin
      .from('membros_pre_cadastro').select('vinculo_casal').eq('id', id).single()

    const { error } = await admin
      .from('membros_pre_cadastro')
      .update({ vinculo_casal: null, updated_at: agora })
      .eq('id', id)
    if (error) return { sucesso: false, erro: error.message }

    if (atual?.vinculo_casal) {
      await admin
        .from('membros_pre_cadastro')
        .update({ vinculo_casal: null, updated_at: agora })
        .eq('vinculo_casal', atual.vinculo_casal)
    }

    revalidatePath('/usuarios')
    return { sucesso: true }
  }

  if (id === conjugeId) return { sucesso: false, erro: 'Não dá para vincular a pessoa a si mesma.' }

  // Código novo e único para o par, sem colidir com os que vieram da planilha.
  const codigo = `par-${Date.now().toString(36)}`
  const { error } = await admin
    .from('membros_pre_cadastro')
    .update({ vinculo_casal: codigo, updated_at: agora })
    .in('id', [id, conjugeId])

  if (error) return { sucesso: false, erro: error.message }

  revalidatePath('/usuarios')
  return { sucesso: true }
}
