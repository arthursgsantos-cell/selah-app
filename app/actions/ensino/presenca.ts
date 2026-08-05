'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { acessoEnsino, podeLecionar } from '@/lib/ensino/permissoes'
import type { ResultadoAcao } from '@/lib/ensino/tipos'

/**
 * Registra a presença de um aluno numa aula.
 *
 * Esta é a ação que a tela de chamada dispara a cada toque — o salvamento é por
 * aluno, não por "salvar tudo no fim". Se o professor fechar a aba, sair do
 * app ou perder o sinal no meio da chamada, o que já foi marcado está gravado.
 *
 * O upsert usa a chave única (aula, inscrição): tocar duas vezes corrige o
 * registro em vez de criar um segundo. É o mesmo motivo de a correção posterior
 * funcionar sem nenhum código extra — remarcar é só outro upsert.
 */
export async function marcarPresencaAction(params: {
  aulaId: string
  inscricaoId: string
  presente: boolean
  observacao?: string | null
}): Promise<{ ok: true; registradoEm: string } | { ok: false; erro: string }> {
  const acesso = await acessoEnsino()
  if (!acesso) return { ok: false, erro: 'Não autenticado.' }

  const admin = createAdminClient()

  const { data: aula } = await admin
    .from('ensino_aulas')
    .select('id, turma_id')
    .eq('id', params.aulaId)
    .single()

  if (!aula) return { ok: false, erro: 'Aula não encontrada.' }
  if (!(await podeLecionar(acesso, aula.turma_id))) {
    return { ok: false, erro: 'Você não faz a chamada desta turma.' }
  }

  // A inscrição precisa ser mesmo daquela turma: sem esta conferência, um id de
  // inscrição de outra turma entraria na chamada desta.
  const { data: inscricao } = await admin
    .from('ensino_inscricoes')
    .select('id, user_id, turma_id, status')
    .eq('id', params.inscricaoId)
    .single()

  if (!inscricao || inscricao.turma_id !== aula.turma_id) {
    return { ok: false, erro: 'Este aluno não pertence a esta turma.' }
  }

  const registradoEm = new Date().toISOString()

  const { error } = await admin.from('ensino_presencas').upsert(
    {
      aula_id: params.aulaId,
      inscricao_id: params.inscricaoId,
      user_id: inscricao.user_id,
      presente: params.presente,
      observacao: params.observacao?.trim() || null,
      registrado_por: acesso.userId,
      registrado_em: registradoEm,
    },
    { onConflict: 'aula_id,inscricao_id' }
  )

  if (error) return { ok: false, erro: error.message }

  // A aula passa a "realizada" na primeira marcação: poupa o professor de um
  // segundo passo, e é o que faz a aula entrar no cálculo de frequência.
  await admin
    .from('ensino_aulas')
    .update({ status: 'realizada' })
    .eq('id', params.aulaId)
    .eq('status', 'agendada')

  revalidatePath(`/ensino/turma/${aula.turma_id}/presencas`)
  revalidatePath('/ensino/aluno')
  return { ok: true, registradoEm }
}

/** Marca a turma inteira de uma vez — o atalho de "todos presentes". */
export async function marcarTodosAction(params: {
  aulaId: string
  presente: boolean
}): Promise<{ ok: true; total: number } | { ok: false; erro: string }> {
  const acesso = await acessoEnsino()
  if (!acesso) return { ok: false, erro: 'Não autenticado.' }

  const admin = createAdminClient()

  const { data: aula } = await admin
    .from('ensino_aulas')
    .select('id, turma_id')
    .eq('id', params.aulaId)
    .single()

  if (!aula) return { ok: false, erro: 'Aula não encontrada.' }
  if (!(await podeLecionar(acesso, aula.turma_id))) {
    return { ok: false, erro: 'Você não faz a chamada desta turma.' }
  }

  const { data: inscricoes } = await admin
    .from('ensino_inscricoes')
    .select('id, user_id')
    .eq('turma_id', aula.turma_id)
    .in('status', ['aprovada', 'concluida'])

  if (!inscricoes?.length) return { ok: false, erro: 'Nenhum aluno aprovado nesta turma.' }

  const registradoEm = new Date().toISOString()
  const { error } = await admin.from('ensino_presencas').upsert(
    inscricoes.map((i) => ({
      aula_id: params.aulaId,
      inscricao_id: i.id,
      user_id: i.user_id,
      presente: params.presente,
      registrado_por: acesso.userId,
      registrado_em: registradoEm,
    })),
    { onConflict: 'aula_id,inscricao_id' }
  )

  if (error) return { ok: false, erro: error.message }

  await admin
    .from('ensino_aulas')
    .update({ status: 'realizada' })
    .eq('id', params.aulaId)
    .eq('status', 'agendada')

  revalidatePath(`/ensino/turma/${aula.turma_id}/presencas`)
  return { ok: true, total: inscricoes.length }
}

export interface LinhaChamada {
  inscricaoId: string
  userId: string
  nome: string
  avatarUrl: string | null
  presente: boolean | null
  registradoEm: string | null
}

/**
 * A lista de chamada de uma aula: alunos aprovados e o que já foi marcado.
 * `presente: null` = ainda não passou por ela.
 */
export async function listaDaChamada(aulaId: string): Promise<LinhaChamada[]> {
  const acesso = await acessoEnsino()
  if (!acesso) return []

  const admin = createAdminClient()
  const { data: aula } = await admin
    .from('ensino_aulas')
    .select('turma_id')
    .eq('id', aulaId)
    .single()

  if (!aula || !(await podeLecionar(acesso, aula.turma_id))) return []

  const [inscricoesRes, presencasRes] = await Promise.all([
    admin
      .from('ensino_inscricoes')
      // FK nomeada: `user_id` e `decidido_por` apontam para `profiles`, e sem
      // desambiguar o PostgREST recusa a consulta e a chamada vem vazia.
      .select('id, user_id, nome, profiles!ensino_inscricoes_user_id_fkey(avatar_url)')
      .eq('turma_id', aula.turma_id)
      .in('status', ['aprovada', 'concluida'])
      .order('nome'),
    admin
      .from('ensino_presencas')
      .select('inscricao_id, presente, registrado_em')
      .eq('aula_id', aulaId),
  ])

  const porInscricao = new Map(
    (presencasRes.data ?? []).map((p) => [p.inscricao_id, p])
  )

  return ((inscricoesRes.data ?? []) as unknown as {
    id: string
    user_id: string
    nome: string
    profiles: { avatar_url: string | null } | null
  }[]).map((i) => {
    const p = porInscricao.get(i.id)
    return {
      inscricaoId: i.id,
      userId: i.user_id,
      nome: i.nome,
      avatarUrl: i.profiles?.avatar_url ?? null,
      presente: p ? p.presente : null,
      registradoEm: p?.registrado_em ?? null,
    }
  })
}

/** Apaga o registro, devolvendo o aluno ao estado "não marcado". */
export async function limparPresencaAction(params: {
  aulaId: string
  inscricaoId: string
}): Promise<ResultadoAcao> {
  const acesso = await acessoEnsino()
  if (!acesso) return { ok: false, erro: 'Não autenticado.' }

  const admin = createAdminClient()
  const { data: aula } = await admin
    .from('ensino_aulas')
    .select('turma_id')
    .eq('id', params.aulaId)
    .single()

  if (!aula) return { ok: false, erro: 'Aula não encontrada.' }
  if (!(await podeLecionar(acesso, aula.turma_id))) {
    return { ok: false, erro: 'Você não faz a chamada desta turma.' }
  }

  const { error } = await admin
    .from('ensino_presencas')
    .delete()
    .eq('aula_id', params.aulaId)
    .eq('inscricao_id', params.inscricaoId)

  if (error) return { ok: false, erro: error.message }
  return { ok: true }
}
