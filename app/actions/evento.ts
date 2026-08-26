'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { acessoAoEvento } from '@/lib/eventos-permissoes'
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
  /** Rótulo livre quando `tipo` é "outro". */
  tipo_outro?: string | null
  imagem_url?: string | null
  /** Capa horizontal do topo da página. Sem ela, o card faz as vezes. */
  capa_pagina_url?: string | null
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
    tipo_outro: data.tipo === 'outro' ? (data.tipo_outro?.trim() || null) : null,
    rede_id: data.rede_id ?? null,
    celula_id: data.celula_id ?? null,
    igreja_id: profile.igreja_id,
    created_by: user.id,
    imagem_url: data.imagem_url ?? null,
    capa_pagina_url: data.capa_pagina_url ?? null,
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
    /** Rótulo livre quando `tipo` é "outro". */
    tipo_outro?: string | null
    /** Vínculo do evento. Omitidos, os atuais são mantidos. */
    rede_id?: string | null
    celula_id?: string | null
    imagem_url?: string | null
    /** Omitida, a capa atual é mantida; `null` remove. */
    capa_pagina_url?: string | null
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
    tipo_outro: data.tipo === 'outro' ? (data.tipo_outro?.trim() || null) : null,
    imagem_url: data.imagem_url ?? null,
    // Chaves ausentes ficam de fora do update: quem não manda o campo mantém o
    // que está gravado, em vez de apagá-lo sem querer.
    ...(data.rede_id !== undefined ? { rede_id: data.rede_id } : {}),
    ...(data.celula_id !== undefined ? { celula_id: data.celula_id } : {}),
    ...(data.capa_pagina_url !== undefined ? { capa_pagina_url: data.capa_pagina_url } : {}),
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

/**
 * O que a exclusão levaria junto — para a confirmação dizer números em vez de
 * perguntar "tem certeza?".
 *
 * Só a inscrição e o pagamento entram na conta: são o que representa gente que
 * já se comprometeu, e o que ninguém consegue refazer. Seção, card e botão da
 * página do evento somem junto, mas são configuração, não perda.
 */
export async function contarConteudoEventoAction(
  id: string,
  recorrenciaId: string | null
): Promise<{ inscricoes: number; pagamentos: number; naSerie: number }> {
  const acesso = await acessoAoEvento(id)
  if (!acesso?.podeVer) return { inscricoes: 0, pagamentos: 0, naSerie: 0 }

  const admin = createAdminClient()

  const [{ count: inscricoes }, { data: inscricaoIds }, { count: naSerie }] = await Promise.all([
    admin.from('inscricoes_evento').select('id', { count: 'exact', head: true }).eq('evento_id', id),
    admin.from('inscricoes_evento').select('id').eq('evento_id', id),
    recorrenciaId
      ? admin.from('eventos').select('id', { count: 'exact', head: true }).eq('recorrencia_id', recorrenciaId)
      : Promise.resolve({ count: 0 }),
  ])

  const ids = ((inscricaoIds ?? []) as { id: string }[]).map((i) => i.id)
  const { count: pagamentos } = ids.length > 0
    ? await admin
        .from('inscricao_pagamentos')
        .select('id', { count: 'exact', head: true })
        .in('inscricao_id', ids)
    : { count: 0 }

  return {
    inscricoes: inscricoes ?? 0,
    pagamentos: pagamentos ?? 0,
    naSerie: naSerie ?? 0,
  }
}

/**
 * Apaga o evento — e, num evento recorrente, o pedaço da série que se escolher.
 *
 * Exige `podeDelegar`, e não `pode`: quem só recebeu a gestão do evento
 * controla o dinheiro dele (é o caso do tesoureiro sem cargo), mas apagar a
 * coisa toda é de quem responde por ela — direção, quem criou, ou o supervisor
 * da rede.
 *
 * As tabelas filhas caem por CASCADE no banco: inscrições, pagamentos,
 * presenças, seções, cards, botões, fotos, curtidas, valores e parcelas.
 */
export async function excluirEventoAction(
  id: string,
  dataHoraAtual: string,
  recorrenciaId: string | null,
  escopo: EscopoEdicao
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const acesso = await acessoAoEvento(id)
  if (!acesso) return { ok: false, erro: 'Faça login para excluir este evento.' }
  if (!acesso.podeDelegar) {
    return { ok: false, erro: 'Só quem criou o evento, a supervisão da rede ou a direção pode excluí-lo.' }
  }

  const admin = createAdminClient()

  if (escopo === 'este' || !recorrenciaId) {
    const { error } = await admin.from('eventos').delete().eq('id', id)
    if (error) return { ok: false, erro: error.message }
  } else if (escopo === 'este_e_seguintes') {
    // O passado fica: apagar ocorrências já realizadas levaria junto a lista
    // de quem esteve nelas.
    const { error } = await admin
      .from('eventos')
      .delete()
      .eq('recorrencia_id', recorrenciaId)
      .gte('data_hora', dataHoraAtual)
    if (error) return { ok: false, erro: error.message }
  } else {
    const { error } = await admin
      .from('eventos')
      .delete()
      .eq('recorrencia_id', recorrenciaId)
    if (error) return { ok: false, erro: error.message }
  }

  revalidarPaths()
  return { ok: true }
}

export type DestinoEvento = { id: string; nome: string }
export type CelulaDestino = DestinoEvento & { rede_id: string }

/**
 * Redes e células da igreja, para o formulário perguntar "de qual rede?" /
 * "de qual célula?" quando o tipo do evento pede um dono.
 *
 * Sem isso um evento de rede nascia solto: aparecia com o selo de rede, mas sem
 * `rede_id`, então não entrava na página de rede nenhuma.
 */
export async function listarDestinosEventoAction(): Promise<{
  redes: DestinoEvento[]
  celulas: CelulaDestino[]
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { data: profile } = await supabase
    .from('profiles')
    .select('igreja_id')
    .eq('id', user.id)
    .single()
  if (!profile) throw new Error('Perfil não encontrado')

  const admin = createAdminClient()

  const { data: redes } = await admin
    .from('redes')
    .select('id, nome')
    .eq('igreja_id', profile.igreja_id)
    .order('nome')

  const lista = (redes ?? []) as DestinoEvento[]
  if (lista.length === 0) return { redes: [], celulas: [] }

  // Célula não tem `igreja_id`: pendura na rede, então o filtro passa por ela.
  const { data: celulas } = await admin
    .from('celulas')
    .select('id, nome, rede_id')
    .in('rede_id', lista.map((r) => r.id))
    .eq('ativa', true)
    .order('nome')

  return { redes: lista, celulas: (celulas ?? []) as CelulaDestino[] }
}
