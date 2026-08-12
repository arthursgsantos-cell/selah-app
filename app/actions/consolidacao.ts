'use server'

/**
 * Consolidação — cadastro, atribuição e registro de contato.
 *
 * Ver `lib/consolidacao.ts` para o modelo de acesso e
 * `supabase/migrations/consolidacao.sql` para as policies que o banco aplica
 * por baixo destas actions.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { acessoConsolidacao } from '@/lib/consolidacao-servidor'
import type {
  CanalContato, DecisaoConsolidacao, EtapaConsolidacao, OrigemConsolidacao,
  ResultadoContato,
} from '@/lib/supabase/types'

export interface DadosFicha {
  nome: string
  telefone: string | null
  origem: OrigemConsolidacao
  decisao: DecisaoConsolidacao | null
  celulaId: string | null
  responsavelId: string | null
  observacao: string | null
  dataAcolhimento: string
}

/**
 * Confere se a pessoa logada pode mexer NESTA ficha.
 *
 * O acesso geral (`acessoConsolidacao`) diz o que ela enxerga; aqui a pergunta
 * é sobre uma linha específica, e por isso a ficha é lida antes.
 */
async function podeMexer(fichaId: string) {
  const acesso = await acessoConsolidacao()
  if (!acesso) return null

  const admin = createAdminClient()
  const { data: ficha } = await admin
    .from('consolidacao')
    .select('id, igreja_id, celula_id, responsavel_id')
    .eq('id', fichaId)
    .maybeSingle()

  if (!ficha || ficha.igreja_id !== acesso.igrejaId) return null

  const permitido =
    acesso.direcao ||
    ficha.responsavel_id === acesso.userId ||
    (ficha.celula_id !== null && acesso.celulaIds.includes(ficha.celula_id))

  return permitido ? { acesso, ficha } : null
}

function revalidar() {
  revalidatePath('/consolidacao')
  revalidatePath('/pastor')
  revalidatePath('/supervisor')
}

export async function criarFichaAction(
  dados: DadosFicha
): Promise<{ ok: true; id: string } | { ok: false; erro: string }> {
  const acesso = await acessoConsolidacao()
  if (!acesso || !acesso.podeAcolher) return { ok: false, erro: 'Sem permissão para acolher.' }
  if (!dados.nome.trim()) return { ok: false, erro: 'Informe o nome da pessoa.' }

  const admin = createAdminClient()

  // A célula precisa ser da própria igreja — sem isso, um id vindo na mão
  // penduraria a ficha na célula de outra congregação.
  if (dados.celulaId) {
    const { data: celula } = await admin
      .from('celulas')
      .select('id, redes(igreja_id)')
      .eq('id', dados.celulaId)
      .maybeSingle()
    const daIgreja = (celula as unknown as { redes: { igreja_id: string } | null } | null)
      ?.redes?.igreja_id
    if (daIgreja !== acesso.igrejaId) {
      return { ok: false, erro: 'Esta célula não é da sua igreja.' }
    }
  }

  // Ter responsável já é o que separa "acolhido" de "atribuído": a etapa segue
  // o fato, em vez de pedir que alguém a escolha na mão.
  const etapa: EtapaConsolidacao = dados.responsavelId ? 'atribuido' : 'acolhido'

  const { data, error } = await admin
    .from('consolidacao')
    .insert({
      igreja_id: acesso.igrejaId,
      nome: dados.nome.trim(),
      telefone: dados.telefone?.trim() || null,
      origem: dados.origem,
      decisao: dados.decisao,
      celula_id: dados.celulaId,
      responsavel_id: dados.responsavelId,
      etapa,
      observacao: dados.observacao?.trim() || null,
      data_acolhimento: dados.dataAcolhimento,
      criado_por: acesso.userId,
    })
    .select('id')
    .single()

  if (error || !data) return { ok: false, erro: error?.message ?? 'Não foi possível salvar.' }

  revalidar()
  return { ok: true, id: data.id }
}

export async function atualizarFichaAction(
  id: string,
  dados: {
    etapa?: EtapaConsolidacao
    celulaId?: string | null
    responsavelId?: string | null
    observacao?: string | null
  }
): Promise<{ ok: boolean; erro?: string }> {
  const permissao = await podeMexer(id)
  if (!permissao) return { ok: false, erro: 'Sem permissão para esta ficha.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('consolidacao')
    .update({
      ...(dados.etapa !== undefined ? { etapa: dados.etapa } : {}),
      ...(dados.celulaId !== undefined ? { celula_id: dados.celulaId } : {}),
      ...(dados.responsavelId !== undefined ? { responsavel_id: dados.responsavelId } : {}),
      ...(dados.observacao !== undefined
        ? { observacao: dados.observacao?.trim() || null }
        : {}),
      atualizado_em: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return { ok: false, erro: error.message }

  revalidar()
  return { ok: true }
}

export async function registrarContatoAction(
  fichaId: string,
  dados: {
    canal: CanalContato
    resultado: ResultadoContato
    nota: string | null
    data: string
  }
): Promise<{ ok: boolean; erro?: string }> {
  const permissao = await podeMexer(fichaId)
  if (!permissao) return { ok: false, erro: 'Sem permissão para esta ficha.' }

  const admin = createAdminClient()
  const { error } = await admin.from('consolidacao_contatos').insert({
    consolidacao_id: fichaId,
    autor_id: permissao.acesso.userId,
    canal: dados.canal,
    resultado: dados.resultado,
    nota: dados.nota?.trim() || null,
    data: dados.data,
  })

  if (error) return { ok: false, erro: error.message }

  // O primeiro contato de verdade tira a ficha de "atribuído" e a põe em
  // acompanhamento. Só avança daí para frente: quem já foi integrado não
  // volta para trás por causa de um telefonema.
  const { data: atual } = await admin
    .from('consolidacao')
    .select('etapa')
    .eq('id', fichaId)
    .maybeSingle()

  const etapaAtual = (atual as { etapa: EtapaConsolidacao } | null)?.etapa
  if (etapaAtual === 'acolhido' || etapaAtual === 'atribuido') {
    await admin
      .from('consolidacao')
      .update({ etapa: 'em_acompanhamento', atualizado_em: new Date().toISOString() })
      .eq('id', fichaId)
  }

  revalidar()
  return { ok: true }
}

export async function excluirFichaAction(
  id: string
): Promise<{ ok: boolean; erro?: string }> {
  const acesso = await acessoConsolidacao()
  // Apagar ficha é reescrever história de acompanhamento — mesma régua da
  // policy do banco: só a direção.
  if (!acesso || !acesso.direcao) return { ok: false, erro: 'Sem permissão.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('consolidacao')
    .delete()
    .eq('id', id)
    .eq('igreja_id', acesso.igrejaId)

  if (error) return { ok: false, erro: error.message }

  revalidar()
  return { ok: true }
}
