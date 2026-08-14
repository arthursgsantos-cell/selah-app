'use server'

/**
 * Cobrança das turmas: valor, parcelas e pagamentos recebidos.
 *
 * Quem mexe é a coordenação. Professor dá aula; dinheiro é assunto da
 * secretaria — a RLS em `supabase/migrations/ensino_pagamentos.sql` diz o
 * mesmo, e é ela quem recusa de verdade.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { acessoEnsino } from '@/lib/ensino/permissoes'
import type { ResultadoAcao } from '@/lib/ensino/tipos'
import type { ParcelaTurma, PagamentoEnsino } from '@/lib/ensino/cobranca'

async function coordenacao(): Promise<{ igrejaId: string; userId: string } | null> {
  const acesso = await acessoEnsino()
  if (!acesso?.coordenador) return null
  return { igrejaId: acesso.igrejaId, userId: acesso.userId }
}

/** A turma existe e é desta igreja? O id vem do formulário. */
async function turmaDaIgreja(turmaId: string, igrejaId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('ensino_turmas')
    .select('id')
    .eq('id', turmaId)
    .eq('igreja_id', igrejaId)
    .maybeSingle()
  return data !== null
}

export async function salvarCobrancaTurmaAction(params: {
  turmaId: string
  /** Nulo ou zero deixa a turma gratuita. */
  valor: number | null
  instrucoes: string | null
  parcelas: { vencimento: string; percentual: number | null }[]
}): Promise<ResultadoAcao> {
  const dir = await coordenacao()
  if (!dir) return { ok: false, erro: 'Só a coordenação do Ensino mexe em valores.' }
  if (!(await turmaDaIgreja(params.turmaId, dir.igrejaId))) {
    return { ok: false, erro: 'Turma não encontrada.' }
  }

  if (params.valor != null && params.valor < 0) {
    return { ok: false, erro: 'O valor não pode ser negativo.' }
  }

  // Percentuais só valem se fecharem 100% — senão a soma das parcelas não bate
  // com o total e o aluno fica devendo (ou pagando) uma diferença fantasma.
  const comPercentual = params.parcelas.filter((p) => p.percentual != null)
  if (comPercentual.length > 0 && comPercentual.length === params.parcelas.length) {
    const soma = comPercentual.reduce((a, p) => a + (p.percentual ?? 0), 0)
    if (Math.abs(soma - 100) > 0.01) {
      return { ok: false, erro: `Os percentuais somam ${soma}%. Precisa fechar 100%.` }
    }
  }

  const admin = createAdminClient()

  const { error: erroTurma } = await admin
    .from('ensino_turmas')
    .update({
      valor: params.valor && params.valor > 0 ? params.valor : null,
      pagamento_instrucoes: params.instrucoes?.trim() || null,
    } as never)
    .eq('id', params.turmaId)
  if (erroTurma) return { ok: false, erro: erroTurma.message }

  // O plano é substituído inteiro: editar parcela a parcela deixaria órfã a
  // que a coordenação apagou na tela.
  const { error: erroDelete } = await admin
    .from('ensino_turma_parcelas')
    .delete()
    .eq('turma_id', params.turmaId)
  if (erroDelete) return { ok: false, erro: erroDelete.message }

  const validas = params.parcelas.filter((p) => p.vencimento)
  if (validas.length > 0) {
    const { error } = await admin.from('ensino_turma_parcelas').insert(
      validas.map((p, i) => ({
        turma_id: params.turmaId,
        numero: i + 1,
        vencimento: p.vencimento,
        percentual: p.percentual,
      })) as never
    )
    if (error) return { ok: false, erro: error.message }
  }

  revalidarTurma(params.turmaId)
  return { ok: true }
}

export async function buscarCobrancaTurmaAction(turmaId: string): Promise<{
  valor: number | null
  instrucoes: string | null
  parcelas: ParcelaTurma[]
}> {
  const admin = createAdminClient()
  const [{ data: turma }, { data: parcelas }] = await Promise.all([
    admin.from('ensino_turmas').select('valor, pagamento_instrucoes').eq('id', turmaId).maybeSingle(),
    admin
      .from('ensino_turma_parcelas')
      .select('id, numero, vencimento, percentual')
      .eq('turma_id', turmaId)
      .order('numero'),
  ])

  const t = turma as { valor: number | null; pagamento_instrucoes: string | null } | null
  return {
    valor: t?.valor != null ? Number(t.valor) : null,
    instrucoes: t?.pagamento_instrucoes ?? null,
    parcelas: (parcelas ?? []) as ParcelaTurma[],
  }
}

/** Lançamento de um pagamento recebido — o app é o livro-caixa da secretaria. */
export async function registrarPagamentoEnsinoAction(params: {
  inscricaoId: string
  turmaId: string
  valor: number
  pagoEm: string
  metodo?: string | null
  observacao?: string | null
}): Promise<ResultadoAcao> {
  const dir = await coordenacao()
  if (!dir) return { ok: false, erro: 'Só a coordenação do Ensino registra pagamentos.' }
  if (!(params.valor > 0)) return { ok: false, erro: 'O valor precisa ser maior que zero.' }
  if (!(await turmaDaIgreja(params.turmaId, dir.igrejaId))) {
    return { ok: false, erro: 'Turma não encontrada.' }
  }

  const admin = createAdminClient()

  // A inscrição precisa ser desta turma: sem a checagem, um id de outra turma
  // lançaria o pagamento no lugar errado.
  const { data: inscricao } = await admin
    .from('ensino_inscricoes')
    .select('id')
    .eq('id', params.inscricaoId)
    .eq('turma_id', params.turmaId)
    .maybeSingle()
  if (!inscricao) return { ok: false, erro: 'Inscrição não encontrada nesta turma.' }

  const { error } = await admin.from('ensino_pagamentos').insert({
    inscricao_id: params.inscricaoId,
    valor: params.valor,
    pago_em: params.pagoEm,
    metodo: params.metodo?.trim() || 'pix',
    observacao: params.observacao?.trim() || null,
    registrado_por: dir.userId,
  } as never)
  if (error) return { ok: false, erro: error.message }

  revalidarTurma(params.turmaId)
  return { ok: true }
}

export async function removerPagamentoEnsinoAction(
  pagamentoId: string,
  turmaId: string
): Promise<ResultadoAcao> {
  const dir = await coordenacao()
  if (!dir) return { ok: false, erro: 'Sem permissão.' }
  if (!(await turmaDaIgreja(turmaId, dir.igrejaId))) {
    return { ok: false, erro: 'Turma não encontrada.' }
  }

  const admin = createAdminClient()
  const { error } = await admin.from('ensino_pagamentos').delete().eq('id', pagamentoId)
  if (error) return { ok: false, erro: error.message }

  revalidarTurma(turmaId)
  return { ok: true }
}

/**
 * Valor combinado com um aluno: bolsa, meia, isenção do obreiro.
 * `null` devolve a pessoa ao valor cheio da turma.
 */
export async function definirValorAlunoAction(params: {
  inscricaoId: string
  turmaId: string
  valor: number | null
}): Promise<ResultadoAcao> {
  const dir = await coordenacao()
  if (!dir) return { ok: false, erro: 'Sem permissão.' }
  if (params.valor != null && params.valor < 0) {
    return { ok: false, erro: 'O valor não pode ser negativo.' }
  }
  if (!(await turmaDaIgreja(params.turmaId, dir.igrejaId))) {
    return { ok: false, erro: 'Turma não encontrada.' }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('ensino_inscricoes')
    .update({ valor_combinado: params.valor } as never)
    .eq('id', params.inscricaoId)
    .eq('turma_id', params.turmaId)
  if (error) return { ok: false, erro: error.message }

  revalidarTurma(params.turmaId)
  return { ok: true }
}

/** Extrato de um aluno — usado pelo painel ao abrir a linha da pessoa. */
export async function pagamentosDaInscricaoAction(
  inscricaoId: string
): Promise<PagamentoEnsino[]> {
  const dir = await coordenacao()
  if (!dir) return []

  const admin = createAdminClient()
  const { data } = await admin
    .from('ensino_pagamentos')
    .select('id, valor, pago_em, metodo, observacao')
    .eq('inscricao_id', inscricaoId)
    .order('pago_em')

  return ((data ?? []) as PagamentoEnsino[]).map((p) => ({ ...p, valor: Number(p.valor) }))
}

function revalidarTurma(turmaId: string) {
  revalidatePath(`/ensino/turma/${turmaId}`)
  revalidatePath(`/ensino/turma/${turmaId}/financeiro`)
  revalidatePath('/ensino/admin')
}
