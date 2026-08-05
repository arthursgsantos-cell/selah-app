'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import type { TipoEvento, RecorrenciaTipo, TipoInscricao, TipoChavePix } from '@/lib/supabase/types'

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

export async function uploadCapaEventoAction(formData: FormData): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const file = formData.get('file') as File
  if (!file) throw new Error('Arquivo não encontrado')

  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${crypto.randomUUID()}.${ext}`
  const arrayBuffer = await file.arrayBuffer()

  const admin = createAdminClient()
  const { error } = await admin.storage
    .from('evento-capas')
    .upload(path, arrayBuffer, { contentType: file.type })
  if (error) throw new Error(error.message)

  const { data } = admin.storage.from('evento-capas').getPublicUrl(path)
  return data.publicUrl
}

export async function createEventoAction(data: {
  titulo: string
  descricao?: string
  data_hora: string
  data_hora_fim?: string | null
  local?: string
  tipo: TipoEvento
  rede_id?: string | null
  celula_id?: string | null
  imagem_url?: string | null
  recorrencia?: RecorrenciaTipo
  tipo_inscricao?: import('@/lib/supabase/types').TipoInscricao
  whatsapp_inscricao?: string | null
  pix_chave?: string | null
  pix_tipo?: import('@/lib/supabase/types').TipoChavePix | null
  pix_nome?: string | null
  pix_valor?: number | null
  formulario_id?: string | null
  link_inscricao_url?: string | null
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
    tipo_inscricao: data.tipo_inscricao ?? 'aberto',
    whatsapp_inscricao: data.whatsapp_inscricao ?? null,
    pix_chave: data.pix_chave ?? null,
    pix_tipo: data.pix_tipo ?? null,
    pix_nome: data.pix_nome ?? null,
    pix_valor: data.pix_valor ?? null,
    formulario_id: data.formulario_id ?? null,
    link_inscricao_url: data.link_inscricao_url ?? null,
  }

  const admin = createAdminClient()

  // Duração fixa (ms) reaplicada em cada ocorrência da recorrência
  const duracaoMs = data.data_hora_fim
    ? new Date(data.data_hora_fim).getTime() - new Date(data.data_hora).getTime()
    : null

  if (!data.recorrencia) {
    const { error } = await admin.from('eventos').insert({
      ...base,
      data_hora: data.data_hora,
      data_hora_fim: data.data_hora_fim ?? null,
    })
    if (error) throw new Error(error.message)
  } else {
    const recorrencia_id = crypto.randomUUID()
    const count = RECORRENCIA_COUNT[data.recorrencia]
    const start = new Date(data.data_hora)

    const eventos = Array.from({ length: count }, (_, i) => {
      const inicio = nextDate(start, data.recorrencia!, i)
      return {
        ...base,
        data_hora: inicio.toISOString(),
        data_hora_fim: duracaoMs != null ? new Date(inicio.getTime() + duracaoMs).toISOString() : null,
        recorrencia_id,
        recorrencia_tipo: data.recorrencia,
      }
    })

    const { error } = await admin.from('eventos').insert(eventos)
    if (error) throw new Error(error.message)
  }

  revalidarPaths()
  if (data.rede_id) revalidatePath(`/rede/${data.rede_id}`)
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
    data_hora_fim?: string | null
    local?: string
    tipo: TipoEvento
    imagem_url?: string | null
    /** Configuração de inscrição — se omitida, a atual é mantida. */
    inscricao?: {
      tipo_inscricao: TipoInscricao
      whatsapp_inscricao?: string | null
      pix_chave?: string | null
      pix_tipo?: TipoChavePix | null
      pix_nome?: string | null
      pix_valor?: number | null
      formulario_id?: string | null
      link_inscricao_url?: string | null
    }
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
    ...(data.inscricao
      ? {
          tipo_inscricao: data.inscricao.tipo_inscricao,
          whatsapp_inscricao: data.inscricao.whatsapp_inscricao ?? null,
          pix_chave: data.inscricao.pix_chave ?? null,
          pix_tipo: data.inscricao.pix_tipo ?? null,
          pix_nome: data.inscricao.pix_nome ?? null,
          pix_valor: data.inscricao.pix_valor ?? null,
          formulario_id: data.inscricao.formulario_id ?? null,
          link_inscricao_url: data.inscricao.link_inscricao_url ?? null,
        }
      : {}),
  }

  const admin = createAdminClient()

  if (escopo === 'este' || !recorrenciaId) {
    const { error } = await admin
      .from('eventos')
      .update({ ...camposComuns, data_hora: data.data_hora, data_hora_fim: data.data_hora_fim ?? null })
      .eq('id', id)
    if (error) throw new Error(error.message)
  } else if (escopo === 'este_e_seguintes') {
    const { error } = await admin
      .from('eventos')
      .update(camposComuns)
      .eq('recorrencia_id', recorrenciaId)
      .gte('data_hora', dataHoraAtual)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await admin
      .from('eventos')
      .update(camposComuns)
      .eq('recorrencia_id', recorrenciaId)
    if (error) throw new Error(error.message)
  }

  revalidarPaths()
}
