'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { acessoEnsino, podeLecionar } from '@/lib/ensino/permissoes'
import type {
  ModoTurma, ModoVideoChamada, StatusTurma, TipoInscricaoTurma,
} from '@/lib/supabase/types'
import { BUCKET_CAPAS, type ResultadoAcao } from '@/lib/ensino/tipos'

/**
 * Sobe a capa de um curso ou turma para o bucket público `ensino-capas` e
 * devolve a URL. Mesmo fluxo das capas de evento.
 */
export async function uploadCapaEnsinoAction(formData: FormData): Promise<string | null> {
  const acesso = await acessoEnsino()
  if (!acesso?.professor) throw new Error('Sem permissão para enviar capas.')

  const arquivo = formData.get('file')
  if (!(arquivo instanceof File) || arquivo.size === 0) return null
  if (arquivo.size > 5 * 1024 * 1024) throw new Error('A capa passa de 5 MB.')

  const extensao = arquivo.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const caminho = `${acesso.igrejaId}/${Date.now()}.${extensao}`

  const admin = createAdminClient()
  const { error } = await admin.storage
    .from(BUCKET_CAPAS)
    .upload(caminho, arquivo, { contentType: arquivo.type || 'image/jpeg', upsert: false })

  if (error) throw new Error(error.message)

  const { data } = admin.storage.from(BUCKET_CAPAS).getPublicUrl(caminho)
  return data.publicUrl
}

export interface DadosTurma {
  cursoId: string
  nome: string
  descricao?: string | null
  capaUrl?: string | null
  local?: string | null
  dataInicio?: string | null
  dataFim?: string | null
  diasSemana?: number[]
  horarioInicio?: string | null
  horarioFim?: string | null
  totalAulas?: number | null
  vagas?: number | null
  inscricoesAbertas?: boolean
  aprovacaoAutomatica?: boolean
  status?: StatusTurma
  modo?: ModoTurma
  /** Só vale em `gravado`: a aula N só abre com a N-1 concluída. */
  sequencial?: boolean
  /**
   * O grupo da turma. Em `tipoInscricao = 'whatsapp'` é também o destino do
   * botão de inscrição — entrar no grupo é a confirmação.
   */
  whatsappUrl?: string | null
  tipoInscricao?: TipoInscricaoTurma
  linkInscricaoUrl?: string | null
  formularioId?: string | null
  videoChamadaModo?: ModoVideoChamada
  videoChamadaUrl?: string | null
  /** Ids de perfis. Quem cria já entra como professor se a lista vier vazia. */
  professores?: string[]
}

function limpar(v: string | null | undefined): string | null {
  const t = v?.trim()
  return t ? t : null
}

function videoModo(dados: DadosTurma): ModoVideoChamada {
  if (dados.modo === 'gravado') return 'nenhum'
  return dados.videoChamadaModo ?? 'nenhum'
}

/**
 * O que só o servidor pode garantir: um tipo de inscrição sem o destino dele
 * deixaria a página da turma com um botão que não leva a lugar nenhum.
 */
function inscricaoIncompleta(dados: DadosTurma): string | null {
  if (dados.tipoInscricao === 'whatsapp' && !limpar(dados.whatsappUrl)) {
    return 'Informe o link do grupo no WhatsApp — é o destino da inscrição.'
  }
  if (dados.tipoInscricao === 'link' && !limpar(dados.linkInscricaoUrl)) {
    return 'Informe o endereço do formulário externo.'
  }
  if (videoModo(dados) === 'turma' && !limpar(dados.videoChamadaUrl)) {
    return 'Informe o link da videochamada do curso.'
  }
  return null
}

export async function criarTurmaAction(dados: DadosTurma): Promise<
  { ok: true; id: string } | { ok: false; erro: string }
> {
  const acesso = await acessoEnsino()
  if (!acesso?.professor) return { ok: false, erro: 'Sem permissão para criar turmas.' }
  if (!dados.nome.trim()) return { ok: false, erro: 'A turma precisa de um nome.' }
  if (!dados.cursoId) return { ok: false, erro: 'Escolha o curso da turma.' }

  const faltando = inscricaoIncompleta(dados)
  if (faltando) return { ok: false, erro: faltando }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ensino_turmas')
    .insert({
      curso_id: dados.cursoId,
      igreja_id: acesso.igrejaId,
      nome: dados.nome.trim(),
      descricao: limpar(dados.descricao),
      capa_url: limpar(dados.capaUrl),
      local: limpar(dados.local),
      data_inicio: limpar(dados.dataInicio),
      data_fim: limpar(dados.dataFim),
      dias_semana: dados.diasSemana ?? [],
      horario_inicio: limpar(dados.horarioInicio),
      horario_fim: limpar(dados.horarioFim),
      total_aulas: dados.totalAulas ?? null,
      vagas: dados.vagas ?? null,
      inscricoes_abertas: dados.inscricoesAbertas ?? true,
      aprovacao_automatica: dados.aprovacaoAutomatica ?? true,
      status: dados.status ?? 'aberta',
      modo: dados.modo ?? 'presencial',
      // Sequencial só existe dentro de gravado: guardar `true` numa turma
      // presencial deixaria uma trava adormecida esperando a próxima troca de
      // modo.
      sequencial: dados.modo === 'gravado' ? (dados.sequencial ?? false) : false,
      whatsapp_url: limpar(dados.whatsappUrl),
      tipo_inscricao: dados.tipoInscricao ?? 'app',
      link_inscricao_url: limpar(dados.linkInscricaoUrl),
      formulario_id: dados.formularioId || null,
      // Videochamada só existe em turma com encontro: numa gravada o modo cai
      // para 'nenhum', pela mesma razão de `sequencial` — guardar a escolha
      // deixaria um botão adormecido esperando a próxima troca de modo.
      video_chamada_modo: videoModo(dados),
      video_chamada_url: videoModo(dados) === 'turma' ? limpar(dados.videoChamadaUrl) : null,
      criado_por: acesso.userId,
    })
    .select('id')
    .single()

  if (error || !data) return { ok: false, erro: error?.message ?? 'Não foi possível criar a turma.' }

  // Sem professor a turma ficaria sem ninguém capaz de fazer a chamada: quem
  // cria assume a turma quando não indica outra pessoa.
  const professores = dados.professores?.length ? dados.professores : [acesso.userId]
  const admin = createAdminClient()
  await admin.from('ensino_turma_professores').insert(
    professores.map((profileId, i) => ({
      turma_id: data.id,
      profile_id: profileId,
      principal: i === 0,
    }))
  )

  revalidatePath('/ensino')
  revalidatePath('/ensino/professor')
  return { ok: true, id: data.id }
}

export async function editarTurmaAction(
  id: string,
  dados: DadosTurma
): Promise<ResultadoAcao> {
  const acesso = await acessoEnsino()
  if (!(await podeLecionar(acesso, id))) {
    return { ok: false, erro: 'Você não administra esta turma.' }
  }
  if (!dados.nome.trim()) return { ok: false, erro: 'A turma precisa de um nome.' }

  const faltando = inscricaoIncompleta(dados)
  if (faltando) return { ok: false, erro: faltando }

  const supabase = await createClient()
  const { error } = await supabase
    .from('ensino_turmas')
    .update({
      curso_id: dados.cursoId,
      nome: dados.nome.trim(),
      descricao: limpar(dados.descricao),
      capa_url: limpar(dados.capaUrl),
      local: limpar(dados.local),
      data_inicio: limpar(dados.dataInicio),
      data_fim: limpar(dados.dataFim),
      dias_semana: dados.diasSemana ?? [],
      horario_inicio: limpar(dados.horarioInicio),
      horario_fim: limpar(dados.horarioFim),
      total_aulas: dados.totalAulas ?? null,
      vagas: dados.vagas ?? null,
      inscricoes_abertas: dados.inscricoesAbertas ?? true,
      aprovacao_automatica: dados.aprovacaoAutomatica ?? true,
      status: dados.status ?? 'aberta',
      modo: dados.modo ?? 'presencial',
      sequencial: dados.modo === 'gravado' ? (dados.sequencial ?? false) : false,
      whatsapp_url: limpar(dados.whatsappUrl),
      tipo_inscricao: dados.tipoInscricao ?? 'app',
      link_inscricao_url: limpar(dados.linkInscricaoUrl),
      formulario_id: dados.formularioId || null,
      // Videochamada só existe em turma com encontro: numa gravada o modo cai
      // para 'nenhum', pela mesma razão de `sequencial` — guardar a escolha
      // deixaria um botão adormecido esperando a próxima troca de modo.
      video_chamada_modo: videoModo(dados),
      video_chamada_url: videoModo(dados) === 'turma' ? limpar(dados.videoChamadaUrl) : null,
      atualizado_em: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return { ok: false, erro: error.message }

  // Só coordenador troca a equipe da turma — a RLS de
  // `ensino_turma_professores` recusaria um professor tentando se remover ou
  // adicionar colegas.
  if (dados.professores && acesso?.coordenador) {
    const admin = createAdminClient()
    await admin.from('ensino_turma_professores').delete().eq('turma_id', id)
    if (dados.professores.length > 0) {
      await admin.from('ensino_turma_professores').insert(
        dados.professores.map((profileId, i) => ({
          turma_id: id,
          profile_id: profileId,
          principal: i === 0,
        }))
      )
    }
  }

  revalidatePath('/ensino')
  revalidatePath(`/ensino/turma/${id}`)
  revalidatePath('/ensino/professor')
  return { ok: true }
}

/**
 * Liga ou desliga a turma no carrossel da home.
 *
 * Mesma mecânica do destaque de eventos — os dois alimentam a mesma faixa.
 */
export async function alternarDestaqueTurmaAction(
  id: string,
  destaque: boolean
): Promise<ResultadoAcao> {
  const acesso = await acessoEnsino()
  if (!(await podeLecionar(acesso, id))) {
    return { ok: false, erro: 'Você não administra esta turma.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('ensino_turmas')
    .update({ destaque })
    .eq('id', id)

  if (error) return { ok: false, erro: error.message }

  revalidatePath('/home')
  revalidatePath(`/ensino/turma/${id}`)
  return { ok: true }
}

export async function excluirTurmaAction(id: string): Promise<ResultadoAcao> {
  const acesso = await acessoEnsino()
  if (!acesso?.coordenador) return { ok: false, erro: 'Só a coordenação pode excluir turmas.' }

  const supabase = await createClient()
  const { error } = await supabase.from('ensino_turmas').delete().eq('id', id)

  if (error) return { ok: false, erro: error.message }

  // A turma podia estar em destaque na home e na lista de quem cursava — as
  // duas telas mostrariam um cartão que não abre mais.
  revalidatePath('/ensino')
  revalidatePath('/ensino/professor')
  revalidatePath('/ensino/admin')
  revalidatePath('/ensino/aluno')
  revalidatePath('/home')
  revalidatePath('/', 'layout')
  return { ok: true }
}

/**
 * Quantos aprovados cada turma tem.
 *
 * Vai pelo cliente admin porque a RLS de `ensino_inscricoes` esconde do aluno
 * as linhas dos colegas — sem isso, a página da turma mostraria "0 inscritos"
 * para quem ainda não entrou. Só a contagem sai daqui; nome e telefone, não.
 */
export async function contarAprovados(turmaIds: string[]): Promise<Record<string, number>> {
  if (turmaIds.length === 0) return {}

  const admin = createAdminClient()
  const { data } = await admin
    .from('ensino_inscricoes')
    .select('turma_id')
    .in('turma_id', turmaIds)
    .in('status', ['aprovada', 'concluida'])

  const contagem: Record<string, number> = {}
  for (const id of turmaIds) contagem[id] = 0
  for (const linha of data ?? []) {
    contagem[linha.turma_id] = (contagem[linha.turma_id] ?? 0) + 1
  }
  return contagem
}

/** Quantas inscrições estão esperando decisão, por turma. */
export async function contarPendentes(turmaIds: string[]): Promise<Record<string, number>> {
  if (turmaIds.length === 0) return {}

  const admin = createAdminClient()
  const { data } = await admin
    .from('ensino_inscricoes')
    .select('turma_id')
    .in('turma_id', turmaIds)
    .eq('status', 'pendente')

  const contagem: Record<string, number> = {}
  for (const id of turmaIds) contagem[id] = 0
  for (const linha of data ?? []) {
    contagem[linha.turma_id] = (contagem[linha.turma_id] ?? 0) + 1
  }
  return contagem
}
