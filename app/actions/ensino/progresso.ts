'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { acessoEnsino } from '@/lib/ensino/permissoes'
import type { ResultadoAcao } from '@/lib/ensino/tipos'

/**
 * O "assisti" do aluno numa aula gravada.
 *
 * Ao contrário da chamada, quem escreve aqui é o próprio aluno — e por isso
 * tudo passa pelo **cliente do usuário**, não pelo admin: a policy
 * `ensino_progresso_insert` (`user_id = auth.uid() and ensino_inscrito(...)`) é
 * quem autoriza. Nenhuma conferência daqui é a barreira; o banco é.
 *
 * Progresso e presença são fatos diferentes sobre a mesma aula e moram em
 * tabelas diferentes de propósito: presença é o professor afirmando que a
 * pessoa esteve lá, progresso é a pessoa dizendo que viu o vídeo. Misturar os
 * dois faria a frequência de uma turma presencial subir sozinha.
 */
export async function marcarAulaConcluidaAction(params: {
  aulaId: string
  concluida: boolean
}): Promise<ResultadoAcao> {
  const acesso = await acessoEnsino()
  if (!acesso) return { ok: false, erro: 'Não autenticado.' }

  const supabase = await createClient()

  const { data: aula } = await supabase
    .from('ensino_aulas')
    .select('id, numero, turma_id')
    .eq('id', params.aulaId)
    .maybeSingle()

  if (!aula) return { ok: false, erro: 'Aula não encontrada.' }

  if (!params.concluida) {
    const { error } = await supabase
      .from('ensino_progresso')
      .delete()
      .eq('aula_id', aula.id)
      .eq('user_id', acesso.userId)

    if (error) return { ok: false, erro: error.message }
    return revalidar(aula.turma_id, aula.numero)
  }

  // Turma sequencial: a aula N só fecha com as anteriores fechadas. A trava
  // vive aqui, e não só no botão desabilitado — senão bastaria abrir o
  // endereço da aula seguinte para pular a fila.
  const { data: turma } = await supabase
    .from('ensino_turmas')
    .select('sequencial')
    .eq('id', aula.turma_id)
    .maybeSingle()

  if (turma?.sequencial) {
    const [anterioresRes, concluidasRes] = await Promise.all([
      supabase
        .from('ensino_aulas')
        .select('id', { count: 'exact', head: true })
        .eq('turma_id', aula.turma_id)
        .lt('numero', aula.numero),
      supabase
        .from('ensino_progresso')
        .select('aula_id', { count: 'exact', head: true })
        .eq('turma_id', aula.turma_id)
        .eq('user_id', acesso.userId),
    ])

    // Comparar contagens basta: o progresso só existe para aulas já liberadas,
    // então "concluí todas as anteriores" é o mesmo que "concluí N-1 aulas".
    if ((concluidasRes.count ?? 0) < (anterioresRes.count ?? 0)) {
      return { ok: false, erro: 'Conclua a aula anterior para liberar esta.' }
    }
  }

  const { error } = await supabase.from('ensino_progresso').upsert(
    {
      aula_id: aula.id,
      user_id: acesso.userId,
      turma_id: aula.turma_id,
      concluida_em: new Date().toISOString(),
    },
    { onConflict: 'aula_id,user_id' }
  )

  if (error) {
    // A policy recusa quem não está inscrito; a mensagem crua do Postgres não
    // diria isso a ninguém.
    return {
      ok: false,
      erro: error.code === '42501'
        ? 'Você precisa estar inscrito nesta turma.'
        : error.message,
    }
  }

  return revalidar(aula.turma_id, aula.numero)
}

function revalidar(turmaId: string, numero: number): ResultadoAcao {
  revalidatePath(`/ensino/turma/${turmaId}/aula/${numero}`)
  revalidatePath(`/ensino/turma/${turmaId}`)
  revalidatePath('/ensino/aluno')
  return { ok: true }
}
