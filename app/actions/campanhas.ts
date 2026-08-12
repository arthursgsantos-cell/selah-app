'use server'

/**
 * Campanhas de contribuição — os destinos que a igreja separa no extrato pelo
 * final de centavos. Ver `supabase/migrations/campanhas_contribuicao.sql`.
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export interface Campanha {
  id: string
  nome: string
  descricao: string | null
  centavos: number
  ativa: boolean
  ordem: number
}

export interface DadosCampanha {
  nome: string
  descricao: string | null
  centavos: number
  ativa: boolean
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
