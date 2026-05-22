'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import type { CampoFormulario } from '@/lib/supabase/types'
import { FORMULARIO_TEMPLATES } from '@/lib/formulario-templates'

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
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { data: profile } = await supabase
    .from('profiles').select('igreja_id').eq('id', user.id).single()
  if (!profile) throw new Error('Perfil não encontrado')

  const { data, error } = await supabase
    .from('formularios')
    .insert({
      nome: params.nome,
      descricao: params.descricao ?? null,
      campos: params.campos,
      igreja_id: profile.igreja_id,
      criado_por: user.id,
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  revalidatePath('/eventos')
  return data.id
}

export async function atualizarFormularioAction(
  id: string,
  params: { nome: string; descricao?: string; campos: CampoFormulario[] }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { error } = await supabase
    .from('formularios')
    .update({ nome: params.nome, descricao: params.descricao ?? null, campos: params.campos })
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/eventos')
}

export async function deletarFormularioAction(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('formularios').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/eventos')
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
