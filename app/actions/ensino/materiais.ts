'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { acessoEnsino, podeLecionar } from '@/lib/ensino/permissoes'
import type { TipoMaterial } from '@/lib/supabase/types'
import { BUCKET_MATERIAIS, type ResultadoAcao } from '@/lib/ensino/tipos'

/** 50 MB, o mesmo limite configurado no bucket. */
const TAMANHO_MAXIMO = 50 * 1024 * 1024

/**
 * Cadastra um material.
 *
 * O arquivo vai para o bucket **privado** `ensino-materiais`: a URL do objeto
 * não abre sozinha, nem para quem a descobrir. Quem lê é o route handler
 * `/api/ensino/material/[id]`, que confere a inscrição antes de assinar.
 */
export async function salvarMaterialAction(
  formData: FormData
): Promise<ResultadoAcao> {
  const acesso = await acessoEnsino()
  if (!acesso) return { ok: false, erro: 'Não autenticado.' }

  const turmaId = String(formData.get('turmaId') ?? '')
  if (!(await podeLecionar(acesso, turmaId))) {
    return { ok: false, erro: 'Você não administra esta turma.' }
  }

  const titulo = String(formData.get('titulo') ?? '').trim()
  if (!titulo) return { ok: false, erro: 'O material precisa de um título.' }

  const tipo = (String(formData.get('tipo') ?? 'arquivo') || 'arquivo') as TipoMaterial
  const descricao = String(formData.get('descricao') ?? '').trim() || null
  const aulaId = String(formData.get('aulaId') ?? '') || null
  const publico = formData.get('publico') === 'on' || formData.get('publico') === 'true'
  const url = String(formData.get('url') ?? '').trim() || null

  const admin = createAdminClient()

  let arquivoPath: string | null = null
  let arquivoNome: string | null = null
  let arquivoTamanho: number | null = null

  if (tipo === 'arquivo') {
    const arquivo = formData.get('arquivo')
    if (!(arquivo instanceof File) || arquivo.size === 0) {
      return { ok: false, erro: 'Escolha o arquivo do material.' }
    }
    if (arquivo.size > TAMANHO_MAXIMO) {
      return { ok: false, erro: 'O arquivo passa de 50 MB. Use um link do Drive para arquivos maiores.' }
    }

    // Prefixado pela turma para que a listagem do bucket já venha separada, e
    // com timestamp para dois envios do mesmo PDF não se sobrescreverem.
    const seguro = arquivo.name.replace(/[^\w.\-]+/g, '_').slice(-80)
    arquivoPath = `${turmaId}/${Date.now()}-${seguro}`
    arquivoNome = arquivo.name
    arquivoTamanho = arquivo.size

    const { error: erroUpload } = await admin.storage
      .from(BUCKET_MATERIAIS)
      .upload(arquivoPath, arquivo, {
        contentType: arquivo.type || 'application/octet-stream',
        upsert: false,
      })

    if (erroUpload) return { ok: false, erro: `Falha ao enviar o arquivo: ${erroUpload.message}` }
  } else if (!url) {
    return { ok: false, erro: 'Informe o link do material.' }
  }

  const { error } = await admin.from('ensino_materiais').insert({
    turma_id: turmaId,
    aula_id: aulaId,
    titulo,
    descricao,
    tipo,
    url: tipo === 'arquivo' ? null : url,
    arquivo_path: arquivoPath,
    arquivo_nome: arquivoNome,
    arquivo_tamanho: arquivoTamanho,
    publico,
    criado_por: acesso.userId,
  })

  if (error) {
    // Sem isto o arquivo ficaria órfão no bucket, sem linha que o referencie.
    if (arquivoPath) await admin.storage.from(BUCKET_MATERIAIS).remove([arquivoPath])
    return { ok: false, erro: error.message }
  }

  revalidatePath(`/ensino/turma/${turmaId}`)
  revalidatePath(`/ensino/turma/${turmaId}/materiais`)
  revalidatePath('/ensino/aluno')
  return { ok: true }
}

export async function editarMaterialAction(
  id: string,
  params: {
    titulo: string
    descricao?: string | null
    aulaId?: string | null
    url?: string | null
    publico?: boolean
  }
): Promise<ResultadoAcao> {
  const acesso = await acessoEnsino()
  if (!acesso) return { ok: false, erro: 'Não autenticado.' }
  if (!params.titulo.trim()) return { ok: false, erro: 'O material precisa de um título.' }

  const admin = createAdminClient()
  const { data: material } = await admin
    .from('ensino_materiais')
    .select('id, turma_id, tipo')
    .eq('id', id)
    .single()

  if (!material) return { ok: false, erro: 'Material não encontrado.' }
  if (!(await podeLecionar(acesso, material.turma_id))) {
    return { ok: false, erro: 'Você não administra esta turma.' }
  }

  const { error } = await admin
    .from('ensino_materiais')
    .update({
      titulo: params.titulo.trim(),
      descricao: params.descricao?.trim() || null,
      aula_id: params.aulaId || null,
      // Trocar o arquivo é excluir e cadastrar de novo; aqui só o link muda.
      ...(material.tipo === 'arquivo' ? {} : { url: params.url?.trim() || null }),
      ...(params.publico === undefined ? {} : { publico: params.publico }),
    })
    .eq('id', id)

  if (error) return { ok: false, erro: error.message }
  revalidatePath(`/ensino/turma/${material.turma_id}/materiais`)
  revalidatePath(`/ensino/turma/${material.turma_id}`)
  return { ok: true }
}

export async function excluirMaterialAction(id: string): Promise<ResultadoAcao> {
  const acesso = await acessoEnsino()
  if (!acesso) return { ok: false, erro: 'Não autenticado.' }

  const admin = createAdminClient()
  const { data: material } = await admin
    .from('ensino_materiais')
    .select('id, turma_id, arquivo_path')
    .eq('id', id)
    .single()

  if (!material) return { ok: false, erro: 'Material não encontrado.' }
  if (!(await podeLecionar(acesso, material.turma_id))) {
    return { ok: false, erro: 'Você não administra esta turma.' }
  }

  const { error } = await admin.from('ensino_materiais').delete().eq('id', id)
  if (error) return { ok: false, erro: error.message }

  if (material.arquivo_path) {
    await admin.storage.from(BUCKET_MATERIAIS).remove([material.arquivo_path])
  }

  revalidatePath(`/ensino/turma/${material.turma_id}/materiais`)
  revalidatePath(`/ensino/turma/${material.turma_id}`)
  return { ok: true }
}
