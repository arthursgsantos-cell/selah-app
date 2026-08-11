/**
 * Consultas de leitura do Ensino.
 *
 * Ficam fora das server actions porque são chamadas direto pelos Server
 * Components — e porque montar `TurmaResumo` exige juntar três fontes (turma,
 * professores e contagem de aprovados) que, repetidas em cada página, sairiam
 * do compasso.
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { contarAprovados } from '@/app/actions/ensino/turmas'
import { ehUuid } from '@/lib/slug-ou-id'
import type { TurmaResumo } from '@/components/ensino/turma-card'
import type { StatusInscricaoEnsino, StatusTurma } from '@/lib/supabase/types'

type LinhaTurma = {
  id: string
  slug: string | null
  nome: string
  capa_url: string | null
  local: string | null
  data_inicio: string | null
  data_fim: string | null
  dias_semana: number[]
  horario_inicio: string | null
  horario_fim: string | null
  vagas: number | null
  status: StatusTurma
  ensino_cursos: { nome: string } | null
}

/**
 * O UUID da turma a partir do que veio na URL — slug ou o próprio id.
 *
 * Tudo abaixo de `/ensino/turma/[id]` consulta por UUID, e `podeLecionar`
 * compara com `turma_id`: é aqui que a chave bonita vira o que o banco entende,
 * antes de qualquer outra consulta. Devolve null quando o slug não existe, e
 * quem chama trata como turma inexistente.
 */
export async function idDaTurma(chave: string): Promise<string | null> {
  if (ehUuid(chave)) return chave

  const admin = createAdminClient()
  const { data } = await admin
    .from('ensino_turmas')
    .select('id')
    .eq('slug', chave)
    .maybeSingle()

  return (data as { id: string } | null)?.id ?? null
}

/** Primeiro nome de cada professor da turma, para caber no cartão. */
async function professoresPorTurma(turmaIds: string[]): Promise<Record<string, string[]>> {
  if (turmaIds.length === 0) return {}

  const admin = createAdminClient()
  const { data } = await admin
    .from('ensino_turma_professores')
    .select('turma_id, principal, profiles(nome), membros_pre_cadastro(nome)')
    .in('turma_id', turmaIds)
    .order('principal', { ascending: false })

  const mapa: Record<string, string[]> = {}
  for (const linha of (data ?? []) as unknown as {
    turma_id: string
    profiles: { nome: string } | null
    membros_pre_cadastro: { nome: string } | null
  }[]) {
    const nome = linha.profiles?.nome ?? linha.membros_pre_cadastro?.nome
    if (!nome) continue
    const curto = nome.split(' ').slice(0, 2).join(' ')
    ;(mapa[linha.turma_id] ??= []).push(curto)
  }
  return mapa
}

function montar(
  linha: LinhaTurma,
  aprovados: Record<string, number>,
  professores: Record<string, string[]>
): TurmaResumo {
  return {
    id: linha.id,
    slug: linha.slug,
    nome: linha.nome,
    cursoNome: linha.ensino_cursos?.nome ?? 'Curso',
    capaUrl: linha.capa_url,
    local: linha.local,
    dataInicio: linha.data_inicio,
    dataFim: linha.data_fim,
    diasSemana: linha.dias_semana ?? [],
    horarioInicio: linha.horario_inicio,
    horarioFim: linha.horario_fim,
    vagas: linha.vagas,
    status: linha.status,
    aprovados: aprovados[linha.id] ?? 0,
    professores: professores[linha.id] ?? [],
  }
}

const CAMPOS =
  'id, slug, nome, capa_url, local, data_inicio, data_fim, dias_semana, horario_inicio, horario_fim, vagas, status, ensino_cursos(nome)'

/** Turmas da igreja, das mais recentes para as mais antigas. */
export async function listarTurmas(opcoes?: {
  igrejaId?: string
  status?: StatusTurma[]
  ids?: string[]
}): Promise<TurmaResumo[]> {
  const supabase = await createClient()

  let query = supabase.from('ensino_turmas').select(CAMPOS)
  if (opcoes?.igrejaId) query = query.eq('igreja_id', opcoes.igrejaId)
  if (opcoes?.status?.length) query = query.in('status', opcoes.status)
  if (opcoes?.ids) {
    if (opcoes.ids.length === 0) return []
    query = query.in('id', opcoes.ids)
  }

  const { data } = await query.order('criado_em', { ascending: false })
  const linhas = (data ?? []) as unknown as LinhaTurma[]
  if (linhas.length === 0) return []

  const ids = linhas.map((l) => l.id)
  const [aprovados, professores] = await Promise.all([
    contarAprovados(ids),
    professoresPorTurma(ids),
  ])

  return linhas.map((l) => montar(l, aprovados, professores))
}

/** Status da minha inscrição em cada turma, para o selo no cartão. */
export async function minhasInscricoesPorTurma(
  userId: string
): Promise<Record<string, StatusInscricaoEnsino>> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('ensino_inscricoes')
    .select('turma_id, status')
    .eq('user_id', userId)
    .neq('status', 'cancelada')

  const mapa: Record<string, StatusInscricaoEnsino> = {}
  for (const linha of data ?? []) mapa[linha.turma_id] = linha.status
  return mapa
}
