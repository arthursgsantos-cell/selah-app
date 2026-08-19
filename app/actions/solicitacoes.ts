'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import type { TipoSolicitacao, StatusSolicitacao } from '@/lib/supabase/types'

export type NovaSolicitacao = {
  tipo: TipoSolicitacao
  nome: string
  telefone: string
  email: string
  dados: Record<string, unknown>
  mensagem?: string
}

/**
 * Registra um pedido de voluntariado ou de membresia.
 *
 * Passa pelo cliente administrativo de propósito: os dois formulários ficam na
 * home, que é pública, e visitante não tem sessão para a policy de insert
 * enxergar. A igreja vem do perfil de quem está logado ou, na falta dele, da
 * única igreja cadastrada — mesmo caminho que `solicitarCelulaAction` usa.
 */
export async function criarSolicitacaoAction(entrada: NovaSolicitacao) {
  const nome = entrada.nome.trim()
  const telefone = entrada.telefone.trim()
  const email = entrada.email.trim()

  if (!nome || !telefone || !email) {
    throw new Error('Informe nome, telefone e e-mail.')
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const admin = createAdminClient()

  let igrejaId: string | null = null
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('igreja_id')
      .eq('id', user.id)
      .single()
    igrejaId = profile?.igreja_id ?? null
  }
  if (!igrejaId) {
    const { data: igreja } = await admin.from('igrejas').select('id').limit(1).maybeSingle()
    igrejaId = (igreja as { id: string } | null)?.id ?? null
  }
  if (!igrejaId) throw new Error('Igreja não encontrada')

  const { error } = await admin.from('solicitacoes').insert({
    igreja_id: igrejaId,
    user_id: user?.id ?? null,
    tipo: entrada.tipo,
    nome,
    telefone,
    email,
    dados: entrada.dados,
    mensagem: entrada.mensagem?.trim() || null,
  })

  if (error) throw new Error(error.message)

  // O telefone só é copiado para o perfil quando ainda não havia um: o que a
  // pessoa mantém no cadastro vale mais que o digitado às pressas num formulário.
  if (user && telefone) {
    const { data: prof } = await supabase.from('profiles').select('telefone').eq('id', user.id).single()
    if (!(prof as { telefone: string | null } | null)?.telefone) {
      await admin.from('profiles').update({ telefone }).eq('id', user.id)
    }
  }

  revalidatePath('/pastor')
  revalidatePath('/solicitacoes')
}

async function exigirAcessoPedidos() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, igreja_id')
    .eq('id', user.id)
    .single()
  if (!profile) throw new Error('Perfil não encontrado')

  const ehLideranca = ['pastor', 'admin', 'supervisor', 'supervisor_treinamento'].includes(profile.role)
  const admin = createAdminClient()
  const { data: delegado } = await (admin as any)
    .from('solicitacoes_acesso_delegado')
    .select('usuario_id')
    .eq('igreja_id', profile.igreja_id)
    .eq('usuario_id', user.id)
    .maybeSingle()
  if (!ehLideranca && !delegado) throw new Error('Sem permissão')

  return { user, igrejaId: profile.igreja_id }
}

export async function atualizarSolicitacaoAction(
  id: string,
  mudanca: { status?: StatusSolicitacao; responsavel_id?: string | null; observacao?: string | null }
) {
  const { user, igrejaId } = await exigirAcessoPedidos()

  // Assumir o pedido sem dizer quem assumiu deixa a lista sem dono aparente;
  // quem mudou para "em andamento" é o responsável até alguém trocar.
  const responsavel =
    mudanca.responsavel_id !== undefined
      ? mudanca.responsavel_id
      : mudanca.status === 'em_andamento'
        ? user.id
        : undefined

  const admin = createAdminClient()
  if (responsavel !== undefined && responsavel !== null) {
    const { data: pessoa } = await admin.from('profiles').select('id').eq('id', responsavel).eq('igreja_id', igrejaId).maybeSingle()
    if (!pessoa) throw new Error('Responsável inválido para esta igreja')
  }
  const { error } = await admin
    .from('solicitacoes')
    .update({
      ...(mudanca.status !== undefined ? { status: mudanca.status } : {}),
      ...(responsavel !== undefined ? { responsavel_id: responsavel } : {}),
      ...(mudanca.observacao !== undefined ? { observacao: mudanca.observacao } : {}),
      atualizado_em: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) throw new Error(error.message)

  revalidatePath('/pastor')
  revalidatePath('/solicitacoes')
}

