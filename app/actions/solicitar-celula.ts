'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { ehCasado } from '@/lib/solicitacao-celula'

export type SolicitacaoData = {
  nome: string
  telefone: string
  email: string
  idade: number | null
  estado_civil: string
  tem_filhos: boolean
  filhos_detalhes: string
  bairro: string
  tipo_membro: string
  melhor_dia: string
  /**
   * Só chegam preenchidos quando o estado civil é casado — o casal é
   * encaminhado junto, e o líder precisa do contato dos dois.
   */
  conjuge_nome?: string | null
  conjuge_telefone?: string | null
  conjuge_idade?: number | null
  celula_id?: string | null
}

export async function solicitarCelulaAction(data: SolicitacaoData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const admin = createAdminClient()

  // Get igreja_id — from user profile if logged in, otherwise first church
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
    const { data: igreja } = await admin.from('igrejas').select('id').limit(1).single()
    igrejaId = igreja?.id ?? null
  }
  if (!igrejaId) throw new Error('Igreja não encontrada')

  // Quem não é casado não leva dados de cônjuge para o banco, mesmo que o
  // formulário tenha ficado com o texto digitado antes de a pessoa trocar o
  // estado civil.
  const casado = ehCasado(data.estado_civil)

  // A member request is tied to a real cell. Prefer the user's existing
  // membership; otherwise validate the selected cell and route only to its
  // leaders. Anonymous/general requests remain unassigned for supervisors.
  let celulaId: string | null = null
  let liderId: string | null = null
  if (data.tipo_membro === 'membro') {
    if (user) {
      const { data: vinculo } = await admin.from('celula_membros').select('celula_id').eq('user_id', user.id).in('papel', ['membro', 'lider']).limit(1).maybeSingle()
      celulaId = vinculo?.celula_id ?? null
    }
    celulaId = celulaId ?? data.celula_id ?? null
    if (!celulaId) throw new Error('Selecione a célula da qual você participa.')
    const { data: celula } = await admin.from('celulas').select('id, redes!inner(igreja_id)').eq('id', celulaId).eq('redes.igreja_id', igrejaId).maybeSingle()
    if (!celula) throw new Error('Célula inválida para esta igreja.')
    const { data: lider } = await admin.from('celula_membros').select('user_id').eq('celula_id', celulaId).eq('papel', 'lider').limit(1).maybeSingle()
    liderId = lider?.user_id ?? null
    if (!liderId) throw new Error('Esta célula ainda não possui líder cadastrado.')
  }

  const { error } = await admin.from('solicitacoes_celula').insert({
    ...data,
    celula_id: celulaId,
    lider_encaminhado_id: liderId,
    conjuge_nome: casado ? data.conjuge_nome?.trim() || null : null,
    conjuge_telefone: casado ? data.conjuge_telefone?.trim() || null : null,
    conjuge_idade: casado ? data.conjuge_idade ?? null : null,
    user_id: user?.id ?? null,
    igreja_id: igrejaId,
  })

  if (error) throw new Error(error.message)

  // Sync telefone back to profile if not set yet
  if (user && data.telefone) {
    const { data: prof } = await supabase.from('profiles').select('telefone').eq('id', user.id).single()
    if (!(prof as any)?.telefone) {
      await admin.from('profiles').update({ telefone: data.telefone }).eq('id', user.id)
    }
  }

  revalidatePath('/pastor')
  revalidatePath('/supervisor')
}

export async function encaminharSolicitacaoAction(solicitacaoId: string, liderId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const canAssign = ['pastor', 'admin', 'supervisor', 'supervisor_treinamento'].includes(profile?.role ?? '')
  if (!canAssign) throw new Error('Sem permissão')

  const admin = createAdminClient()
  const { error } = await admin
    .from('solicitacoes_celula')
    .update({ status: 'encaminhado', lider_encaminhado_id: liderId })
    .eq('id', solicitacaoId)

  if (error) throw new Error(error.message)
  revalidatePath('/pastor')
  revalidatePath('/supervisor')
}

export async function marcarAtendidoAction(solicitacaoId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const admin = createAdminClient()
  const { error } = await admin
    .from('solicitacoes_celula')
    .update({ status: 'atendido' })
    .eq('id', solicitacaoId)

  if (error) throw new Error(error.message)
  revalidatePath('/pastor')
  revalidatePath('/supervisor')
}



/** Approve a member request, scoped to its requested cell. */
export async function confirmarMembroCelulaAction(solicitacaoId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')
  const admin = createAdminClient()
  const { data: perfil } = await admin.from('profiles').select('igreja_id, role').eq('id', user.id).single()
  if (!perfil) throw new Error('Perfil não encontrado')
  const { data: solicitacao } = await admin.from('solicitacoes_celula').select('user_id, igreja_id, tipo_membro, celula_id, status').eq('id', solicitacaoId).maybeSingle()
  if (!solicitacao || solicitacao.igreja_id !== perfil.igreja_id || !solicitacao.user_id || !solicitacao.celula_id) throw new Error('Solicitação sem célula ou usuário vinculado')
  if (solicitacao.tipo_membro !== 'membro') throw new Error('Esta confirmação é apenas para quem se declarou membro')
  if (solicitacao.status === 'atendido') throw new Error('Solicitação já atendida')
  const privilegiado = ['pastor', 'admin', 'supervisor', 'supervisor_treinamento'].includes(perfil.role)
  if (!privilegiado) {
    const { data: vinculo } = await admin.from('celula_membros').select('user_id').eq('celula_id', solicitacao.celula_id).eq('user_id', user.id).in('papel', ['lider', 'lider_treinamento']).maybeSingle()
    if (!vinculo) throw new Error('Você não lidera esta célula')
  }
  const { error } = await admin.from('celula_membros').upsert({ celula_id: solicitacao.celula_id, user_id: solicitacao.user_id, papel: 'membro' }, { onConflict: 'celula_id,user_id' })
  if (error) throw new Error(error.message)
  const { error: updateError } = await admin.from('solicitacoes_celula').update({ status: 'atendido' }).eq('id', solicitacaoId).eq('igreja_id', perfil.igreja_id)
  if (updateError) throw new Error(updateError.message)
  revalidatePath('/solicitacoes'); revalidatePath('/celula'); revalidatePath('/pastor'); revalidatePath('/home')
}

