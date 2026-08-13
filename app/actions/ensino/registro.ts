'use server'

/**
 * Registro da aula — as fotos do dia.
 *
 * Separado dos materiais de propósito: material é o que o aluno estuda,
 * registro é a memória de que a turma aconteceu. Ver
 * `supabase/migrations/ensino_registro_aula.sql`.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { acessoEnsino, podeLecionar } from '@/lib/ensino/permissoes'
import { BUCKET_CAPAS } from '@/lib/ensino/tipos'
import type { ResultadoAcao } from '@/lib/ensino/tipos'

/** Teto por foto. Acima disso o navegador já devia ter comprimido. */
const TAMANHO_MAXIMO = 8 * 1024 * 1024

export async function publicarFotoAulaAction(
  turmaId: string,
  formData: FormData
): Promise<ResultadoAcao> {
  const acesso = await acessoEnsino()
  if (!acesso) return { ok: false, erro: 'Não autenticado.' }
  if (!(await podeLecionar(acesso, turmaId))) {
    return { ok: false, erro: 'Você não administra esta turma.' }
  }

  const arquivo = formData.get('file')
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { ok: false, erro: 'Arquivo inválido.' }
  }
  if (arquivo.size > TAMANHO_MAXIMO) {
    return { ok: false, erro: 'A imagem passa de 8 MB. Tente uma menor.' }
  }

  const aulaId = (formData.get('aulaId') as string) || null
  const legenda = ((formData.get('legenda') as string) ?? '').trim() || null

  // A aula precisa ser desta turma — senão a foto apareceria no registro de
  // outra, e a data da tag viria errada.
  const admin = createAdminClient()
  if (aulaId) {
    const { data: aula } = await admin
      .from('ensino_aulas')
      .select('turma_id')
      .eq('id', aulaId)
      .maybeSingle()
    if (!aula || aula.turma_id !== turmaId) {
      return { ok: false, erro: 'Esta aula não é da turma.' }
    }
  }

  const extensao = arquivo.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const caminho = `registro/${turmaId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${extensao}`

  const { error: erroUpload } = await admin.storage
    .from(BUCKET_CAPAS)
    .upload(caminho, arquivo, { contentType: arquivo.type || 'image/jpeg', upsert: false })
  if (erroUpload) return { ok: false, erro: erroUpload.message }

  const { data } = admin.storage.from(BUCKET_CAPAS).getPublicUrl(caminho)

  const { error } = await admin.from('ensino_aula_fotos').insert({
    turma_id: turmaId,
    aula_id: aulaId,
    url: data.publicUrl,
    legenda,
    criado_por: acesso.userId,
  })
  if (error) return { ok: false, erro: error.message }

  revalidatePath(`/ensino/turma/${turmaId}`)
  return { ok: true }
}

export async function removerFotoAulaAction(fotoId: string): Promise<ResultadoAcao> {
  const acesso = await acessoEnsino()
  if (!acesso) return { ok: false, erro: 'Não autenticado.' }

  const admin = createAdminClient()
  const { data: foto } = await admin
    .from('ensino_aula_fotos')
    .select('id, turma_id')
    .eq('id', fotoId)
    .maybeSingle()

  if (!foto) return { ok: false, erro: 'Foto não encontrada.' }
  if (!(await podeLecionar(acesso, foto.turma_id))) {
    return { ok: false, erro: 'Você não administra esta turma.' }
  }

  // O arquivo fica no bucket: apagar a linha já tira a foto de todas as telas,
  // e remover o objeto tornaria um desfazer impossível se alguém errar o clique.
  const { error } = await admin.from('ensino_aula_fotos').delete().eq('id', fotoId)
  if (error) return { ok: false, erro: error.message }

  revalidatePath(`/ensino/turma/${foto.turma_id}`)
  return { ok: true }
}
