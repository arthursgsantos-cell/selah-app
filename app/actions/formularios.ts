'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import type { CampoFormulario, Role } from '@/lib/supabase/types'
import { FORMULARIO_TEMPLATES } from '@/lib/formulario-templates'
import { ROLE_ORDER } from '@/lib/nav-items'

/**
 * Só líder para cima mexe em formulários e templates — são compartilhados por
 * toda a igreja, então um membro comum não deve poder alterá-los.
 */
async function exigirLiderOuAcima() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { data: profile } = await supabase
    .from('profiles').select('igreja_id, role').eq('id', user.id).single()
  if (!profile) throw new Error('Perfil não encontrado')

  if (ROLE_ORDER[profile.role as Role] < ROLE_ORDER.lider) {
    throw new Error('Você não tem permissão para gerenciar formulários.')
  }

  return { user, igrejaId: profile.igreja_id }
}

export async function listarFormulariosAction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { data, error } = await supabase
    .from('formularios')
    .select('id, nome, descricao, campos, template, criado_em')
    .order('criado_em', { ascending: false })

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function criarFormularioAction(params: {
  nome: string
  descricao?: string
  campos: CampoFormulario[]
  template?: boolean
}) {
  const { user, igrejaId } = await exigirLiderOuAcima()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('formularios')
    .insert({
      nome: params.nome,
      descricao: params.descricao ?? null,
      campos: params.campos,
      template: params.template ?? false,
      igreja_id: igrejaId,
      criado_por: user.id,
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  revalidatePath('/eventos')
  revalidatePath('/formularios')
  return data.id
}

export async function atualizarFormularioAction(
  id: string,
  params: { nome: string; descricao?: string; campos: CampoFormulario[]; template?: boolean }
) {
  await exigirLiderOuAcima()
  const supabase = await createClient()

  const { error } = await supabase
    .from('formularios')
    .update({
      nome: params.nome,
      descricao: params.descricao ?? null,
      campos: params.campos,
      ...(params.template !== undefined ? { template: params.template } : {}),
    })
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/eventos')
  revalidatePath('/formularios')
  revalidatePath(`/formularios/${id}`)
}

export async function deletarFormularioAction(id: string) {
  await exigirLiderOuAcima()
  const supabase = await createClient()

  // Um formulário em uso por algum evento não pode sumir: as inscrições
  // existentes deixariam de fazer sentido.
  const { count } = await supabase
    .from('eventos')
    .select('id', { count: 'exact', head: true })
    .eq('formulario_id', id)

  if ((count ?? 0) > 0) {
    throw new Error(
      `Este formulário está em uso por ${count} evento(s). Desvincule antes de excluir.`
    )
  }

  const { error } = await supabase.from('formularios').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/eventos')
  revalidatePath('/formularios')
}

/** Cria uma cópia editável a partir de outro formulário ou template. */
export async function duplicarFormularioAction(id: string, novoNome?: string) {
  await exigirLiderOuAcima()
  const admin = createAdminClient()

  const { data: origem, error } = await admin
    .from('formularios')
    .select('nome, descricao, campos')
    .eq('id', id)
    .single()
  if (error) throw new Error(error.message)

  return criarFormularioAction({
    nome: novoNome ?? `${origem.nome} (cópia)`,
    descricao: origem.descricao ?? undefined,
    campos: (origem.campos ?? []) as CampoFormulario[],
  })
}

export async function buscarFormularioAction(id: string) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('formularios')
    .select('id, nome, descricao, campos')
    .eq('id', id)
    .single()
  if (error) throw new Error(error.message)
  return data
}
