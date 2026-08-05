'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { acessoEnsino, podeLecionar } from '@/lib/ensino/permissoes'
import type { StatusAula } from '@/lib/supabase/types'
import type { ResultadoAcao } from '@/lib/ensino/tipos'

export async function criarAulaAction(params: {
  turmaId: string
  data: string
  numero?: number | null
  titulo?: string | null
  descricao?: string | null
  horaInicio?: string | null
  local?: string | null
}): Promise<{ ok: true; id: string } | { ok: false; erro: string }> {
  const acesso = await acessoEnsino()
  if (!(await podeLecionar(acesso, params.turmaId))) {
    return { ok: false, erro: 'Você não administra esta turma.' }
  }
  if (!params.data) return { ok: false, erro: 'A aula precisa de uma data.' }

  const admin = createAdminClient()

  // Numeração contínua: sem número informado, a aula entra depois da última.
  let numero = params.numero ?? null
  if (numero === null) {
    const { data: ultima } = await admin
      .from('ensino_aulas')
      .select('numero')
      .eq('turma_id', params.turmaId)
      .order('numero', { ascending: false })
      .limit(1)
      .maybeSingle()
    numero = (ultima?.numero ?? 0) + 1
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ensino_aulas')
    .insert({
      turma_id: params.turmaId,
      numero,
      data: params.data,
      titulo: params.titulo?.trim() || null,
      descricao: params.descricao?.trim() || null,
      hora_inicio: params.horaInicio || null,
      local: params.local?.trim() || null,
    })
    .select('id')
    .single()

  if (error || !data) {
    // A chave única (turma, número) é a única violação previsível aqui.
    const duplicada = error?.code === '23505'
    return {
      ok: false,
      erro: duplicada
        ? `Já existe a aula ${numero} nesta turma.`
        : error?.message ?? 'Não foi possível criar a aula.',
    }
  }

  revalidatePath(`/ensino/turma/${params.turmaId}`)
  revalidatePath(`/ensino/turma/${params.turmaId}/aulas`)
  return { ok: true, id: data.id }
}

export async function editarAulaAction(
  id: string,
  params: {
    data: string
    titulo?: string | null
    descricao?: string | null
    horaInicio?: string | null
    local?: string | null
    status?: StatusAula
  }
): Promise<ResultadoAcao> {
  const acesso = await acessoEnsino()

  const admin = createAdminClient()
  const { data: aula } = await admin
    .from('ensino_aulas')
    .select('turma_id')
    .eq('id', id)
    .single()

  if (!aula) return { ok: false, erro: 'Aula não encontrada.' }
  if (!(await podeLecionar(acesso, aula.turma_id))) {
    return { ok: false, erro: 'Você não administra esta turma.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('ensino_aulas')
    .update({
      data: params.data,
      titulo: params.titulo?.trim() || null,
      descricao: params.descricao?.trim() || null,
      hora_inicio: params.horaInicio || null,
      local: params.local?.trim() || null,
      ...(params.status ? { status: params.status } : {}),
    })
    .eq('id', id)

  if (error) return { ok: false, erro: error.message }
  revalidatePath(`/ensino/turma/${aula.turma_id}/aulas`)
  revalidatePath(`/ensino/chamada/${id}`)
  return { ok: true }
}

export async function excluirAulaAction(id: string): Promise<ResultadoAcao> {
  const acesso = await acessoEnsino()

  const admin = createAdminClient()
  const { data: aula } = await admin
    .from('ensino_aulas')
    .select('turma_id')
    .eq('id', id)
    .single()

  if (!aula) return { ok: false, erro: 'Aula não encontrada.' }
  if (!(await podeLecionar(acesso, aula.turma_id))) {
    return { ok: false, erro: 'Você não administra esta turma.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('ensino_aulas').delete().eq('id', id)

  if (error) return { ok: false, erro: error.message }
  revalidatePath(`/ensino/turma/${aula.turma_id}/aulas`)
  return { ok: true }
}

/**
 * Cria de uma vez o calendário da turma a partir dos dias da semana e da data
 * de início — é o que substitui as 12 linhas digitadas à mão na planilha.
 *
 * Aulas já existentes são preservadas: gera só o que falta para chegar ao
 * total, continuando da última data.
 */
export async function gerarAulasAction(
  turmaId: string
): Promise<{ ok: true; criadas: number } | { ok: false; erro: string }> {
  const acesso = await acessoEnsino()
  if (!(await podeLecionar(acesso, turmaId))) {
    return { ok: false, erro: 'Você não administra esta turma.' }
  }

  const admin = createAdminClient()
  const { data: turma } = await admin
    .from('ensino_turmas')
    .select('data_inicio, data_fim, dias_semana, total_aulas, horario_inicio, local')
    .eq('id', turmaId)
    .single()

  if (!turma) return { ok: false, erro: 'Turma não encontrada.' }
  if (!turma.data_inicio) return { ok: false, erro: 'Defina a data de início da turma primeiro.' }
  if (!turma.dias_semana?.length) {
    return { ok: false, erro: 'Defina os dias da semana das aulas primeiro.' }
  }

  const { data: existentes } = await admin
    .from('ensino_aulas')
    .select('numero, data')
    .eq('turma_id', turmaId)
    .order('numero', { ascending: false })

  const jaCriadas = existentes?.length ?? 0
  const total = turma.total_aulas ?? 0
  if (total > 0 && jaCriadas >= total) {
    return { ok: false, erro: 'A turma já tem todas as aulas cadastradas.' }
  }

  // Datas em "AAAA-MM-DD" tratadas como calendário puro: `new Date('2026-03-10')`
  // seria meia-noite UTC, que em Natal ainda é o dia 9.
  const partes = (iso: string) => iso.split('-').map(Number)
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  const ultimaData = existentes?.[0]?.data ?? null
  const [ai, mi, di] = partes(ultimaData ?? turma.data_inicio)
  const cursor = new Date(ai, mi - 1, di)
  // Continuando de uma aula existente, começa no dia seguinte a ela.
  if (ultimaData) cursor.setDate(cursor.getDate() + 1)

  const limite = turma.data_fim ? (() => { const [a, m, d] = partes(turma.data_fim!); return new Date(a, m - 1, d) })() : null
  const dias = new Set(turma.dias_semana)
  const alvo = total > 0 ? total - jaCriadas : 12
  const novas: { turma_id: string; numero: number; data: string; hora_inicio: string | null; local: string | null }[] = []

  // Teto de segurança: dois anos de varredura diária, para nunca virar laço
  // infinito se os dias da semana vierem inconsistentes.
  for (let i = 0; i < 730 && novas.length < alvo; i++) {
    if (limite && cursor > limite) break
    if (dias.has(cursor.getDay())) {
      novas.push({
        turma_id: turmaId,
        numero: jaCriadas + novas.length + 1,
        data: iso(cursor),
        hora_inicio: turma.horario_inicio,
        local: turma.local,
      })
    }
    cursor.setDate(cursor.getDate() + 1)
  }

  if (novas.length === 0) return { ok: false, erro: 'Nenhuma data encontrada no período informado.' }

  const { error } = await admin.from('ensino_aulas').insert(novas)
  if (error) return { ok: false, erro: error.message }

  revalidatePath(`/ensino/turma/${turmaId}/aulas`)
  revalidatePath(`/ensino/turma/${turmaId}`)
  return { ok: true, criadas: novas.length }
}
