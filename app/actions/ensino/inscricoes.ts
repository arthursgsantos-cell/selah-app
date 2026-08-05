'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { acessoEnsino, podeLecionar } from '@/lib/ensino/permissoes'
import type { StatusInscricaoEnsino } from '@/lib/supabase/types'
import type { ResultadoAcao } from '@/lib/ensino/tipos'

/**
 * Inscreve o usuário autenticado.
 *
 * Nome, telefone e e-mail saem do perfil, não do formulário: o pedido do
 * módulo é que o aluno não redigite o que a igreja já sabe. `dados` guarda só
 * as respostas dos campos extras que o professor tenha configurado.
 */
export async function inscreverAction(params: {
  turmaId: string
  dados?: Record<string, string>
}): Promise<{ ok: true; status: StatusInscricaoEnsino } | { ok: false; erro: string }> {
  const acesso = await acessoEnsino()
  if (!acesso) return { ok: false, erro: 'Faça login para se inscrever.' }

  const supabase = await createClient()

  const { data: turma } = await supabase
    .from('ensino_turmas')
    .select('id, nome, vagas, status, inscricoes_abertas, aprovacao_automatica')
    .eq('id', params.turmaId)
    .single()

  if (!turma) return { ok: false, erro: 'Turma não encontrada.' }
  if (!turma.inscricoes_abertas) return { ok: false, erro: 'As inscrições desta turma estão fechadas.' }
  if (turma.status === 'concluida' || turma.status === 'cancelada') {
    return { ok: false, erro: 'Esta turma não está recebendo inscrições.' }
  }

  const admin = createAdminClient()

  // Já inscrito? Uma inscrição recusada ou cancelada pode ser retomada; uma
  // ativa não vira duas.
  const { data: existente } = await admin
    .from('ensino_inscricoes')
    .select('id, status')
    .eq('turma_id', params.turmaId)
    .eq('user_id', acesso.userId)
    .maybeSingle()

  if (existente && ['pendente', 'aprovada', 'concluida'].includes(existente.status)) {
    return { ok: false, erro: 'Você já tem inscrição nesta turma.' }
  }

  // Vaga é ocupada por aprovado, não por pendente: um pedido esquecido não
  // pode travar a turma.
  if (turma.vagas !== null) {
    const { count } = await admin
      .from('ensino_inscricoes')
      .select('id', { count: 'exact', head: true })
      .eq('turma_id', params.turmaId)
      .in('status', ['aprovada', 'concluida'])

    if ((count ?? 0) >= turma.vagas) {
      return { ok: false, erro: 'As vagas desta turma já foram preenchidas.' }
    }
  }

  const status: StatusInscricaoEnsino = turma.aprovacao_automatica ? 'aprovada' : 'pendente'

  const linha = {
    turma_id: params.turmaId,
    user_id: acesso.userId,
    nome: acesso.nome,
    telefone: acesso.telefone,
    email: acesso.email,
    dados: params.dados ?? {},
    status,
    decidido_por: turma.aprovacao_automatica ? acesso.userId : null,
    decidido_em: turma.aprovacao_automatica ? new Date().toISOString() : null,
    observacao: null,
  }

  // Reaproveita a linha antiga quando existe: a chave única (turma, usuário)
  // impede um segundo insert, e reabrir a mesma inscrição preserva o histórico
  // de presenças de quem já tinha frequentado.
  const { error } = existente
    ? await admin.from('ensino_inscricoes').update(linha).eq('id', existente.id)
    : await admin.from('ensino_inscricoes').insert(linha)

  if (error) return { ok: false, erro: error.message }

  // Só o pedido pendente vira notificação: inscrição aprovada na hora não pede
  // nada do professor, e avisar de tudo faria o sino virar ruído ignorado.
  if (status === 'pendente') {
    await notificarProfessores({
      turmaId: params.turmaId,
      turmaNome: turma.nome,
      alunoNome: acesso.nome,
      igrejaId: acesso.igrejaId,
    })
  }

  revalidatePath('/ensino')
  revalidatePath(`/ensino/turma/${params.turmaId}`)
  revalidatePath('/ensino/aluno')
  revalidatePath('/', 'layout')
  return { ok: true, status }
}

/**
 * Avisa quem administra a turma de que há pedido esperando.
 *
 * Vai para os professores da turma e para a coordenação do Ensino — não para
 * pastor e admin em massa: eles têm acesso a tudo, mas não são quem decide a
 * inscrição no dia a dia, e receberiam notificação de toda turma da igreja.
 *
 * Falha aqui não derruba a inscrição: o pedido já está gravado, e o professor
 * continua vendo o pendente no painel.
 */
async function notificarProfessores(params: {
  turmaId: string
  turmaNome: string
  alunoNome: string
  igrejaId: string
}): Promise<void> {
  try {
    const admin = createAdminClient()

    const [professoresRes, coordenadoresRes] = await Promise.all([
      admin
        .from('ensino_turma_professores')
        .select('profile_id')
        .eq('turma_id', params.turmaId),
      admin
        .from('ensino_equipe')
        .select('profile_id')
        .eq('igreja_id', params.igrejaId)
        .eq('papel', 'coordenador'),
    ])

    const destinatarios = new Set([
      ...(professoresRes.data ?? []).map((p) => p.profile_id),
      ...(coordenadoresRes.data ?? []).map((c) => c.profile_id),
    ])

    if (destinatarios.size === 0) return

    await admin.from('notificacoes').insert(
      [...destinatarios].map((destinatarioId) => ({
        igreja_id: params.igrejaId,
        destinatario_id: destinatarioId,
        tipo: 'inscricao_ensino' as const,
        titulo: 'Novo pedido de inscrição',
        mensagem: `${params.alunoNome} pediu inscrição em ${params.turmaNome}.`,
        // `href` é lido pelo sino do header para transformar a notificação em
        // link — leva direto para a tela de aprovação.
        dados: { href: `/ensino/turma/${params.turmaId}/alunos`, turmaId: params.turmaId },
      }))
    )
  } catch {
    // Ver o comentário acima: notificação é acessório, a inscrição já está feita.
  }
}

export async function cancelarMinhaInscricaoAction(
  inscricaoId: string
): Promise<ResultadoAcao> {
  const acesso = await acessoEnsino()
  if (!acesso) return { ok: false, erro: 'Não autenticado.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('ensino_inscricoes')
    .update({ status: 'cancelada' })
    .eq('id', inscricaoId)
    .eq('user_id', acesso.userId)

  if (error) return { ok: false, erro: error.message }
  revalidatePath('/ensino/aluno')
  revalidatePath('/ensino')
  return { ok: true }
}

/**
 * Aprovação ou recusa pelo professor.
 *
 * A checagem de vaga é refeita aqui: entre o pedido e a decisão o professor
 * pode ter aprovado outras pessoas e a turma ter lotado.
 */
export async function decidirInscricaoAction(
  inscricaoId: string,
  decisao: 'aprovada' | 'recusada',
  observacao?: string | null
): Promise<ResultadoAcao> {
  const acesso = await acessoEnsino()
  if (!acesso) return { ok: false, erro: 'Não autenticado.' }

  const admin = createAdminClient()
  const { data: inscricao } = await admin
    .from('ensino_inscricoes')
    .select('id, turma_id, status')
    .eq('id', inscricaoId)
    .single()

  if (!inscricao) return { ok: false, erro: 'Inscrição não encontrada.' }
  if (!(await podeLecionar(acesso, inscricao.turma_id))) {
    return { ok: false, erro: 'Você não administra esta turma.' }
  }

  if (decisao === 'aprovada') {
    const { data: turma } = await admin
      .from('ensino_turmas')
      .select('vagas')
      .eq('id', inscricao.turma_id)
      .single()

    if (turma?.vagas !== null && turma?.vagas !== undefined) {
      const { count } = await admin
        .from('ensino_inscricoes')
        .select('id', { count: 'exact', head: true })
        .eq('turma_id', inscricao.turma_id)
        .in('status', ['aprovada', 'concluida'])

      if ((count ?? 0) >= turma.vagas) {
        return { ok: false, erro: 'A turma já está com todas as vagas ocupadas.' }
      }
    }
  }

  const { error } = await admin
    .from('ensino_inscricoes')
    .update({
      status: decisao,
      observacao: observacao?.trim() || null,
      decidido_por: acesso.userId,
      decidido_em: new Date().toISOString(),
    })
    .eq('id', inscricaoId)

  if (error) return { ok: false, erro: error.message }

  revalidatePath(`/ensino/turma/${inscricao.turma_id}`)
  revalidatePath(`/ensino/turma/${inscricao.turma_id}/alunos`)
  revalidatePath('/ensino/professor')
  return { ok: true }
}

/** Marca a inscrição como concluída ao fim do curso. */
export async function concluirInscricaoAction(
  inscricaoId: string
): Promise<ResultadoAcao> {
  const acesso = await acessoEnsino()
  if (!acesso) return { ok: false, erro: 'Não autenticado.' }

  const admin = createAdminClient()
  const { data: inscricao } = await admin
    .from('ensino_inscricoes')
    .select('id, turma_id')
    .eq('id', inscricaoId)
    .single()

  if (!inscricao) return { ok: false, erro: 'Inscrição não encontrada.' }
  if (!(await podeLecionar(acesso, inscricao.turma_id))) {
    return { ok: false, erro: 'Você não administra esta turma.' }
  }

  const { error } = await admin
    .from('ensino_inscricoes')
    .update({ status: 'concluida' })
    .eq('id', inscricaoId)

  if (error) return { ok: false, erro: error.message }
  revalidatePath(`/ensino/turma/${inscricao.turma_id}/alunos`)
  return { ok: true }
}
