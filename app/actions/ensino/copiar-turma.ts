'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { acessoEnsino, podeLecionar } from '@/lib/ensino/permissoes'
import { BUCKET_MATERIAIS } from '@/lib/ensino/tipos'
import { datasNoCalendario, hojeIso } from '@/lib/ensino/calendario'
import type { OpcoesCopia } from '@/lib/ensino/copia'
import type { CandidatoProfessor } from '@/app/actions/ensino/equipe'
import type {
  ModoTurma, ModoVideoChamada, TipoInscricaoTurma, TipoMaterial,
} from '@/lib/supabase/types'

/**
 * Copiar uma turma para a seguinte.
 *
 * São dois passos, e por um motivo: o que cabe no formulário (curso, descrição,
 * horários, equipe) volta para a tela e continua editável antes de salvar —
 * `carregarTurmaModeloAction`; o que não cabe (fundo, aulas, materiais e os
 * arquivos no bucket) é copiado no servidor depois que a turma nova existe —
 * `copiarConteudoTurmaAction`.
 */

export interface TurmaModelo {
  id: string
  nome: string
  cursoId: string
  descricao: string | null
  capaUrl: string | null
  local: string | null
  diasSemana: number[]
  horarioInicio: string | null
  horarioFim: string | null
  totalAulas: number | null
  vagas: number | null
  modo: ModoTurma
  sequencial: boolean
  inscricoesAbertas: boolean
  aprovacaoAutomatica: boolean
  tipoInscricao: TipoInscricaoTurma
  linkInscricaoUrl: string | null
  formularioId: string | null
  whatsappUrl: string | null
  videoChamadaModo: ModoVideoChamada
  videoChamadaUrl: string | null
  /** Já no formato da lista de professores do formulário. */
  professores: CandidatoProfessor[]
  /** Para a tela dizer "12 aulas · 8 materiais" antes de copiar. */
  totalDeAulas: number
  totalDeMateriais: number
}

const CAMPOS_MODELO =
  'id, igreja_id, nome, curso_id, descricao, capa_url, local, dias_semana, horario_inicio, ' +
  'horario_fim, total_aulas, vagas, modo, sequencial, inscricoes_abertas, aprovacao_automatica, ' +
  'tipo_inscricao, link_inscricao_url, formulario_id, whatsapp_url, video_chamada_modo, video_chamada_url'

/**
 * A turma escolhida como modelo, pronta para preencher o formulário.
 *
 * Basta ser da equipe do Ensino: quem pode criar turma já vê todas as turmas da
 * igreja na listagem, então copiar de uma delas não revela nada novo. O que a
 * função **não** devolve são alunos, inscrições e presenças — esses são de quem
 * cursou, e não do curso.
 */
export async function carregarTurmaModeloAction(
  turmaId: string
): Promise<{ ok: true; turma: TurmaModelo } | { ok: false; erro: string }> {
  const acesso = await acessoEnsino()
  if (!acesso?.professor) return { ok: false, erro: 'Sem permissão para copiar turmas.' }

  const admin = createAdminClient()
  const { data } = await admin
    .from('ensino_turmas')
    .select(CAMPOS_MODELO)
    .eq('id', turmaId)
    .maybeSingle()

  const linha = data as unknown as (Record<string, unknown> & { igreja_id: string }) | null
  if (!linha) return { ok: false, erro: 'Turma não encontrada.' }
  if (linha.igreja_id !== acesso.igrejaId) {
    return { ok: false, erro: 'Turma de outra igreja.' }
  }

  const [professores, aulasRes, materiaisRes] = await Promise.all([
    professoresDaTurma(turmaId),
    admin.from('ensino_aulas').select('id', { count: 'exact', head: true }).eq('turma_id', turmaId),
    admin.from('ensino_materiais').select('id', { count: 'exact', head: true }).eq('turma_id', turmaId),
  ])

  return {
    ok: true,
    turma: {
      id: linha.id as string,
      nome: linha.nome as string,
      cursoId: linha.curso_id as string,
      descricao: (linha.descricao as string | null) ?? null,
      capaUrl: (linha.capa_url as string | null) ?? null,
      local: (linha.local as string | null) ?? null,
      diasSemana: (linha.dias_semana as number[] | null) ?? [],
      horarioInicio: (linha.horario_inicio as string | null) ?? null,
      horarioFim: (linha.horario_fim as string | null) ?? null,
      totalAulas: (linha.total_aulas as number | null) ?? null,
      vagas: (linha.vagas as number | null) ?? null,
      modo: linha.modo as ModoTurma,
      sequencial: Boolean(linha.sequencial),
      inscricoesAbertas: Boolean(linha.inscricoes_abertas),
      aprovacaoAutomatica: Boolean(linha.aprovacao_automatica),
      tipoInscricao: linha.tipo_inscricao as TipoInscricaoTurma,
      linkInscricaoUrl: (linha.link_inscricao_url as string | null) ?? null,
      formularioId: (linha.formulario_id as string | null) ?? null,
      whatsappUrl: (linha.whatsapp_url as string | null) ?? null,
      videoChamadaModo: linha.video_chamada_modo as ModoVideoChamada,
      videoChamadaUrl: (linha.video_chamada_url as string | null) ?? null,
      professores,
      totalDeAulas: aulasRes.count ?? 0,
      totalDeMateriais: materiaisRes.count ?? 0,
    },
  }
}

/** A equipe da turma modelo, com nome e foto, na ordem em que ela mostra. */
async function professoresDaTurma(turmaId: string): Promise<CandidatoProfessor[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('ensino_turma_professores')
    .select('profile_id, pre_cadastro_id, principal, profiles(nome, avatar_url), membros_pre_cadastro(nome)')
    .eq('turma_id', turmaId)
    .order('principal', { ascending: false })

  const linhas = (data ?? []) as unknown as {
    profile_id: string | null
    pre_cadastro_id: string | null
    profiles: { nome: string; avatar_url: string | null } | null
    membros_pre_cadastro: { nome: string } | null
  }[]

  const equipe: CandidatoProfessor[] = []
  for (const l of linhas) {
    if (l.profile_id && l.profiles) {
      equipe.push({
        id: l.profile_id,
        tipo: 'profile',
        nome: l.profiles.nome,
        avatarUrl: l.profiles.avatar_url,
        origem: 'equipe',
      })
    } else if (l.pre_cadastro_id && l.membros_pre_cadastro) {
      equipe.push({
        id: l.pre_cadastro_id,
        tipo: 'pre_cadastro',
        nome: l.membros_pre_cadastro.nome,
        avatarUrl: null,
        origem: 'sem_conta',
      })
    }
  }
  return equipe
}

/**
 * O que só existe depois da turma criada: fundo, capa do topo, aulas e
 * materiais.
 *
 * As aulas chegam **sem data**: a numeração e o conteúdo vêm da turma anterior,
 * mas o dia de cada uma sai do calendário da turma nova. Faltando calendário —
 * turma gravada, ou presencial ainda sem período —, todas nascem com a data de
 * início ou a de hoje, e o professor ajusta depois em "Aulas e chamada".
 */
export async function copiarConteudoTurmaAction(params: {
  origemId: string
  destinoId: string
  opcoes: OpcoesCopia
}): Promise<
  { ok: true; aulas: number; materiais: number } | { ok: false; erro: string }
> {
  const { origemId, destinoId, opcoes } = params

  const acesso = await acessoEnsino()
  if (!acesso) return { ok: false, erro: 'Não autenticado.' }
  if (!(await podeLecionar(acesso, destinoId))) {
    return { ok: false, erro: 'Você não administra a turma nova.' }
  }

  const admin = createAdminClient()

  const [origemRes, destinoRes] = await Promise.all([
    admin
      .from('ensino_turmas')
      .select(
        'id, igreja_id, capa_pagina_url, cor, cor_secundaria, fundo_tipo, fundo_imagem_url, ' +
        'fundo_opacidade, fundo_galeria, fundo_galeria_opacidade, fundo_auto_cor, fundo_auto_cor_origem'
      )
      .eq('id', origemId)
      .maybeSingle(),
    admin
      .from('ensino_turmas')
      .select('id, igreja_id, modo, data_inicio, data_fim, dias_semana, horario_inicio, local')
      .eq('id', destinoId)
      .maybeSingle(),
  ])

  const origem = origemRes.data as unknown as Record<string, unknown> | null
  const destino = destinoRes.data as unknown as Record<string, unknown> | null

  if (!origem || !destino) return { ok: false, erro: 'Turma não encontrada.' }
  if (origem.igreja_id !== acesso.igrejaId || destino.igreja_id !== acesso.igrejaId) {
    return { ok: false, erro: 'Turma de outra igreja.' }
  }

  // Aparência: a capa do topo e o fundo da página não passam pelo formulário,
  // então é aqui que eles atravessam.
  const aparencia: {
    capa_pagina_url?: string | null
    cor?: string | null
    cor_secundaria?: string | null
    fundo_tipo?: string | null
    fundo_imagem_url?: string | null
    fundo_opacidade?: number
    fundo_galeria?: boolean
    fundo_galeria_opacidade?: number
    fundo_auto_cor?: boolean
    fundo_auto_cor_origem?: string | null
  } = {}
  const texto = (v: unknown): string | null => (typeof v === 'string' ? v : null)

  if (opcoes.capa) aparencia.capa_pagina_url = texto(origem.capa_pagina_url)
  if (opcoes.fundo) {
    aparencia.cor = texto(origem.cor)
    aparencia.cor_secundaria = texto(origem.cor_secundaria)
    aparencia.fundo_tipo = texto(origem.fundo_tipo)
    aparencia.fundo_imagem_url = texto(origem.fundo_imagem_url)
    aparencia.fundo_opacidade = (origem.fundo_opacidade as number | null) ?? 100
    aparencia.fundo_galeria = Boolean(origem.fundo_galeria)
    aparencia.fundo_galeria_opacidade = (origem.fundo_galeria_opacidade as number | null) ?? 35
    aparencia.fundo_auto_cor = Boolean(origem.fundo_auto_cor)
    aparencia.fundo_auto_cor_origem = texto(origem.fundo_auto_cor_origem)
  }
  if (Object.keys(aparencia).length > 0) {
    const { error } = await admin.from('ensino_turmas').update(aparencia).eq('id', destinoId)
    if (error) return { ok: false, erro: error.message }
  }

  // De aula da turma antiga para aula da turma nova, para os materiais
  // reencontrarem a aula a que pertenciam.
  const equivalente = new Map<string, string>()
  let aulasCriadas = 0

  if (opcoes.aulas) {
    const criadas = await copiarAulas(origemId, destinoId, destino, equivalente)
    if (!criadas.ok) return criadas
    aulasCriadas = criadas.total
  }

  let materiaisCriados = 0
  if (opcoes.materiais) {
    const criados = await copiarMateriais(origemId, destinoId, equivalente, acesso.userId)
    if (!criados.ok) return criados
    materiaisCriados = criados.total
  }

  revalidatePath(`/ensino/turma/${destinoId}`)
  revalidatePath(`/ensino/turma/${destinoId}/aulas`)
  revalidatePath(`/ensino/turma/${destinoId}/materiais`)
  return { ok: true, aulas: aulasCriadas, materiais: materiaisCriados }
}

async function copiarAulas(
  origemId: string,
  destinoId: string,
  destino: Record<string, unknown>,
  equivalente: Map<string, string>
): Promise<{ ok: true; total: number } | { ok: false; erro: string }> {
  const admin = createAdminClient()

  const [{ data: origemAulas }, { count: jaExistem }] = await Promise.all([
    admin
      .from('ensino_aulas')
      .select('id, numero, titulo, descricao')
      .eq('turma_id', origemId)
      .order('numero'),
    admin
      .from('ensino_aulas')
      .select('id', { count: 'exact', head: true })
      .eq('turma_id', destinoId),
  ])

  const aulas = (origemAulas ?? []) as {
    id: string; numero: number; titulo: string | null; descricao: string | null
  }[]
  if (aulas.length === 0) return { ok: true, total: 0 }

  // A turma nova é recém-criada; aula já cadastrada aqui significa que a cópia
  // rodou duas vezes, e insistir só esbarraria na chave única (turma, número).
  if ((jaExistem ?? 0) > 0) {
    return { ok: false, erro: 'A turma nova já tem aulas — as da turma anterior não foram copiadas.' }
  }

  const gravado = destino.modo === 'gravado'
  const calendario = gravado
    ? []
    : datasNoCalendario(
        {
          dataInicio: (destino.data_inicio as string | null) ?? null,
          dataFim: (destino.data_fim as string | null) ?? null,
          diasSemana: (destino.dias_semana as number[] | null) ?? [],
        },
        aulas.length
      )

  // Sem calendário a data ainda precisa existir: a coluna é obrigatória.
  const reserva = (destino.data_inicio as string | null) ?? hojeIso()

  const novas = aulas.map((a, i) => ({
    turma_id: destinoId,
    numero: a.numero,
    titulo: a.titulo,
    descricao: a.descricao,
    data: calendario[i] ?? reserva,
    hora_inicio: gravado ? null : ((destino.horario_inicio as string | null) ?? null),
    local: gravado ? null : ((destino.local as string | null) ?? null),
  }))

  const { data: inseridas, error } = await admin
    .from('ensino_aulas')
    .insert(novas)
    .select('id, numero')

  if (error) return { ok: false, erro: `Não consegui copiar as aulas: ${error.message}` }

  const porNumero = new Map(
    ((inseridas ?? []) as { id: string; numero: number }[]).map((a) => [a.numero, a.id])
  )
  for (const a of aulas) {
    const novoId = porNumero.get(a.numero)
    if (novoId) equivalente.set(a.id, novoId)
  }

  return { ok: true, total: novas.length }
}

async function copiarMateriais(
  origemId: string,
  destinoId: string,
  equivalente: Map<string, string>,
  userId: string
): Promise<{ ok: true; total: number } | { ok: false; erro: string }> {
  const admin = createAdminClient()

  const { data } = await admin
    .from('ensino_materiais')
    .select('id, aula_id, titulo, descricao, tipo, url, arquivo_path, arquivo_nome, arquivo_tamanho, publico, ordem')
    .eq('turma_id', origemId)
    .order('ordem')

  const materiais = (data ?? []) as {
    id: string; aula_id: string | null; titulo: string; descricao: string | null
    tipo: TipoMaterial; url: string | null; arquivo_path: string | null
    arquivo_nome: string | null; arquivo_tamanho: number | null
    publico: boolean; ordem: number
  }[]
  if (materiais.length === 0) return { ok: true, total: 0 }

  const linhas: {
    turma_id: string
    aula_id: string | null
    titulo: string
    descricao: string | null
    tipo: TipoMaterial
    url: string | null
    arquivo_path: string | null
    arquivo_nome: string | null
    arquivo_tamanho: number | null
    publico: boolean
    ordem: number
    criado_por: string
  }[] = []
  const copiados: string[] = []

  for (const m of materiais) {
    let caminho = m.arquivo_path

    // O arquivo é duplicado de verdade no bucket. Duas linhas apontando para o
    // mesmo objeto pareceria funcionar até alguém excluir um dos materiais: a
    // exclusão apaga o arquivo, e o material da outra turma pararia de abrir.
    if (m.arquivo_path) {
      const nome = m.arquivo_path.split('/').pop() ?? 'arquivo'
      caminho = `${destinoId}/${Date.now()}-${nome}`
      const { error } = await admin.storage
        .from(BUCKET_MATERIAIS)
        .copy(m.arquivo_path, caminho)

      if (error) {
        if (copiados.length > 0) {
          await admin.storage.from(BUCKET_MATERIAIS).remove(copiados)
        }
        return { ok: false, erro: `Não consegui copiar o arquivo "${m.titulo}": ${error.message}` }
      }
      copiados.push(caminho)
    }

    linhas.push({
      turma_id: destinoId,
      // Material de aula só reencontra a aula se as aulas vieram junto; senão
      // vira material da turma, que é onde ele aparece de qualquer forma.
      aula_id: m.aula_id ? (equivalente.get(m.aula_id) ?? null) : null,
      titulo: m.titulo,
      descricao: m.descricao,
      tipo: m.tipo,
      url: m.url,
      arquivo_path: caminho,
      arquivo_nome: m.arquivo_nome,
      arquivo_tamanho: m.arquivo_tamanho,
      publico: m.publico,
      ordem: m.ordem,
      criado_por: userId,
    })
  }

  const { error } = await admin.from('ensino_materiais').insert(linhas)
  if (error) {
    // Sem isto os arquivos ficariam órfãos no bucket, sem linha que os cite.
    if (copiados.length > 0) await admin.storage.from(BUCKET_MATERIAIS).remove(copiados)
    return { ok: false, erro: `Não consegui copiar os materiais: ${error.message}` }
  }

  return { ok: true, total: linhas.length }
}
