'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { acessoEnsino } from '@/lib/ensino/permissoes'
import type { ResultadoAcao } from '@/lib/ensino/tipos'

/**
 * Devolve o `id` do curso criado para que a criação da primeira turma possa
 * continuar no mesmo diálogo, sem obrigar o professor a fechar e reabrir.
 */
export async function criarCursoAction(params: {
  nome: string
  descricao?: string | null
  capaUrl?: string | null
}): Promise<{ ok: true; id: string } | { ok: false; erro: string }> {
  const acesso = await acessoEnsino()
  if (!acesso?.professor) return { ok: false, erro: 'Sem permissão para criar cursos.' }
  if (!params.nome.trim()) return { ok: false, erro: 'O curso precisa de um nome.' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ensino_cursos')
    .insert({
      igreja_id: acesso.igrejaId,
      nome: params.nome.trim(),
      descricao: params.descricao?.trim() || null,
      capa_url: params.capaUrl || null,
      criado_por: acesso.userId,
    })
    .select('id')
    .single()

  if (error || !data) {
    return { ok: false, erro: error?.message ?? 'Não foi possível criar o curso.' }
  }

  revalidatePath('/ensino')
  revalidatePath('/ensino/admin')
  return { ok: true, id: data.id }
}

export async function editarCursoAction(
  id: string,
  params: {
    nome: string
    descricao?: string | null
    capaUrl?: string | null
    ativo?: boolean
  }
): Promise<ResultadoAcao> {
  const acesso = await acessoEnsino()
  if (!acesso?.professor) return { ok: false, erro: 'Sem permissão para editar cursos.' }
  if (!params.nome.trim()) return { ok: false, erro: 'O curso precisa de um nome.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('ensino_cursos')
    .update({
      nome: params.nome.trim(),
      descricao: params.descricao?.trim() || null,
      capa_url: params.capaUrl || null,
      ...(params.ativo === undefined ? {} : { ativo: params.ativo }),
    })
    .eq('id', id)

  if (error) return { ok: false, erro: error.message }
  revalidatePath('/ensino')
  revalidatePath('/ensino/admin')
  return { ok: true }
}

/**
 * Só coordenador apaga, e a RLS confirma. O cascade leva turmas, inscrições e
 * presenças junto — por isso a tela pede confirmação explícita antes de chamar.
 */
export async function excluirCursoAction(id: string): Promise<ResultadoAcao> {
  const acesso = await acessoEnsino()
  if (!acesso?.coordenador) return { ok: false, erro: 'Só a coordenação pode excluir cursos.' }

  const supabase = await createClient()
  const { error } = await supabase.from('ensino_cursos').delete().eq('id', id)

  if (error) return { ok: false, erro: error.message }
  revalidatePath('/ensino')
  revalidatePath('/ensino/admin')
  return { ok: true }
}
