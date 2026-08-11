'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { acessoEnsino, podeLecionar, type AcessoEnsino } from '@/lib/ensino/permissoes'
import type { StatusInscricaoEnsino } from '@/lib/supabase/types'
import type { ResultadoAcao } from '@/lib/ensino/tipos'

interface TurmaParaInscricao {
  id: string
  nome: string
  vagas: number | null
  status: string
  inscricoes_abertas: boolean
  aprovacao_automatica: boolean
}

/**
 * O núcleo da inscrição: confere duplicidade e vaga, grava e avisa quem
 * administra a turma.
 *
 * Vive à parte porque hoje há dois botões que registram — o do app e o do
 * WhatsApp —, e a única diferença entre eles é para onde a pessoa vai depois.
 * "Já inscrito" volta como resultado, e não como erro: para o app é impedimento
 * ("você já tem inscrição"), para o WhatsApp é só motivo de não gravar de novo
 * antes de abrir a conversa.
 */
async function gravarInscricao(
  acesso: AcessoEnsino,
  turma: TurmaParaInscricao,
  dados: Record<string, string>
): Promise<
  | { ok: true; status: StatusInscricaoEnsino; jaInscrito: boolean }
  | { ok: false; erro: string }
> {
  const admin = createAdminClient()

  // Já inscrito? Uma inscrição recusada ou cancelada pode ser retomada; uma
  // ativa não vira duas.
  const { data: existente } = await admin
    .from('ensino_inscricoes')
    .select('id, status')
    .eq('turma_id', turma.id)
    .eq('user_id', acesso.userId)
    .maybeSingle()

  if (existente && ['pendente', 'aprovada', 'concluida'].includes(existente.status)) {
    return { ok: true, status: existente.status as StatusInscricaoEnsino, jaInscrito: true }
  }

  // Vaga é ocupada por aprovado, não por pendente: um pedido esquecido não
  // pode travar a turma.
  if (turma.vagas !== null) {
    const { count } = await admin
      .from('ensino_inscricoes')
      .select('id', { count: 'exact', head: true })
      .eq('turma_id', turma.id)
      .in('status', ['aprovada', 'concluida'])

    if ((count ?? 0) >= turma.vagas) {
      return { ok: false, erro: 'As vagas desta turma já foram preenchidas.' }
    }
  }

  const status: StatusInscricaoEnsino = turma.aprovacao_automatica ? 'aprovada' : 'pendente'

  const linha = {
    turma_id: turma.id,
    user_id: acesso.userId,
    nome: acesso.nome,
    telefone: acesso.telefone,
    email: acesso.email,
    dados,
    status,
    origem: 'app' as const,
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
      turmaId: turma.id,
      turmaNome: turma.nome,
      alunoNome: acesso.nome,
      igrejaId: acesso.igrejaId,
    })
  }

  revalidatePath('/ensino')
  revalidatePath(`/ensino/turma/${turma.id}`)
  revalidatePath(`/ensino/turma/${turma.id}/alunos`)
  revalidatePath('/ensino/aluno')
  revalidatePath('/', 'layout')
  return { ok: true, status, jaInscrito: false }
}

/** Carrega a turma pela visão do próprio aluno e recusa a que não recebe mais. */
async function turmaAberta(
  turmaId: string
): Promise<{ ok: true; turma: TurmaParaInscricao } | { ok: false; erro: string }> {
  const supabase = await createClient()

  const { data: turma } = await supabase
    .from('ensino_turmas')
    .select('id, nome, vagas, status, inscricoes_abertas, aprovacao_automatica')
    .eq('id', turmaId)
    .single()

  if (!turma) return { ok: false, erro: 'Turma não encontrada.' }
  if (!turma.inscricoes_abertas) {
    return { ok: false, erro: 'As inscrições desta turma estão fechadas.' }
  }
  if (turma.status === 'concluida' || turma.status === 'cancelada') {
    return { ok: false, erro: 'Esta turma não está recebendo inscrições.' }
  }

  return { ok: true, turma: turma as TurmaParaInscricao }
}

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

  const aberta = await turmaAberta(params.turmaId)
  if (!aberta.ok) return aberta

  const r = await gravarInscricao(acesso, aberta.turma, params.dados ?? {})
  if (!r.ok) return r
  if (r.jaInscrito) return { ok: false, erro: 'Você já tem inscrição nesta turma.' }

  return { ok: true, status: r.status }
}

/**
 * Inscrição pelo WhatsApp — registra no app e leva ao grupo da turma.
 *
 * Antes este botão só abria uma conversa, e a turma inteira ficava fora do
 * sistema: sem lista de chamada, sem frequência, sem saber quem pediu. Agora a
 * ordem é outra — grava a inscrição igual ao botão do app e só depois manda a
 * pessoa para o grupo. Entrar no grupo é a confirmação da inscrição, e é isso
 * que a turma sempre quis dizer com "inscrição pelo WhatsApp"; não há mensagem
 * pré-digitada, porque não há nada a mandar.
 *
 * Quem já está inscrito não vira uma segunda linha: o grupo abre do mesmo
 * jeito, que é o que a pessoa quer ao voltar aqui.
 */
export async function inscreverPeloWhatsappAction(turmaId: string): Promise<
  | { ok: true; url: string; status: StatusInscricaoEnsino; jaInscrito: boolean }
  | { ok: false; erro: string }
> {
  const acesso = await acessoEnsino()
  if (!acesso) return { ok: false, erro: 'Faça login para se inscrever.' }

  const supabase = await createClient()
  const { data: dadosTurma } = await supabase
    .from('ensino_turmas')
    .select('id, nome, tipo_inscricao, whatsapp_url')
    .eq('id', turmaId)
    .single()

  if (!dadosTurma) return { ok: false, erro: 'Turma não encontrada.' }

  const grupo = (dadosTurma.whatsapp_url ?? '').trim()
  if (dadosTurma.tipo_inscricao !== 'whatsapp' || !grupo) {
    return { ok: false, erro: 'Esta turma não usa inscrição por WhatsApp.' }
  }

  // Quem já está na turma pula a checagem de "recebe inscrição": para ele o
  // botão é só "entrar no grupo", e uma turma encerrada não é motivo para
  // recusar o acesso ao grupo de que já faz parte.
  const { data: existente } = await createAdminClient()
    .from('ensino_inscricoes')
    .select('status')
    .eq('turma_id', turmaId)
    .eq('user_id', acesso.userId)
    .maybeSingle()

  const jaInscrito =
    existente !== null && ['pendente', 'aprovada', 'concluida'].includes(existente.status)

  let status = (existente?.status ?? 'pendente') as StatusInscricaoEnsino

  if (!jaInscrito) {
    const aberta = await turmaAberta(turmaId)
    if (!aberta.ok) return aberta

    const r = await gravarInscricao(acesso, aberta.turma, {})
    if (!r.ok) return r
    status = r.status
  }

  return { ok: true, url: grupo, status, jaInscrito }
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

    // Professor sem conta no app não tem para onde receber aviso: a linha dele
    // na turma tem `profile_id` nulo, e fica de fora da lista.
    const destinatarios = new Set(
      [
        ...((professoresRes.data ?? []) as { profile_id: string | null }[]).map((p) => p.profile_id),
        ...((coordenadoresRes.data ?? []) as { profile_id: string }[]).map((c) => c.profile_id),
      ].filter((id): id is string => id !== null)
    )

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
