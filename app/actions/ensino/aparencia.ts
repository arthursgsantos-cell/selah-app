'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { acessoEnsino, podeLecionar } from '@/lib/ensino/permissoes'
import { BUCKET_CAPAS } from '@/lib/ensino/tipos'

/**
 * Aparência da página da turma — as mesmas opções da página de evento.
 *
 * Tudo passa pelo cliente admin depois de conferir `podeLecionar`: a policy de
 * update da turma já bastaria, mas a checagem explícita mantém a mensagem de
 * erro legível em vez de "0 linhas afetadas".
 */

const HEX = /^#[0-9a-f]{6}$/i

async function exigirPermissao(turmaId: string) {
  const acesso = await acessoEnsino()
  if (!(await podeLecionar(acesso, turmaId))) {
    throw new Error('Você não administra esta turma.')
  }
}

export async function atualizarFundoTurmaAction(
  turmaId: string,
  aparencia: {
    cor: string
    cor_secundaria: string
    fundo_tipo: string | null
    fundo_opacidade?: number
  }
) {
  await exigirPermissao(turmaId)

  if (!HEX.test(aparencia.cor) || !HEX.test(aparencia.cor_secundaria)) {
    throw new Error('Cor inválida')
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('ensino_turmas')
    .update({
      cor: aparencia.cor,
      cor_secundaria: aparencia.cor_secundaria,
      fundo_tipo: aparencia.fundo_tipo,
      ...(aparencia.fundo_opacidade === undefined
        ? {}
        : { fundo_opacidade: aparencia.fundo_opacidade }),
    })
    .eq('id', turmaId)

  if (error) throw new Error(error.message)
  revalidatePath(`/ensino/turma/${turmaId}`)
}

export async function uploadFundoTurmaAction(
  turmaId: string,
  formData: FormData
): Promise<string> {
  await exigirPermissao(turmaId)

  const arquivo = formData.get('file')
  if (!(arquivo instanceof File) || arquivo.size === 0) throw new Error('Arquivo inválido')

  const extensao = arquivo.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const caminho = `fundo/${turmaId}/${Date.now()}.${extensao}`

  const admin = createAdminClient()
  const { error: erroUpload } = await admin.storage
    .from(BUCKET_CAPAS)
    .upload(caminho, arquivo, { contentType: arquivo.type || 'image/jpeg', upsert: false })

  if (erroUpload) throw new Error(erroUpload.message)

  const { data } = admin.storage.from(BUCKET_CAPAS).getPublicUrl(caminho)

  const { error } = await admin
    .from('ensino_turmas')
    .update({ fundo_imagem_url: data.publicUrl, fundo_tipo: 'imagem' })
    .eq('id', turmaId)

  if (error) throw new Error(error.message)
  revalidatePath(`/ensino/turma/${turmaId}`)
  return data.publicUrl
}

export async function atualizarFundoGaleriaTurmaAction(
  turmaId: string,
  dados: { ativo: boolean; opacidade: number }
) {
  await exigirPermissao(turmaId)

  const admin = createAdminClient()
  const { error } = await admin
    .from('ensino_turmas')
    .update({ fundo_galeria: dados.ativo, fundo_galeria_opacidade: dados.opacidade })
    .eq('id', turmaId)

  if (error) throw new Error(error.message)
  revalidatePath(`/ensino/turma/${turmaId}`)
}

export async function alternarAutoCorTurmaAction(turmaId: string, ativo: boolean) {
  await exigirPermissao(turmaId)

  const admin = createAdminClient()
  const { error } = await admin
    .from('ensino_turmas')
    // Desligar limpa a origem: senão a capa antiga continuaria "já processada"
    // e as cores não voltariam a ser recalculadas ao religar.
    .update({ fundo_auto_cor: ativo, ...(ativo ? {} : { fundo_auto_cor_origem: null }) })
    .eq('id', turmaId)

  if (error) throw new Error(error.message)
  revalidatePath(`/ensino/turma/${turmaId}`)
}

export async function salvarAutoCorTurmaAction(
  turmaId: string,
  cores: { cor: string; corSecundaria: string; origem: string }
) {
  await exigirPermissao(turmaId)

  if (!HEX.test(cores.cor) || !HEX.test(cores.corSecundaria)) throw new Error('Cor inválida')

  const admin = createAdminClient()
  const { error } = await admin
    .from('ensino_turmas')
    .update({
      cor: cores.cor,
      cor_secundaria: cores.corSecundaria,
      fundo_auto_cor_origem: cores.origem,
    })
    .eq('id', turmaId)

  if (error) throw new Error(error.message)
  revalidatePath(`/ensino/turma/${turmaId}`)
}

/**
 * Capa do topo da página da turma — a arte larga.
 *
 * Grava em `capa_pagina_url` de propósito: o card das listagens é `capa_url` e
 * continua saindo do formulário da turma. Trocar a capa daqui não mexe no card.
 */
export async function salvarCapaPaginaTurmaAction(
  turmaId: string,
  formData: FormData
): Promise<string> {
  await exigirPermissao(turmaId)

  const arquivo = formData.get('file')
  if (!(arquivo instanceof File) || arquivo.size === 0) throw new Error('Arquivo inválido')

  const extensao = arquivo.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const caminho = `capa/${turmaId}/${Date.now()}.${extensao}`

  const admin = createAdminClient()
  const { error: erroUpload } = await admin.storage
    .from(BUCKET_CAPAS)
    .upload(caminho, arquivo, { contentType: arquivo.type || 'image/jpeg', upsert: false })

  if (erroUpload) throw new Error(erroUpload.message)

  const { data } = admin.storage.from(BUCKET_CAPAS).getPublicUrl(caminho)

  const { error } = await admin
    .from('ensino_turmas')
    .update({ capa_pagina_url: data.publicUrl })
    .eq('id', turmaId)

  if (error) throw new Error(error.message)
  revalidatePath(`/ensino/turma/${turmaId}`)
  return data.publicUrl
}

/** Volta a página a mostrar o card da turma. */
export async function removerCapaPaginaTurmaAction(turmaId: string) {
  await exigirPermissao(turmaId)

  const admin = createAdminClient()
  const { error } = await admin
    .from('ensino_turmas')
    .update({ capa_pagina_url: null })
    .eq('id', turmaId)

  if (error) throw new Error(error.message)
  revalidatePath(`/ensino/turma/${turmaId}`)
}
