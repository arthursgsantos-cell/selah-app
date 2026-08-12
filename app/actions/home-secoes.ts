'use server'

/**
 * Ordem e textos dos cartões institucionais da home — ver `lib/home-secoes.ts`
 * para a lista de seções e por que só essas quatro são móveis.
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { SECAO_IDS, type TextosSecoes } from '@/lib/home-secoes'

export async function atualizarSecoesHomeAction(dados: {
  ordem: string[]
  textos: TextosSecoes
}): Promise<{ sucesso: boolean; erro?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { sucesso: false, erro: 'Não autenticado' }

  const { data: perfil } = await supabase
    .from('profiles')
    .select('igreja_id, role')
    .eq('id', user.id)
    .single()

  if (!perfil || !['pastor', 'admin'].includes(perfil.role)) {
    return { sucesso: false, erro: 'Só a liderança da igreja altera a home.' }
  }

  // Só ids conhecidos entram — um id inventado ficaria pendurado sem seção
  // nenhuma para renderizar.
  const idsValidos = new Set<string>(SECAO_IDS)
  const ordemLimpa = dados.ordem.filter((id) => idsValidos.has(id))
  const textosLimpos: TextosSecoes = {}
  for (const [id, texto] of Object.entries(dados.textos)) {
    if (!idsValidos.has(id)) continue
    const titulo = texto?.titulo?.trim()
    const subtitulo = texto?.subtitulo?.trim()
    // Texto vazio some do jsonb: sem entrada para o id, o código usa o padrão.
    // Guardar string vazia deixaria o card sem título nenhum.
    if (titulo || subtitulo) {
      textosLimpos[id as keyof TextosSecoes] = {
        titulo: titulo || null,
        subtitulo: subtitulo || null,
      }
    }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('igrejas')
    .update({
      home_secoes_ordem: ordemLimpa,
      home_secoes_textos: textosLimpos,
    })
    .eq('id', perfil.igreja_id)

  if (error) return { sucesso: false, erro: error.message }

  revalidatePath('/home')
  revalidatePath('/')
  return { sucesso: true }
}
