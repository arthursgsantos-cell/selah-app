'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

/**
 * Seções da página do evento: ordem, duplicação e cabeçalho.
 *
 * Duplicar copia a seção E o que está dentro dela. Sem isso, as duas seções
 * apontariam para os mesmos mini cards e editar uma mudaria a outra.
 */

const CARGOS_EDICAO = ['admin', 'pastor', 'supervisor', 'supervisor_treinamento', 'lider']

export type TipoSecao = 'inscricao' | 'botoes' | 'cards' | 'video' | 'fotos'

export type SecaoEvento = {
  id: string
  tipo: TipoSecao
  titulo: string | null
  descricao: string | null
  video_url: string | null
  ordem: number
}

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

function revalidar(eventoId: string) {
  revalidatePath(`/evento/${eventoId}`)
  revalidatePath('/eventos')
}

async function secoesOrdenadas(admin: ReturnType<typeof createAdminClient>, eventoId: string) {
  const { data, error } = await admin
    .from('evento_secoes')
    .select('id, tipo, ordem')
    .eq('evento_id', eventoId)
    .order('ordem')
    .order('criado_em')
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as { id: string; tipo: TipoSecao; ordem: number }[]
}

/**
 * Regrava `ordem` como 0,1,2... na sequência recebida. Reescrever a lista
 * inteira em vez de trocar dois valores evita empates de `ordem` herdados de
 * qualquer inconsistência anterior.
 */
async function gravarOrdem(
  admin: ReturnType<typeof createAdminClient>,
  ids: string[]
) {
  for (let i = 0; i < ids.length; i++) {
    const { error } = await admin
      .from('evento_secoes')
      .update({ ordem: i } as never)
      .eq('id', ids[i])
    if (error) throw new Error(error.message)
  }
}

export async function moverSecaoAction(
  secaoId: string,
  eventoId: string,
  direcao: 'cima' | 'baixo'
) {
  await exigirPermissao()
  const admin = createAdminClient()

  const secoes = await secoesOrdenadas(admin, eventoId)
  const atual = secoes.findIndex((s) => s.id === secaoId)
  if (atual < 0) throw new Error('Seção não encontrada')

  const destino = direcao === 'cima' ? atual - 1 : atual + 1
  if (destino < 0 || destino >= secoes.length) return

  const ids = secoes.map((s) => s.id)
  ;[ids[atual], ids[destino]] = [ids[destino], ids[atual]]

  await gravarOrdem(admin, ids)
  revalidar(eventoId)
}

/** Copia a seção e o conteúdo dela, logo abaixo da original. */
export async function duplicarSecaoAction(secaoId: string, eventoId: string) {
  await exigirPermissao()
  const admin = createAdminClient()

  const { data: originalData, error: erroBusca } = await admin
    .from('evento_secoes')
    .select('tipo, titulo, descricao, video_url')
    .eq('id', secaoId)
    .single()
  if (erroBusca) throw new Error(erroBusca.message)

  const original = originalData as unknown as {
    tipo: TipoSecao; titulo: string | null; descricao: string | null; video_url: string | null
  }

  const { data: criadaData, error: erroInsert } = await admin
    .from('evento_secoes')
    .insert({
      evento_id: eventoId,
      tipo: original.tipo,
      titulo: original.titulo ? `${original.titulo} (cópia)` : null,
      descricao: original.descricao,
      video_url: original.video_url,
      ordem: 9999,
    } as never)
    .select('id')
    .single()
  if (erroInsert) throw new Error(erroInsert.message)

  const novaId = (criadaData as { id: string }).id

  // O conteúdo tem de ser copiado, não referenciado: duas seções apontando
  // para os mesmos cards fariam a edição de uma alterar a outra.
  if (original.tipo === 'cards') {
    const { data } = await admin
      .from('evento_cards')
      .select('titulo, descricao, imagem_url, valor, ordem')
      .eq('secao_id', secaoId)
    const filhos = (data ?? []) as unknown as Record<string, unknown>[]
    if (filhos.length > 0) {
      await admin
        .from('evento_cards')
        .insert(filhos.map((c) => ({ ...c, evento_id: eventoId, secao_id: novaId })) as never)
    }
  }

  if (original.tipo === 'botoes') {
    const { data } = await admin
      .from('evento_botoes')
      .select('rotulo, url, ordem')
      .eq('secao_id', secaoId)
    const filhos = (data ?? []) as unknown as Record<string, unknown>[]
    if (filhos.length > 0) {
      await admin
        .from('evento_botoes')
        .insert(filhos.map((b) => ({ ...b, evento_id: eventoId, secao_id: novaId })) as never)
    }
  }

  if (original.tipo === 'fotos') {
    const { data } = await admin
      .from('evento_fotos')
      .select('url, legenda, ordem')
      .eq('secao_id', secaoId)
    const filhos = (data ?? []) as unknown as Record<string, unknown>[]
    if (filhos.length > 0) {
      await admin
        .from('evento_fotos')
        .insert(filhos.map((f) => ({ ...f, evento_id: eventoId, secao_id: novaId })) as never)
    }
  }

  // Reposiciona a cópia logo abaixo da original.
  const secoes = await secoesOrdenadas(admin, eventoId)
  const ids = secoes.map((s) => s.id).filter((id) => id !== novaId)
  const posicao = ids.indexOf(secaoId)
  ids.splice(posicao + 1, 0, novaId)

  await gravarOrdem(admin, ids)
  revalidar(eventoId)
}

export async function adicionarSecaoAction(eventoId: string, tipo: TipoSecao) {
  await exigirPermissao()
  const admin = createAdminClient()

  const secoes = await secoesOrdenadas(admin, eventoId)
  const { error } = await admin
    .from('evento_secoes')
    .insert({ evento_id: eventoId, tipo, ordem: secoes.length } as never)
  if (error) throw new Error(error.message)

  revalidar(eventoId)
}

/** Apagar a seção leva junto o conteúdo dela (cascade no banco). */
export async function removerSecaoAction(secaoId: string, eventoId: string) {
  await exigirPermissao()
  const admin = createAdminClient()

  const { error } = await admin.from('evento_secoes').delete().eq('id', secaoId)
  if (error) throw new Error(error.message)

  const secoes = await secoesOrdenadas(admin, eventoId)
  await gravarOrdem(admin, secoes.map((s) => s.id))
  revalidar(eventoId)
}

export async function salvarCabecalhoSecaoAction(
  secaoId: string,
  eventoId: string,
  cabecalho: { titulo: string; descricao: string }
) {
  await exigirPermissao()
  const admin = createAdminClient()

  const { error } = await admin
    .from('evento_secoes')
    .update({
      titulo: cabecalho.titulo.trim() || null,
      descricao: cabecalho.descricao.trim() || null,
    } as never)
    .eq('id', secaoId)
  if (error) throw new Error(error.message)

  revalidar(eventoId)
}

export async function salvarVideoSecaoAction(secaoId: string, eventoId: string, videoUrl: string) {
  await exigirPermissao()

  const url = videoUrl.trim()
  if (url && !/^https?:\/\//i.test(url)) {
    throw new Error('Informe um link começando com http:// ou https://')
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('evento_secoes')
    .update({ video_url: url || null } as never)
    .eq('id', secaoId)
  if (error) throw new Error(error.message)

  revalidar(eventoId)
}
