'use server'

/**
 * Campanhas de contribuição — os destinos que a igreja separa no extrato pelo
 * final de centavos. Ver `supabase/migrations/campanhas_contribuicao.sql`.
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { BUCKET_CAMPANHAS } from '@/lib/campanhas'

export interface Campanha {
  id: string
  nome: string
  descricao: string | null
  centavos: number
  ativa: boolean
  ordem: number
  /** Card da campanha — o retrato que ela leva para a página e para a home. */
  imagem_url: string | null
  /** Vídeo promocional: YouTube, Vimeo ou link direto de mp4. */
  video_url: string | null
  /** Leva o card para a home, além da página de contribuição. */
  destaque: boolean
}

export interface DadosCampanha {
  nome: string
  descricao: string | null
  centavos: number
  ativa: boolean
  imagem_url?: string | null
  video_url?: string | null
  destaque?: boolean
}

async function exigirDirecao(): Promise<{ igrejaId: string } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('igreja_id, role')
    .eq('id', user.id)
    .single()

  if (!profile || !['pastor', 'admin'].includes(profile.role)) return null
  return { igrejaId: profile.igreja_id }
}

function validar(dados: DadosCampanha): string | null {
  if (!dados.nome.trim()) return 'Dê um nome à campanha.'
  if (!Number.isInteger(dados.centavos) || dados.centavos < 1 || dados.centavos > 99) {
    return 'O final de centavos vai de 01 a 99.'
  }
  return null
}

/**
 * O índice único só vale entre as ativas, e a mensagem que o Postgres devolve
 * nesse caso ("duplicate key value violates unique constraint…") não diz nada
 * a quem está cadastrando. Traduzimos.
 */
function erroLegivel(mensagem: string, centavos: number): string {
  if (mensagem.includes('campanhas_contribuicao_centavos_idx')) {
    return `Já existe uma campanha ativa terminando em ,${String(centavos).padStart(2, '0')}. Escolha outro final.`
  }
  return mensagem
}

export async function criarCampanhaAction(
  dados: DadosCampanha
): Promise<{ ok: true; id: string } | { ok: false; erro: string }> {
  const direcao = await exigirDirecao()
  if (!direcao) return { ok: false, erro: 'Sem permissão.' }

  const invalido = validar(dados)
  if (invalido) return { ok: false, erro: invalido }

  const admin = createAdminClient()

  // Entra no fim da lista; reordenar é arrastar depois, não decidir agora.
  const { data: ultima } = await admin
    .from('campanhas_contribuicao')
    .select('ordem')
    .eq('igreja_id', direcao.igrejaId)
    .order('ordem', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data, error } = await admin
    .from('campanhas_contribuicao')
    .insert({
      igreja_id: direcao.igrejaId,
      nome: dados.nome.trim(),
      descricao: dados.descricao?.trim() || null,
      centavos: dados.centavos,
      ativa: dados.ativa,
      imagem_url: dados.imagem_url ?? null,
      video_url: dados.video_url?.trim() || null,
      destaque: dados.destaque ?? false,
      ordem: ((ultima as { ordem: number } | null)?.ordem ?? 0) + 1,
    })
    .select('id')
    .single()

  if (error || !data) {
    return { ok: false, erro: erroLegivel(error?.message ?? 'Não foi possível salvar.', dados.centavos) }
  }

  revalidatePath('/pastor')
  revalidatePath('/contribuir')
  return { ok: true, id: data.id }
}

export async function editarCampanhaAction(
  id: string,
  dados: DadosCampanha
): Promise<{ ok: boolean; erro?: string }> {
  const direcao = await exigirDirecao()
  if (!direcao) return { ok: false, erro: 'Sem permissão.' }

  const invalido = validar(dados)
  if (invalido) return { ok: false, erro: invalido }

  const admin = createAdminClient()
  const { error } = await admin
    .from('campanhas_contribuicao')
    .update({
      nome: dados.nome.trim(),
      descricao: dados.descricao?.trim() || null,
      centavos: dados.centavos,
      ativa: dados.ativa,
      imagem_url: dados.imagem_url ?? null,
      video_url: dados.video_url?.trim() || null,
      destaque: dados.destaque ?? false,
    })
    .eq('id', id)
    // O filtro por igreja não é redundante com a checagem de cargo: sem ele,
    // um pastor editaria a campanha de outra igreja mandando o id na mão.
    .eq('igreja_id', direcao.igrejaId)

  if (error) return { ok: false, erro: erroLegivel(error.message, dados.centavos) }

  revalidatePath('/pastor')
  revalidatePath('/contribuir')
  return { ok: true }
}

/**
 * Sobe o card da campanha.
 *
 * A imagem é gravada antes de a campanha existir (na hora de criar) — por isso
 * a ação devolve a URL em vez de já salvar na linha: quem guarda é o
 * formulário, junto com o resto.
 */
export async function subirImagemCampanhaAction(
  formData: FormData
): Promise<{ ok: true; url: string } | { ok: false; erro: string }> {
  const direcao = await exigirDirecao()
  if (!direcao) return { ok: false, erro: 'Sem permissão.' }

  const file = formData.get('file') as File | null
  if (!file) return { ok: false, erro: 'Escolha uma imagem.' }
  // 8 MB: acima disso é foto de câmera sem tratamento, que só faz a página
  // demorar a abrir no celular de quem vai contribuir.
  if (file.size > 8 * 1024 * 1024) return { ok: false, erro: 'Imagem muito grande (máximo 8 MB).' }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const caminho = `${direcao.igrejaId}/${crypto.randomUUID()}.${ext}`

  const admin = createAdminClient()
  const { error } = await admin.storage
    .from(BUCKET_CAMPANHAS)
    .upload(caminho, await file.arrayBuffer(), { contentType: file.type, upsert: false })
  if (error) return { ok: false, erro: error.message }

  return {
    ok: true,
    url: admin.storage.from(BUCKET_CAMPANHAS).getPublicUrl(caminho).data.publicUrl,
  }
}

export async function excluirCampanhaAction(
  id: string
): Promise<{ ok: boolean; erro?: string }> {
  const direcao = await exigirDirecao()
  if (!direcao) return { ok: false, erro: 'Sem permissão.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('campanhas_contribuicao')
    .delete()
    .eq('id', id)
    .eq('igreja_id', direcao.igrejaId)

  if (error) return { ok: false, erro: error.message }

  revalidatePath('/pastor')
  revalidatePath('/contribuir')
  return { ok: true }
}
