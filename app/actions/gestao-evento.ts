'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { exigirGestaoDoEvento } from '@/lib/eventos-permissoes'

/** O mesmo teto do bucket `evento-comprovantes`. */
const TAMANHO_MAXIMO = 10 * 1024 * 1024
const BUCKET_COMPROVANTES = 'evento-comprovantes'

const STATUS_VALIDOS = ['pendente', 'confirmado', 'cancelado']

function revalidar(eventoId: string) {
  revalidatePath(`/inscricoes/${eventoId}`)
  revalidatePath(`/evento/${eventoId}`)
}

/** Converte "1.234,56" ou "1234.56" no número que o banco espera. */
function paraValor(entrada: FormDataEntryValue | null): number | null {
  const texto = String(entrada ?? '').trim()
  if (!texto) return null
  const numero = Number(texto.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(numero) ? numero : null
}

// ── Inscritos ─────────────────────────────────────────────────────────────

/**
 * Cadastra à mão quem se inscreveu por fora do app.
 *
 * É o caso mais comum fora do formulário: a pessoa falou com o organizador no
 * WhatsApp ou no corredor da igreja. A ficha nasce com `origem = 'manual'`,
 * o que a distingue de quem preencheu o formulário — essa não deve ser editada
 * por engano.
 */
export async function adicionarInscritoAction(dados: {
  eventoId: string
  nome: string
  telefone?: string | null
  valorTotal?: number | null
  status?: string
  observacao?: string | null
}) {
  await exigirGestaoDoEvento(dados.eventoId)

  const nome = dados.nome.trim()
  if (!nome) throw new Error('Informe o nome de quem está se inscrevendo.')

  const status = dados.status ?? 'confirmado'
  if (!STATUS_VALIDOS.includes(status)) throw new Error('Status inválido.')

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('inscricoes_evento')
    .insert({
      evento_id: dados.eventoId,
      nome,
      telefone: dados.telefone?.trim() || null,
      valor_total: dados.valorTotal ?? null,
      status,
      observacao: dados.observacao?.trim() || null,
      origem: 'manual',
      dados: {},
    } as never)
    .select('id')
    .single()

  if (error) throw new Error(error.message)

  revalidar(dados.eventoId)
  return { id: (data as { id: string }).id }
}

/** Corrige os dados de uma ficha: nome, contato, valor, status ou anotação. */
export async function atualizarInscritoAction(dados: {
  inscricaoId: string
  eventoId: string
  nome?: string
  telefone?: string | null
  valorTotal?: number | null
  status?: string
  observacao?: string | null
}) {
  await exigirGestaoDoEvento(dados.eventoId)

  if (dados.status && !STATUS_VALIDOS.includes(dados.status)) {
    throw new Error('Status inválido.')
  }
  if (dados.nome !== undefined && !dados.nome.trim()) {
    throw new Error('O nome não pode ficar em branco.')
  }

  // Só o que veio na chamada é gravado: a tela edita um campo de cada vez.
  const alteracoes: Record<string, unknown> = {}
  if (dados.nome !== undefined) alteracoes.nome = dados.nome.trim()
  if (dados.telefone !== undefined) alteracoes.telefone = dados.telefone?.trim() || null
  if (dados.valorTotal !== undefined) alteracoes.valor_total = dados.valorTotal
  if (dados.status !== undefined) alteracoes.status = dados.status
  if (dados.observacao !== undefined) alteracoes.observacao = dados.observacao?.trim() || null

  if (Object.keys(alteracoes).length === 0) return

  const admin = createAdminClient()
  const { error } = await admin
    .from('inscricoes_evento')
    .update(alteracoes as never)
    .eq('id', dados.inscricaoId)
    .eq('evento_id', dados.eventoId)

  if (error) throw new Error(error.message)
  revalidar(dados.eventoId)
}

/**
 * Apaga uma ficha e tudo que pende dela.
 *
 * Os pagamentos somem junto (cascade no banco), então os comprovantes ficariam
 * órfãos no bucket — por isso os arquivos são removidos antes.
 */
export async function removerInscritoAction(inscricaoId: string, eventoId: string) {
  await exigirGestaoDoEvento(eventoId)

  const admin = createAdminClient()

  const { data: pagamentos } = await admin
    .from('inscricao_pagamentos')
    .select('comprovante_path')
    .eq('inscricao_id', inscricaoId)

  const arquivos = ((pagamentos ?? []) as { comprovante_path: string | null }[])
    .map((p) => p.comprovante_path)
    .filter(Boolean) as string[]

  if (arquivos.length > 0) {
    await admin.storage.from(BUCKET_COMPROVANTES).remove(arquivos)
  }

  const { error } = await admin
    .from('inscricoes_evento')
    .delete()
    .eq('id', inscricaoId)
    .eq('evento_id', eventoId)

  if (error) throw new Error(error.message)
  revalidar(eventoId)
}

// ── Pagamentos ────────────────────────────────────────────────────────────

/**
 * Lança um pagamento recebido, com comprovante opcional.
 *
 * Vem como `FormData` por causa do arquivo: server action com objeto simples
 * tem teto de 1 MB de corpo, e uma foto de comprovante passa disso fácil.
 */
export async function lancarPagamentoAction(formData: FormData) {
  const eventoId = String(formData.get('eventoId') ?? '')
  const inscricaoId = String(formData.get('inscricaoId') ?? '')
  if (!eventoId || !inscricaoId) throw new Error('Pagamento sem inscrição.')

  const acesso = await exigirGestaoDoEvento(eventoId)

  const valor = paraValor(formData.get('valor'))
  if (valor === null || !(valor > 0)) throw new Error('Informe um valor maior que zero.')

  const pagoEm = String(formData.get('pagoEm') ?? '').trim() || new Date().toISOString().split('T')[0]
  const metodo = String(formData.get('metodo') ?? '').trim() || 'pix'
  const observacao = String(formData.get('observacao') ?? '').trim() || null

  const admin = createAdminClient()

  let comprovantePath: string | null = null
  let comprovanteNome: string | null = null

  const arquivo = formData.get('comprovante')
  if (arquivo instanceof File && arquivo.size > 0) {
    if (arquivo.size > TAMANHO_MAXIMO) {
      throw new Error('O comprovante passa de 10 MB. Envie uma foto menor ou o PDF do banco.')
    }

    // Prefixado pelo evento para a listagem do bucket já vir separada, e com
    // timestamp para dois envios do mesmo arquivo não se sobrescreverem.
    const seguro = arquivo.name.replace(/[^\w.\-]+/g, '_').slice(-80)
    comprovantePath = `${eventoId}/${inscricaoId}/${Date.now()}-${seguro}`
    comprovanteNome = arquivo.name

    const { error: erroUpload } = await admin.storage
      .from(BUCKET_COMPROVANTES)
      .upload(comprovantePath, arquivo, {
        contentType: arquivo.type || 'application/octet-stream',
        upsert: false,
      })

    if (erroUpload) throw new Error(`Falha ao enviar o comprovante: ${erroUpload.message}`)
  }

  const { data, error } = await admin
    .from('inscricao_pagamentos')
    .insert({
      inscricao_id: inscricaoId,
      valor,
      pago_em: pagoEm,
      metodo,
      observacao,
      comprovante_path: comprovantePath,
      comprovante_nome: comprovanteNome,
      registrado_por: acesso.userId,
    } as never)
    .select('id')
    .single()

  if (error) {
    // Sem a linha, o arquivo ficaria no bucket sem nada que o referencie.
    if (comprovantePath) await admin.storage.from(BUCKET_COMPROVANTES).remove([comprovantePath])
    throw new Error(error.message)
  }

  revalidar(eventoId)

  // O id volta para a tela poder abrir o comprovante recém-enviado sem
  // recarregar a página.
  return { id: (data as { id: string }).id }
}

/** Estorna um lançamento — apaga a linha e o comprovante junto. */
export async function excluirPagamentoAction(pagamentoId: string, eventoId: string) {
  await exigirGestaoDoEvento(eventoId)

  const admin = createAdminClient()

  const { data: pagamento } = await admin
    .from('inscricao_pagamentos')
    .select('comprovante_path')
    .eq('id', pagamentoId)
    .maybeSingle()

  const path = (pagamento as { comprovante_path: string | null } | null)?.comprovante_path
  if (path) await admin.storage.from(BUCKET_COMPROVANTES).remove([path])

  const { error } = await admin.from('inscricao_pagamentos').delete().eq('id', pagamentoId)
  if (error) throw new Error(error.message)

  revalidar(eventoId)
}

// ── Organizadores ─────────────────────────────────────────────────────────

/** Dá a outra pessoa o direito de gerenciar as inscrições deste evento. */
export async function adicionarOrganizadorAction(eventoId: string, userId: string) {
  const acesso = await exigirGestaoDoEvento(eventoId)
  if (!acesso.podeDelegar) {
    throw new Error('Só quem criou o evento (ou a supervisão) pode escolher os organizadores.')
  }

  const admin = createAdminClient()
  const { error } = await admin.from('evento_organizadores').insert({
    evento_id: eventoId,
    user_id: userId,
    criado_por: acesso.userId,
  } as never)

  // Chamar duas vezes a mesma pessoa não é erro para quem está na tela.
  if (error && !error.message.includes('duplicate')) throw new Error(error.message)
  revalidar(eventoId)
}

export async function removerOrganizadorAction(eventoId: string, userId: string) {
  const acesso = await exigirGestaoDoEvento(eventoId)
  if (!acesso.podeDelegar) {
    throw new Error('Só quem criou o evento (ou a supervisão) pode escolher os organizadores.')
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('evento_organizadores')
    .delete()
    .eq('evento_id', eventoId)
    .eq('user_id', userId)

  if (error) throw new Error(error.message)
  revalidar(eventoId)
}
