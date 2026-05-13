'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { TipoEvento, RecorrenciaTipo } from '@/lib/supabase/types'

type EscopoEdicao = 'este' | 'este_e_seguintes' | 'todos'

const RECORRENCIA_COUNT: Record<RecorrenciaTipo, number> = {
  semanal: 52,
  quinzenal: 26,
  mensal: 12,
}

function nextDate(base: Date, tipo: RecorrenciaTipo, i: number): Date {
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

function revalidarPaths() {
  revalidatePath('/eventos')
  revalidatePath('/home')
  revalidatePath('/supervisor')
  revalidatePath('/pastor')
}

export async function createEventoAction(data: {
  titulo: string
  descricao?: string
  data_hora: string
  local?: string
  tipo: TipoEvento
  rede_id?: string | null
  celula_id?: string | null
  imagem_url?: string | null
  recorrencia?: RecorrenciaTipo
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { data: profile } = await supabase
    .from('profiles')
    .select('igreja_id')
    .eq('id', user.id)
    .single()
  if (!profile) throw new Error('Perfil não encontrado')

  const base = {
    titulo: data.titulo,
    descricao: data.descricao ?? null,
    local: data.local ?? null,
    tipo: data.tipo,
    rede_id: data.rede_id ?? null,
    celula_id: data.celula_id ?? null,
    igreja_id: profile.igreja_id,
    created_by: user.id,
    imagem_url: data.imagem_url ?? null,
  }

  if (!data.recorrencia) {
    const { error } = await supabase.from('eventos').insert({
      ...base,
      data_hora: data.data_hora,
    })
    if (error) throw new Error(error.message)
  } else {
    const recorrencia_id = crypto.randomUUID()
    const count = RECORRENCIA_COUNT[data.recorrencia]
    const start = new Date(data.data_hora)

    const eventos = Array.from({ length: count }, (_, i) => ({
      ...base,
      data_hora: nextDate(start, data.recorrencia!, i).toISOString(),
      recorrencia_id,
      recorrencia_tipo: data.recorrencia,
    }))

    const { error } = await supabase.from('eventos').insert(eventos)
    if (error) throw new Error(error.message)
  }

  revalidarPaths()
}

export async function updateEventoAction(
  id: string,
  dataHoraAtual: string,
  recorrenciaId: string | null,
  escopo: EscopoEdicao,
  data: {
    titulo: string
    descricao?: string
    data_hora: string
    local?: string
    tipo: TipoEvento
    imagem_url?: string | null
  }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const camposComuns = {
    titulo: data.titulo,
    descricao: data.descricao ?? null,
    local: data.local ?? null,
    tipo: data.tipo,
    imagem_url: data.imagem_url ?? null,
  }

  if (escopo === 'este' || !recorrenciaId) {
    const { error } = await supabase
      .from('eventos')
      .update({ ...camposComuns, data_hora: data.data_hora })
      .eq('id', id)
    if (error) throw new Error(error.message)
  } else if (escopo === 'este_e_seguintes') {
    const { error } = await supabase
      .from('eventos')
      .update(camposComuns)
      .eq('recorrencia_id', recorrenciaId)
      .gte('data_hora', dataHoraAtual)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabase
      .from('eventos')
      .update(camposComuns)
      .eq('recorrencia_id', recorrenciaId)
    if (error) throw new Error(error.message)
  }

  revalidarPaths()
}
