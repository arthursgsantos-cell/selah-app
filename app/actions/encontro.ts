'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { FuncaoEscala } from '@/lib/supabase/types'

type RecorrenciaEncontro = 'semanal' | 'quinzenal' | 'mensal'

const RECORRENCIA_COUNT: Record<RecorrenciaEncontro, number> = {
  semanal: 12,
  quinzenal: 6,
  mensal: 3,
}

function nextEncontroDate(base: Date, tipo: RecorrenciaEncontro, i: number): Date {
  const d = new Date(base)
  if (tipo === 'semanal') {
    d.setDate(d.getDate() + i * 7)
  } else if (tipo === 'quinzenal') {
    d.setDate(d.getDate() + i * 14)
  } else {
    const day = d.getDate()
    d.setMonth(d.getMonth() + i)
    if (d.getDate() < day) d.setDate(0)
  }
  return d
}

export async function createEncontroAction(
  celulaId: string,
  dataHora: string,
  local?: string,
  cardImagemUrl?: string | null,
  recorrencia?: RecorrenciaEncontro,
  localMapsUrl?: string | null,
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const admin = createAdminClient()

  if (!recorrencia) {
    const { data, error } = await admin
      .from('encontros')
      .insert({
        celula_id: celulaId,
        data_hora: dataHora,
        local: local || null,
        local_maps_url: localMapsUrl || null,
        card_imagem_url: cardImagemUrl ?? null,
        status: 'agendado',
        created_by: user.id,
      })
      .select('id')
      .single()

    if (error) throw new Error(error.message)
    revalidatePath('/celula')
    redirect(`/encontro/${data.id}`)
  } else {
    const count = RECORRENCIA_COUNT[recorrencia]
    const start = new Date(dataHora)

    const encontros = Array.from({ length: count }, (_, i) => ({
      celula_id: celulaId,
      data_hora: nextEncontroDate(start, recorrencia, i).toISOString(),
      local: local || null,
      local_maps_url: localMapsUrl || null,
      card_imagem_url: cardImagemUrl ?? null,
      status: 'agendado' as const,
      created_by: user.id,
    }))

    const { error } = await admin.from('encontros').insert(encontros)
    if (error) throw new Error(error.message)
    revalidatePath('/celula')
  }
}

export async function uploadCapaEncontroAction(encontroId: string, formData: FormData): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const file = formData.get('file') as File
  if (!file) throw new Error('Arquivo não encontrado')

  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${encontroId}.${ext}`
  const arrayBuffer = await file.arrayBuffer()

  const admin = createAdminClient()
  const { error } = await admin.storage
    .from('encontro-capas')
    .upload(path, arrayBuffer, { contentType: file.type, upsert: true })
  if (error) throw new Error(error.message)

  const { data } = admin.storage.from('encontro-capas').getPublicUrl(path)
  const url = `${data.publicUrl}?t=${Date.now()}`

  await admin.from('encontros').update({ card_imagem_url: url }).eq('id', encontroId)
  revalidatePath(`/encontro/${encontroId}`)

  return url
}

export async function updateEncontroAction(
  id: string,
  data: { local?: string; local_maps_url?: string | null; avisos?: string; data_hora?: string; edificacao_resumo?: string; resumo_culto_id?: string | null }
) {
  const admin = createAdminClient()
  const { error } = await admin.from('encontros').update(data).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath(`/encontro/${id}`)
}

export async function upsertEscalaAction(
  encontroId: string,
  funcao: FuncaoEscala,
  responsavelId: string | null,
  comConjuge = false
) {
  const admin = createAdminClient()

  const { error: delError } = await admin
    .from('escalas')
    .delete()
    .eq('encontro_id', encontroId)
    .eq('funcao', funcao)
  if (delError) throw new Error(delError.message)

  if (responsavelId !== null) {
    const { error } = await admin
      .from('escalas')
      .insert({ encontro_id: encontroId, funcao, responsavel_id: responsavelId, com_conjuge: comConjuge })
    if (error) throw new Error(error.message)
  }

  revalidatePath(`/encontro/${encontroId}`)
}

export async function addLancheAction(encontroId: string, emoji: string, item: string, ordem: number) {
  const admin = createAdminClient()
  const { error } = await admin.from('lanches').insert({ encontro_id: encontroId, emoji: emoji || null, item, ordem })
  if (error) throw new Error(error.message)
  revalidatePath(`/encontro/${encontroId}`)
}

export async function deleteLancheAction(id: string, encontroId: string) {
  const admin = createAdminClient()
  const { error } = await admin.from('lanches').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath(`/encontro/${encontroId}`)
}

export async function marcarLancheAction(id: string, encontroId: string, comConjuge = false) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles').select('nome, conjuge_id').eq('id', user.id).single()

  let responsavel = profile?.nome ?? 'Você'

  if (comConjuge) {
    let conjugeNome: string | null = null
    if (profile?.conjuge_id) {
      const { data: c } = await admin.from('profiles').select('nome').eq('id', profile.conjuge_id).single()
      conjugeNome = c?.nome?.split(' ')[0] ?? null
    }
    if (!conjugeNome) {
      const { data: dep } = await admin.from('dependentes').select('nome').eq('profile_id', user.id).eq('tipo', 'cônjuge').maybeSingle()
      conjugeNome = dep?.nome?.split(' ')[0] ?? null
    }
    if (conjugeNome) responsavel = `${responsavel} e ${conjugeNome}`
  }

  const { error } = await admin.from('lanches').update({
    responsavel_id: user.id,
    responsavel,
    com_conjuge: comConjuge,
  }).eq('id', id)
  if (error) throw new Error(error.message)

  revalidatePath(`/encontro/${encontroId}`)
}

export async function desmarcarLancheAction(id: string, encontroId: string) {
  const admin = createAdminClient()
  const { error } = await admin.from('lanches').update({ responsavel_id: null, responsavel: null }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath(`/encontro/${encontroId}`)
}
