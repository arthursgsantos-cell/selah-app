'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

const CARGOS_EDICAO = ['admin', 'pastor', 'supervisor', 'supervisor_treinamento', 'lider']

async function exigirPermissao() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!CARGOS_EDICAO.includes(profile?.role ?? '')) throw new Error('Sem permissão')
  return user
}

export async function salvarDescricaoEventoAction(eventoId: string, descricao: string) {
  await exigirPermissao()

  const admin = createAdminClient()
  const { error } = await admin
    .from('eventos')
    .update({ descricao: descricao.trim() || null } as never)
    .eq('id', eventoId)
  if (error) throw new Error(error.message)

  revalidarEvento(eventoId)
}

/**
 * Capa exclusiva da página do evento. Fica separada de `imagem_url`, que é o
 * card que circula no WhatsApp e aparece nas listagens: trocar uma não mexe
 * na outra.
 */
export async function salvarCapaPaginaEventoAction(
  eventoId: string,
  formData: FormData
): Promise<string> {
  await exigirPermissao()

  const url = await subirImagem(formData, 'evento-capas', `pagina/${eventoId}`)

  const admin = createAdminClient()
  const { error } = await admin
    .from('eventos')
    .update({ capa_pagina_url: url } as never)
    .eq('id', eventoId)
  if (error) throw new Error(error.message)

  revalidarEvento(eventoId)
  return url
}

/** Volta a usar o card do evento como capa da página. */
export async function removerCapaPaginaEventoAction(eventoId: string) {
  await exigirPermissao()

  const admin = createAdminClient()
  const { error } = await admin
    .from('eventos')
    .update({ capa_pagina_url: null } as never)
    .eq('id', eventoId)
  if (error) throw new Error(error.message)

  revalidarEvento(eventoId)
}

export async function atualizarFundoEventoAction(
  eventoId: string,
  aparencia: {
    cor: string
    cor_secundaria: string
    fundo_tipo: string | null
    fundo_opacidade?: number
  }
) {
  await exigirPermissao()

  const admin = createAdminClient()
  const { error } = await admin
    .from('eventos')
    .update({
      cor: aparencia.cor,
      cor_secundaria: aparencia.cor_secundaria,
      fundo_tipo: aparencia.fundo_tipo,
      ...(aparencia.fundo_opacidade === undefined
        ? {}
        : { fundo_opacidade: Math.min(100, Math.max(0, Math.round(aparencia.fundo_opacidade))) }),
    } as never)
    .eq('id', eventoId)
  if (error) throw new Error(error.message)

  revalidarEvento(eventoId)
}

/**
 * Coloca o evento em destaque na página inicial.
 *
 * Também revalida `/home`: é lá que o destaque aparece, e sem isso a mudança
 * só apareceria no próximo rebuild da home.
 */
export async function alternarDestaqueEventoAction(eventoId: string, destaque: boolean) {
  await exigirPermissao()

  const admin = createAdminClient()
  const { error } = await admin
    .from('eventos')
    .update({ destaque } as never)
    .eq('id', eventoId)
  if (error) throw new Error(error.message)

  revalidarEvento(eventoId)
  revalidatePath('/home')
}

/**
 * Liga/desliga as cores tiradas da capa. Ao desligar, `origem` é limpa para
 * que religar volte a extrair.
 */
export async function alternarAutoCorEventoAction(eventoId: string, ativo: boolean) {
  await exigirPermissao()

  const admin = createAdminClient()
  const { error } = await admin
    .from('eventos')
    .update({ fundo_auto_cor: ativo, ...(ativo ? {} : { fundo_auto_cor_origem: null }) } as never)
    .eq('id', eventoId)
  if (error) throw new Error(error.message)

  revalidarEvento(eventoId)
}

/** Grava as cores que o navegador extraiu da capa. */
export async function salvarAutoCorEventoAction(
  eventoId: string,
  cores: { cor: string; corSecundaria: string; origem: string }
) {
  await exigirPermissao()

  const hex = /^#[0-9a-f]{6}$/i
  if (!hex.test(cores.cor) || !hex.test(cores.corSecundaria)) throw new Error('Cor inválida')

  const admin = createAdminClient()
  const { error } = await admin
    .from('eventos')
    .update({
      cor: cores.cor,
      cor_secundaria: cores.corSecundaria,
      fundo_tipo: 'nebula',
      fundo_auto_cor_origem: cores.origem,
    } as never)
    .eq('id', eventoId)
  if (error) throw new Error(error.message)

  revalidarEvento(eventoId)
}

/**
 * Galeria no fundo. Separada de `atualizarFundoEventoAction` porque é uma
 * camada independente: convive com a cor, o degradê ou a nébula já escolhidos.
 */
export async function atualizarFundoGaleriaEventoAction(
  eventoId: string,
  data: { ativo: boolean; opacidade: number }
) {
  await exigirPermissao()

  const admin = createAdminClient()
  const { error } = await admin
    .from('eventos')
    .update({
      fundo_galeria: data.ativo,
      fundo_galeria_opacidade: Math.min(100, Math.max(0, Math.round(data.opacidade))),
    } as never)
    .eq('id', eventoId)
  if (error) throw new Error(error.message)

  revalidarEvento(eventoId)
}

export async function uploadFundoEventoAction(
  eventoId: string,
  formData: FormData
): Promise<string> {
  await exigirPermissao()

  const url = await subirImagem(formData, 'evento-capas', `fundo/${eventoId}`)

  const admin = createAdminClient()
  const { error } = await admin
    .from('eventos')
    .update({ fundo_imagem_url: url, fundo_tipo: 'imagem' } as never)
    .eq('id', eventoId)
  if (error) throw new Error(error.message)

  revalidarEvento(eventoId)
  return url
}

/** Pasta do Drive com os comprovantes, mostrada na página de acompanhamento. */
export async function salvarPastaComprovantesAction(eventoId: string, url: string) {
  await exigirPermissao()

  const limpa = url.trim()
  if (limpa && !/^https:\/\/drive\.google\.com\//i.test(limpa)) {
    throw new Error('Cole o link de uma pasta do Google Drive.')
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('eventos')
    .update({ comprovantes_pasta_url: limpa || null } as never)
    .eq('id', eventoId)
  if (error) throw new Error(error.message)

  revalidarEvento(eventoId)
}

/**
 * Planilha de respostas do Google Forms, para eventos com inscrição por link.
 * Precisa estar publicada na web (Arquivo → Compartilhar → Publicar na web):
 * é isso que permite ler sem credencial nenhuma.
 */
export async function salvarPlanilhaInscricoesAction(eventoId: string, url: string) {
  await exigirPermissao()

  const limpa = url.trim()
  if (limpa && !/^https:\/\/docs\.google\.com\/spreadsheets\//i.test(limpa)) {
    throw new Error('Cole o link da planilha publicada (começa com https://docs.google.com/spreadsheets/).')
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('eventos')
    .update({ inscricoes_planilha_url: limpa || null } as never)
    .eq('id', eventoId)
  if (error) throw new Error(error.message)

  revalidarEvento(eventoId)
}

export type BotaoEvento = { id: string; rotulo: string; url: string; ordem: number }

export async function salvarBotaoEventoAction(
  eventoId: string,
  secaoId: string,
  botao: { id?: string; rotulo: string; url: string; ordem?: number }
): Promise<BotaoEvento> {
  await exigirPermissao()

  const rotulo = botao.rotulo.trim()
  const url = botao.url.trim()
  if (!rotulo) throw new Error('Dê um nome ao botão')
  if (!/^https?:\/\//i.test(url)) throw new Error('O link precisa começar com http:// ou https://')

  const admin = createAdminClient()
  const registro = { evento_id: eventoId, secao_id: secaoId, rotulo, url, ordem: botao.ordem ?? 0 }

  const { data, error } = botao.id
    ? await admin.from('evento_botoes').update(registro as never).eq('id', botao.id).select('id, rotulo, url, ordem').single()
    : await admin.from('evento_botoes').insert(registro as never).select('id, rotulo, url, ordem').single()
  if (error) throw new Error(error.message)

  revalidarEvento(eventoId)
  return data as unknown as BotaoEvento
}

export async function removerBotaoEventoAction(botaoId: string, eventoId: string) {
  await exigirPermissao()

  const admin = createAdminClient()
  const { error } = await admin.from('evento_botoes').delete().eq('id', botaoId)
  if (error) throw new Error(error.message)

  revalidarEvento(eventoId)
}

/**
 * O cabeçalho de qualquer seção agora vive em `evento-secoes.ts`
 * (`salvarCabecalhoSecaoAction`), porque toda seção pode ter título próprio.
 */

export type CardEvento = {
  id: string
  titulo: string
  descricao: string | null
  imagem_url: string | null
  valor: number | null
  ordem: number
}

export async function salvarCardEventoAction(
  eventoId: string,
  secaoId: string,
  card: { id?: string; titulo: string; descricao: string; valor: string; ordem?: number }
): Promise<CardEvento> {
  await exigirPermissao()

  const titulo = card.titulo.trim()
  if (!titulo) throw new Error('Dê um título ao card')

  const admin = createAdminClient()
  const registro = {
    evento_id: eventoId,
    secao_id: secaoId,
    titulo,
    descricao: card.descricao.trim() || null,
    valor: valorNumerico(card.valor),
    ordem: card.ordem ?? 0,
  }

  const { data, error } = card.id
    ? await admin.from('evento_cards').update(registro as never).eq('id', card.id).select('id, titulo, descricao, imagem_url, valor, ordem').single()
    : await admin.from('evento_cards').insert(registro as never).select('id, titulo, descricao, imagem_url, valor, ordem').single()
  if (error) throw new Error(error.message)

  revalidarEvento(eventoId)
  return data as unknown as CardEvento
}

export async function salvarImagemCardEventoAction(
  cardId: string,
  eventoId: string,
  formData: FormData
): Promise<string> {
  await exigirPermissao()

  const url = await subirImagem(formData, 'evento-fotos', `${eventoId}/cards`)

  const admin = createAdminClient()
  const { error } = await admin
    .from('evento_cards')
    .update({ imagem_url: url } as never)
    .eq('id', cardId)
  if (error) throw new Error(error.message)

  revalidarEvento(eventoId)
  return url
}

export async function removerCardEventoAction(cardId: string, eventoId: string) {
  await exigirPermissao()

  const admin = createAdminClient()
  const { error } = await admin.from('evento_cards').delete().eq('id', cardId)
  if (error) throw new Error(error.message)

  revalidarEvento(eventoId)
}

/** "R$ 250,00", "250.00" ou "250" → 250. Vazio → null (card sem preço). */
function valorNumerico(bruto: string): number | null {
  const limpo = bruto.replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.')
  if (!limpo) return null
  const n = Number(limpo)
  return Number.isFinite(n) ? n : null
}

async function subirImagem(formData: FormData, bucket: string, prefixo: string): Promise<string> {
  const file = formData.get('file') as File
  if (!file) throw new Error('Arquivo não encontrado')

  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${prefixo}/${crypto.randomUUID()}.${ext}`

  const admin = createAdminClient()
  const { error } = await admin.storage
    .from(bucket)
    .upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false })
  if (error) throw new Error(error.message)

  return admin.storage.from(bucket).getPublicUrl(path).data.publicUrl
}

function revalidarEvento(eventoId: string) {
  revalidatePath(`/evento/${eventoId}`)
  revalidatePath('/eventos')
}

export async function adicionarFotoEventoAction(
  eventoId: string,
  secaoId: string,
  formData: FormData
): Promise<{ id: string; url: string }> {
  const user = await exigirPermissao()

  const file = formData.get('file') as File
  if (!file) throw new Error('Arquivo não encontrado')

  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${eventoId}/${crypto.randomUUID()}.${ext}`
  const buffer = await file.arrayBuffer()

  const admin = createAdminClient()
  const { error: erroUpload } = await admin.storage
    .from('evento-fotos')
    .upload(path, buffer, { contentType: file.type, upsert: false })
  if (erroUpload) throw new Error(erroUpload.message)

  const { data: { publicUrl } } = admin.storage.from('evento-fotos').getPublicUrl(path)

  const { data, error } = await admin
    .from('evento_fotos')
    .insert({ evento_id: eventoId, secao_id: secaoId, url: publicUrl, criado_por: user.id } as never)
    .select('id')
    .single()
  if (error) throw new Error(error.message)

  revalidarEvento(eventoId)
  return { id: (data as { id: string }).id, url: publicUrl }
}

export async function removerFotoEventoAction(fotoId: string, eventoId: string) {
  await exigirPermissao()

  const admin = createAdminClient()
  const { error } = await admin.from('evento_fotos').delete().eq('id', fotoId)
  if (error) throw new Error(error.message)

  revalidatePath(`/evento/${eventoId}`)
}
