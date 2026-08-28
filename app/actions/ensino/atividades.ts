'use server'

/**
 * Atividades — criação, montagem da página, entrega e correção.
 *
 * Tudo pelo cliente admin depois de conferir a permissão em TypeScript, como
 * no resto do módulo. As policies de `ensino_atividades.sql` continuam sendo a
 * barreira de verdade para quem consultar o banco direto do navegador; aqui
 * elas seriam um estorvo, porque montar o cronograma de leitura de uma turma
 * inteira significa escrever nas linhas de trinta alunos de uma vez.
 */

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { acessoEnsino, podeLecionar, type AcessoEnsino } from '@/lib/ensino/permissoes'
import { BUCKET_CAPAS, type ResultadoAcao } from '@/lib/ensino/tipos'
import { corrigir, hojeIso, somarNota } from '@/lib/ensino/atividades'
import { montarCronograma, type LivroBiblia } from '@/lib/ensino/leitura'
import type {
  ConfigLeitura, OpcaoPergunta, TipoAtividade, TipoPergunta, TipoSecaoAtividade, TipoNotificacao,
} from '@/lib/supabase/types'

/** Teto por imagem. Acima disso o navegador já devia ter comprimido. */
const TAMANHO_MAXIMO = 8 * 1024 * 1024

/** O bastante da atividade para decidir permissão e o que revalidar. */
interface AtividadeBase {
  id: string
  turma_id: string
  tipo: TipoAtividade
  prazo: string | null
  publicada: boolean
  leitura: ConfigLeitura | null
}

/**
 * Quem leciona a turma da atividade.
 *
 * O discriminante é `ok`, e não a presença de `erro`: com `'erro' in ctx` o
 * TypeScript alarga o campo para `string | undefined` no ramo de falha, e a
 * chamada perde a garantia. Assim `return ctx` já é um `ResultadoAcao` válido.
 */
type ContextoAtividade =
  | { ok: false; erro: string }
  | {
      ok: true
      acesso: AcessoEnsino
      admin: ReturnType<typeof createAdminClient>
      atividade: AtividadeBase
    }

async function comAcesso(atividadeId: string): Promise<ContextoAtividade> {
  const acesso = await acessoEnsino()
  if (!acesso) return { ok: false, erro: 'Não autenticado.' }

  const admin = createAdminClient()
  const { data } = await admin
    .from('ensino_atividades')
    .select('id, turma_id, tipo, prazo, publicada, leitura')
    .eq('id', atividadeId)
    .maybeSingle()

  if (!data) return { ok: false, erro: 'Atividade não encontrada.' }
  if (!(await podeLecionar(acesso, data.turma_id))) {
    return { ok: false, erro: 'Você não administra esta turma.' }
  }
  return { ok: true, acesso, admin, atividade: data as AtividadeBase }
}

function revalidar(turmaId: string, atividadeId?: string) {
  revalidatePath(`/ensino/turma/${turmaId}/atividades`)
  revalidatePath('/ensino/atividades')
  if (atividadeId) revalidatePath(`/ensino/atividade/${atividadeId}`)
}

// ---------------------------------------------------------------------------
// A atividade
// ---------------------------------------------------------------------------

export async function criarAtividadeAction(
  turmaId: string,
  dados: { tipo: TipoAtividade; titulo: string }
): Promise<ResultadoAcao & { id?: string }> {
  const acesso = await acessoEnsino()
  if (!acesso) return { ok: false, erro: 'Não autenticado.' }
  if (!(await podeLecionar(acesso, turmaId))) {
    return { ok: false, erro: 'Você não administra esta turma.' }
  }

  const titulo = dados.titulo.trim()
  if (!titulo) return { ok: false, erro: 'Dê um título à atividade.' }

  const admin = createAdminClient()

  // Entra no fim da lista. `ordem` é do professor, e a lista do aluno ordena
  // por prazo — as duas visões querem coisas diferentes.
  const { data: ultima } = await admin
    .from('ensino_atividades')
    .select('ordem')
    .eq('turma_id', turmaId)
    .order('ordem', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data, error } = await admin
    .from('ensino_atividades')
    .insert({
      turma_id: turmaId,
      tipo: dados.tipo,
      titulo,
      ordem: (ultima?.ordem ?? -1) + 1,
      criado_por: acesso.userId,
      // O quiz nasce com um bloco de perguntas: sem ele a tela de montagem
      // abre vazia e não se sabe por onde começar.
      ...(dados.tipo === 'leitura'
        ? { leitura: { modo: 'percurso', trechos: [], repeticoes: 1 } satisfies ConfigLeitura }
        : {}),
    })
    .select('id')
    .single()

  if (error) return { ok: false, erro: error.message }

  if (dados.tipo === 'quiz') {
    await admin.from('ensino_atividade_secoes').insert({
      atividade_id: data.id,
      tipo: 'perguntas',
      ordem: 0,
    })
  }

  revalidar(turmaId)
  return { ok: true, id: data.id }
}

export async function salvarAtividadeAction(
  atividadeId: string,
  dados: {
    titulo?: string
    descricao?: string | null
    prazo?: string | null
    abreEm?: string | null
    videoUrl?: string | null
    cor?: string | null
    fundoOpacidade?: number
    leitura?: ConfigLeitura | null
  }
): Promise<ResultadoAcao> {
  const ctx = await comAcesso(atividadeId)
  if (!ctx.ok) return ctx

  if (dados.titulo !== undefined && !dados.titulo.trim()) {
    return { ok: false, erro: 'Dê um título à atividade.' }
  }

  const { error } = await ctx.admin
    .from('ensino_atividades')
    .update({
      ...(dados.titulo !== undefined ? { titulo: dados.titulo.trim() } : {}),
      ...(dados.descricao !== undefined ? { descricao: dados.descricao || null } : {}),
      ...(dados.prazo !== undefined ? { prazo: dados.prazo || null } : {}),
      ...(dados.abreEm !== undefined ? { abre_em: dados.abreEm || null } : {}),
      ...(dados.videoUrl !== undefined ? { video_url: dados.videoUrl || null } : {}),
      ...(dados.cor !== undefined ? { cor: dados.cor || null } : {}),
      ...(dados.fundoOpacidade !== undefined ? { fundo_opacidade: dados.fundoOpacidade } : {}),
      ...(dados.leitura !== undefined ? { leitura: dados.leitura } : {}),
      atualizado_em: new Date().toISOString(),
    })
    .eq('id', atividadeId)

  if (error) return { ok: false, erro: error.message }

  // Mexer no prazo ou nos trechos muda o cronograma de quem já o recebeu.
  if (ctx.atividade.tipo === 'leitura' && (dados.prazo !== undefined || dados.leitura !== undefined)) {
    const r = await regerarCronogramas(atividadeId)
    if (!r.ok) return r
  }

  revalidar(ctx.atividade.turma_id, atividadeId)
  return { ok: true }
}

/**
 * Publicar é o que faz a atividade existir para a turma.
 *
 * No desafio de leitura é também quando o cronograma nasce: antes disso os
 * trechos ainda estão mudando, e gerar linhas para trinta alunos a cada
 * tecla seria desperdício.
 */
export async function publicarAtividadeAction(
  atividadeId: string,
  publicada: boolean
): Promise<ResultadoAcao> {
  const ctx = await comAcesso(atividadeId)
  if (!ctx.ok) return ctx

  if (publicada && ctx.atividade.tipo === 'quiz') {
    const { count } = await ctx.admin
      .from('ensino_atividade_perguntas')
      .select('id', { count: 'exact', head: true })
      .eq('atividade_id', atividadeId)
    if (!count) return { ok: false, erro: 'Adicione ao menos uma pergunta antes de publicar.' }
  }

  if (publicada && ctx.atividade.tipo === 'leitura') {
    const config = ctx.atividade.leitura as ConfigLeitura | null
    if (!config || config.trechos.length === 0) {
      return { ok: false, erro: 'Escolha ao menos um trecho da Bíblia antes de publicar.' }
    }
  }

  const { error } = await ctx.admin
    .from('ensino_atividades')
    .update({ publicada, atualizado_em: new Date().toISOString() })
    .eq('id', atividadeId)
  if (error) return { ok: false, erro: error.message }

  if (publicada && ctx.atividade.tipo === 'leitura') {
    const r = await regerarCronogramas(atividadeId)
    if (!r.ok) return r
  }

  revalidar(ctx.atividade.turma_id, atividadeId)
  return { ok: true }
}

export async function excluirAtividadeAction(atividadeId: string): Promise<ResultadoAcao> {
  const ctx = await comAcesso(atividadeId)
  if (!ctx.ok) return ctx

  // Seções, perguntas, entregas, respostas e cronograma saem por cascade.
  const { error } = await ctx.admin.from('ensino_atividades').delete().eq('id', atividadeId)
  if (error) return { ok: false, erro: error.message }

  revalidar(ctx.atividade.turma_id, atividadeId)
  return { ok: true }
}

export async function enviarImagemAtividadeAction(
  atividadeId: string,
  formData: FormData
): Promise<ResultadoAcao & { url?: string }> {
  const ctx = await comAcesso(atividadeId)
  if (!ctx.ok) return ctx

  const arquivo = formData.get('file')
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { ok: false, erro: 'Arquivo inválido.' }
  }
  if (arquivo.size > TAMANHO_MAXIMO) {
    return { ok: false, erro: 'A imagem passa de 8 MB. Tente uma menor.' }
  }

  // 'capa' | 'fundo' | 'secao' | 'pergunta' — o alvo decide onde a URL entra.
  const alvo = (formData.get('alvo') as string) ?? 'capa'
  const extensao = arquivo.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const caminho = `atividades/${atividadeId}/${alvo}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${extensao}`

  const { error: erroUpload } = await ctx.admin.storage
    .from(BUCKET_CAPAS)
    .upload(caminho, arquivo, { contentType: arquivo.type || 'image/jpeg', upsert: false })
  if (erroUpload) return { ok: false, erro: erroUpload.message }

  const { data } = ctx.admin.storage.from(BUCKET_CAPAS).getPublicUrl(caminho)

  // Chave literal, e não computada: uma chave dinâmica vira `{[x: string]}` e
  // o tipo gerado da tabela rejeita colunas que ele não consegue conferir.
  if (alvo === 'capa') {
    await ctx.admin
      .from('ensino_atividades')
      .update({ capa_url: data.publicUrl })
      .eq('id', atividadeId)
  } else if (alvo === 'fundo') {
    await ctx.admin
      .from('ensino_atividades')
      .update({ fundo_url: data.publicUrl })
      .eq('id', atividadeId)
  }

  revalidar(ctx.atividade.turma_id, atividadeId)
  return { ok: true, url: data.publicUrl }
}

export async function removerImagemAtividadeAction(
  atividadeId: string,
  alvo: 'capa' | 'fundo'
): Promise<ResultadoAcao> {
  const ctx = await comAcesso(atividadeId)
  if (!ctx.ok) return ctx

  // O objeto fica no bucket: apagar a coluna já tira a imagem da tela, e
  // remover o arquivo tornaria um desfazer impossível.
  const { error } = await ctx.admin
    .from('ensino_atividades')
    .update(alvo === 'capa' ? { capa_url: null } : { fundo_url: null })
    .eq('id', atividadeId)
  if (error) return { ok: false, erro: error.message }

  revalidar(ctx.atividade.turma_id, atividadeId)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Seções
// ---------------------------------------------------------------------------

export async function adicionarSecaoAction(
  atividadeId: string,
  tipo: TipoSecaoAtividade
): Promise<ResultadoAcao & { id?: string }> {
  const ctx = await comAcesso(atividadeId)
  if (!ctx.ok) return ctx

  const { data: ultima } = await ctx.admin
    .from('ensino_atividade_secoes')
    .select('ordem')
    .eq('atividade_id', atividadeId)
    .order('ordem', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data, error } = await ctx.admin
    .from('ensino_atividade_secoes')
    .insert({ atividade_id: atividadeId, tipo, ordem: (ultima?.ordem ?? -1) + 1 })
    .select('id')
    .single()

  if (error) return { ok: false, erro: error.message }
  revalidar(ctx.atividade.turma_id, atividadeId)
  return { ok: true, id: data.id }
}

export async function salvarSecaoAction(
  secaoId: string,
  dados: { titulo?: string | null; conteudo?: string | null; midiaUrl?: string | null; videoUrl?: string | null }
): Promise<ResultadoAcao> {
  const acesso = await acessoEnsino()
  if (!acesso) return { ok: false, erro: 'Não autenticado.' }

  const admin = createAdminClient()
  const { data: secao } = await admin
    .from('ensino_atividade_secoes')
    .select('id, atividade_id, ensino_atividades(turma_id)')
    .eq('id', secaoId)
    .maybeSingle()

  const turmaId = (secao as unknown as { ensino_atividades: { turma_id: string } | null } | null)
    ?.ensino_atividades?.turma_id
  if (!secao || !turmaId) return { ok: false, erro: 'Seção não encontrada.' }
  if (!(await podeLecionar(acesso, turmaId))) {
    return { ok: false, erro: 'Você não administra esta turma.' }
  }

  const { error } = await admin
    .from('ensino_atividade_secoes')
    .update({
      ...(dados.titulo !== undefined ? { titulo: dados.titulo || null } : {}),
      ...(dados.conteudo !== undefined ? { conteudo: dados.conteudo || null } : {}),
      ...(dados.midiaUrl !== undefined ? { midia_url: dados.midiaUrl || null } : {}),
      ...(dados.videoUrl !== undefined ? { video_url: dados.videoUrl || null } : {}),
    })
    .eq('id', secaoId)

  if (error) return { ok: false, erro: error.message }
  revalidar(turmaId, secao.atividade_id)
  return { ok: true }
}

/**
 * Reordena as seções.
 *
 * Recebe a lista inteira na ordem nova, e não "sobe uma": arrastar produz uma
 * ordem completa de uma vez, e reescrever tudo dispensa acertar índices no
 * meio do caminho.
 */
export async function reordenarSecoesAction(
  atividadeId: string,
  idsNaOrdem: string[]
): Promise<ResultadoAcao> {
  const ctx = await comAcesso(atividadeId)
  if (!ctx.ok) return ctx

  for (const [ordem, id] of idsNaOrdem.entries()) {
    const { error } = await ctx.admin
      .from('ensino_atividade_secoes')
      .update({ ordem })
      .eq('id', id)
      .eq('atividade_id', atividadeId)
    if (error) return { ok: false, erro: error.message }
  }

  revalidar(ctx.atividade.turma_id, atividadeId)
  return { ok: true }
}

export async function excluirSecaoAction(secaoId: string): Promise<ResultadoAcao> {
  const acesso = await acessoEnsino()
  if (!acesso) return { ok: false, erro: 'Não autenticado.' }

  const admin = createAdminClient()
  const { data: secao } = await admin
    .from('ensino_atividade_secoes')
    .select('id, atividade_id, ensino_atividades(turma_id)')
    .eq('id', secaoId)
    .maybeSingle()

  const turmaId = (secao as unknown as { ensino_atividades: { turma_id: string } | null } | null)
    ?.ensino_atividades?.turma_id
  if (!secao || !turmaId) return { ok: false, erro: 'Seção não encontrada.' }
  if (!(await podeLecionar(acesso, turmaId))) {
    return { ok: false, erro: 'Você não administra esta turma.' }
  }

  const { error } = await admin.from('ensino_atividade_secoes').delete().eq('id', secaoId)
  if (error) return { ok: false, erro: error.message }

  revalidar(turmaId, secao.atividade_id)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Perguntas
// ---------------------------------------------------------------------------

export async function salvarPerguntaAction(
  atividadeId: string,
  pergunta: {
    id?: string
    secaoId?: string | null
    enunciado: string
    tipo: TipoPergunta
    opcoes: OpcaoPergunta[]
    respostaEsperada?: string | null
    pontos: number
    obrigatoria: boolean
    midiaUrl?: string | null
    midiaTipo?: 'imagem' | 'video' | null
  }
): Promise<ResultadoAcao & { id?: string }> {
  const ctx = await comAcesso(atividadeId)
  if (!ctx.ok) return ctx

  if (!pergunta.enunciado.trim()) return { ok: false, erro: 'Escreva o enunciado.' }

  const automatica = pergunta.tipo === 'unica' || pergunta.tipo === 'multipla'
  if (automatica) {
    const validas = pergunta.opcoes.filter((o) => o.texto.trim())
    if (validas.length < 2) return { ok: false, erro: 'A pergunta precisa de ao menos duas alternativas.' }
    // Sem gabarito a correção automática não teria o que comparar, e a prova
    // sairia com todo mundo zerado sem que o professor entendesse por quê.
    if (!validas.some((o) => o.correta)) {
      return { ok: false, erro: 'Marque qual alternativa é a correta.' }
    }
    if (pergunta.tipo === 'unica' && validas.filter((o) => o.correta).length > 1) {
      return { ok: false, erro: 'Escolha única aceita só uma alternativa correta.' }
    }
  }

  const corpo = {
    atividade_id: atividadeId,
    secao_id: pergunta.secaoId ?? null,
    enunciado: pergunta.enunciado.trim(),
    tipo: pergunta.tipo,
    opcoes: automatica ? pergunta.opcoes.filter((o) => o.texto.trim()) : [],
    resposta_esperada: pergunta.respostaEsperada?.trim() || null,
    pontos: pergunta.pontos,
    obrigatoria: pergunta.obrigatoria,
    midia_url: pergunta.midiaUrl || null,
    midia_tipo: pergunta.midiaTipo ?? null,
  }

  if (pergunta.id) {
    const { error } = await ctx.admin
      .from('ensino_atividade_perguntas')
      .update(corpo)
      .eq('id', pergunta.id)
      .eq('atividade_id', atividadeId)
    if (error) return { ok: false, erro: error.message }
    revalidar(ctx.atividade.turma_id, atividadeId)
    return { ok: true, id: pergunta.id }
  }

  const { data: ultima } = await ctx.admin
    .from('ensino_atividade_perguntas')
    .select('ordem')
    .eq('atividade_id', atividadeId)
    .order('ordem', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data, error } = await ctx.admin
    .from('ensino_atividade_perguntas')
    .insert({ ...corpo, ordem: (ultima?.ordem ?? -1) + 1 })
    .select('id')
    .single()

  if (error) return { ok: false, erro: error.message }
  revalidar(ctx.atividade.turma_id, atividadeId)
  return { ok: true, id: data.id }
}

export async function reordenarPerguntasAction(
  atividadeId: string,
  idsNaOrdem: string[]
): Promise<ResultadoAcao> {
  const ctx = await comAcesso(atividadeId)
  if (!ctx.ok) return ctx

  for (const [ordem, id] of idsNaOrdem.entries()) {
    const { error } = await ctx.admin
      .from('ensino_atividade_perguntas')
      .update({ ordem })
      .eq('id', id)
      .eq('atividade_id', atividadeId)
    if (error) return { ok: false, erro: error.message }
  }

  revalidar(ctx.atividade.turma_id, atividadeId)
  return { ok: true }
}

export async function excluirPerguntaAction(
  atividadeId: string,
  perguntaId: string
): Promise<ResultadoAcao> {
  const ctx = await comAcesso(atividadeId)
  if (!ctx.ok) return ctx

  const { error } = await ctx.admin
    .from('ensino_atividade_perguntas')
    .delete()
    .eq('id', perguntaId)
    .eq('atividade_id', atividadeId)
  if (error) return { ok: false, erro: error.message }

  revalidar(ctx.atividade.turma_id, atividadeId)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Cronograma de leitura
// ---------------------------------------------------------------------------

/**
 * (Re)gera o cronograma de todos os inscritos.
 *
 * O que já foi marcado se perde quando os trechos mudam, e é o correto: um
 * desafio diferente é outro desafio. Mudanças só de prazo preservam o
 * progresso, porque a lista de trechos continua a mesma — daí a comparação
 * por rótulo antes de apagar.
 */
async function regerarCronogramas(atividadeId: string): Promise<ResultadoAcao> {
  const admin = createAdminClient()

  const { data: atividade } = await admin
    .from('ensino_atividades')
    .select('id, turma_id, leitura, prazo, abre_em')
    .eq('id', atividadeId)
    .maybeSingle()
  if (!atividade) return { ok: false, erro: 'Atividade não encontrada.' }

  const config = atividade.leitura as ConfigLeitura | null
  if (!config || config.trechos.length === 0) return { ok: true }

  const [livrosRes, inscricoesRes, feitosRes] = await Promise.all([
    admin.from('biblia_livros').select('id, sigla, nome, testamento, capitulos').order('id'),
    admin
      .from('ensino_inscricoes')
      .select('id')
      .eq('turma_id', atividade.turma_id)
      .in('status', ['aprovada', 'concluida']),
    admin
      .from('ensino_leitura_itens')
      .select('inscricao_id, rotulo, rodada, feito, feito_em')
      .eq('atividade_id', atividadeId)
      .eq('feito', true),
  ])

  const livros = (livrosRes.data ?? []) as LivroBiblia[]
  const inscricoes = (inscricoesRes.data ?? []) as { id: string }[]
  if (inscricoes.length === 0) return { ok: true }

  // "quem|rótulo|volta" → quando marcou. É o que sobrevive a um ajuste de prazo.
  const jaFeito = new Map<string, string | null>()
  for (const f of (feitosRes.data ?? []) as {
    inscricao_id: string; rotulo: string; rodada: number; feito_em: string | null
  }[]) {
    jaFeito.set(`${f.inscricao_id}|${f.rotulo}|${f.rodada}`, f.feito_em)
  }

  const inicio = atividade.abre_em ?? hojeIso()
  const { itens } = montarCronograma(livros, config, inicio, atividade.prazo)
  if (itens.length === 0) return { ok: true }

  const { error: erroLimpeza } = await admin
    .from('ensino_leitura_itens')
    .delete()
    .eq('atividade_id', atividadeId)
  if (erroLimpeza) return { ok: false, erro: erroLimpeza.message }

  const linhas = inscricoes.flatMap((i) =>
    itens.map((item) => {
      const chave = `${i.id}|${item.rotulo}|${item.rodada}`
      const feitoEm = jaFeito.get(chave)
      return {
        atividade_id: atividadeId,
        inscricao_id: i.id,
        ordem: item.ordem,
        rotulo: item.rotulo,
        livro_id: item.livroId,
        capitulo_inicio: item.capituloInicio,
        capitulo_fim: item.capituloFim,
        rodada: item.rodada,
        data_prevista: item.dataPrevista,
        feito: jaFeito.has(chave),
        feito_em: feitoEm ?? null,
      }
    })
  )

  // Em lotes: uma turma de 30 com 90 dias de leitura passa de 2.700 linhas, e
  // um insert único desse tamanho estoura o limite do PostgREST.
  for (let i = 0; i < linhas.length; i += 500) {
    const { error } = await admin.from('ensino_leitura_itens').insert(linhas.slice(i, i + 500))
    if (error) return { ok: false, erro: error.message }
  }

  return { ok: true }
}

/** Garante o cronograma de quem entrou na turma depois da publicação. */
export async function garantirCronogramaAction(
  atividadeId: string,
  inscricaoId: string
): Promise<ResultadoAcao> {
  // A inscrição precisa ser a de quem chamou — ou quem chamou leciona a turma.
  // Sem isto, um `inscricaoId` qualquer criava cronograma de leitura no nome
  // de outro aluno.
  const eu = await minhaInscricao(atividadeId)
  if (eu?.inscricaoId !== inscricaoId) {
    const ctx = await comAcesso(atividadeId)
    if (!ctx.ok) return ctx
  }

  const admin = createAdminClient()

  const { count } = await admin
    .from('ensino_leitura_itens')
    .select('id', { count: 'exact', head: true })
    .eq('atividade_id', atividadeId)
    .eq('inscricao_id', inscricaoId)
  if (count && count > 0) return { ok: true }

  const { data: atividade } = await admin
    .from('ensino_atividades')
    .select('id, leitura, prazo, abre_em')
    .eq('id', atividadeId)
    .maybeSingle()
  if (!atividade) return { ok: false, erro: 'Atividade não encontrada.' }

  const config = atividade.leitura as ConfigLeitura | null
  if (!config || config.trechos.length === 0) return { ok: true }

  const { data: livrosData } = await admin
    .from('biblia_livros')
    .select('id, sigla, nome, testamento, capitulos')
    .order('id')

  // Começa hoje, e não na abertura: quem entra faltando dez dias tem dez dias,
  // e um cronograma que já nasce metade vencido não ajuda ninguém.
  const { itens } = montarCronograma(
    (livrosData ?? []) as LivroBiblia[],
    config,
    hojeIso(),
    atividade.prazo
  )
  if (itens.length === 0) return { ok: true }

  const { error } = await admin.from('ensino_leitura_itens').insert(
    itens.map((item) => ({
      atividade_id: atividadeId,
      inscricao_id: inscricaoId,
      ordem: item.ordem,
      rotulo: item.rotulo,
      livro_id: item.livroId,
      capitulo_inicio: item.capituloInicio,
      capitulo_fim: item.capituloFim,
      rodada: item.rodada,
      data_prevista: item.dataPrevista,
    }))
  )
  if (error) return { ok: false, erro: error.message }
  return { ok: true }
}

// ---------------------------------------------------------------------------
// O lado do aluno
// ---------------------------------------------------------------------------

/** A inscrição de quem está logado nesta atividade. Nulo se não for da turma. */
async function minhaInscricao(atividadeId: string) {
  const acesso = await acessoEnsino()
  if (!acesso) return null

  const admin = createAdminClient()
  const { data: atividade } = await admin
    .from('ensino_atividades')
    .select('id, turma_id, tipo, titulo, publicada, abre_em, prazo')
    .eq('id', atividadeId)
    .maybeSingle()
  if (!atividade) return null

  const { data: inscricao } = await admin
    .from('ensino_inscricoes')
    .select('id')
    .eq('turma_id', atividade.turma_id)
    .eq('user_id', acesso.userId)
    .in('status', ['aprovada', 'concluida'])
    .maybeSingle()
  if (!inscricao) return null

  return { acesso, admin, atividade, inscricaoId: inscricao.id }
}

/** Cria a entrega na primeira interação. Uma por (atividade, inscrição). */
async function entregaDe(
  admin: ReturnType<typeof createAdminClient>,
  atividadeId: string,
  inscricaoId: string
): Promise<{ id: string; status: string; comentario: string | null } | null> {
  const { data } = await admin
    .from('ensino_atividade_entregas')
    .select('id, status, comentario')
    .eq('atividade_id', atividadeId)
    .eq('inscricao_id', inscricaoId)
    .maybeSingle()
  if (data) return data

  const { data: nova } = await admin
    .from('ensino_atividade_entregas')
    .insert({ atividade_id: atividadeId, inscricao_id: inscricaoId })
    .select('id, status, comentario')
    .single()
  return nova ?? null
}

async function notificarProfessoresComentario(
  ctx: { admin: ReturnType<typeof createAdminClient>; atividade: { turma_id: string; id: string }; acesso: { userId: string } },
  inscricaoId: string,
  comentario: string
) {
  const [{ data: professores }, { data: aluno }, { data: turma }] = await Promise.all([
    ctx.admin.from('ensino_turma_professores').select('profiles(id)').eq('turma_id', ctx.atividade.turma_id),
    ctx.admin.from('profiles').select('nome').eq('id', ctx.acesso.userId).maybeSingle(),
    ctx.admin.from('ensino_turmas').select('igreja_id').eq('id', ctx.atividade.turma_id).maybeSingle(),
  ])
  const destinatarios = (professores ?? [])
    .map((p: any) => p.profiles?.id)
    .filter((id: string | undefined): id is string => Boolean(id) && id !== ctx.acesso.userId)
  if (destinatarios.length === 0 || !turma?.igreja_id) return
  await ctx.admin.from('notificacoes').insert(destinatarios.map((destinatario_id) => ({
    igreja_id: turma?.igreja_id,
    destinatario_id,
    tipo: 'ensino_comentario_atividade' as TipoNotificacao,
    titulo: 'Nova pergunta em uma atividade',
    mensagem: `${aluno?.nome ?? 'Um aluno'} deixou uma pergunta ou comentário em “${(ctx.atividade as any).titulo ?? 'uma atividade'}”.`,
    dados: { href: `/ensino/atividade/${ctx.atividade.id}/painel`, atividade_id: ctx.atividade.id, inscricao_id: inscricaoId },
  })))
}

/** O "marcar feito" da tarefa, com o comentário opcional do aluno. */
export async function concluirTarefaAction(
  atividadeId: string,
  dados: { concluida: boolean; comentario?: string | null }
): Promise<ResultadoAcao> {
  const ctx = await minhaInscricao(atividadeId)
  if (!ctx) return { ok: false, erro: 'Você não está nesta turma.' }
  if (!ctx.atividade.publicada) return { ok: false, erro: 'Esta atividade ainda não foi publicada.' }

  const entrega = await entregaDe(ctx.admin, atividadeId, ctx.inscricaoId)
  if (!entrega) return { ok: false, erro: 'Não foi possível registrar.' }

  const { error } = await ctx.admin
    .from('ensino_atividade_entregas')
    .update({
      concluida: dados.concluida,
      ...(dados.comentario !== undefined ? { comentario: dados.comentario || null } : {}),
      status: dados.concluida ? 'entregue' : 'pendente',
      entregue_em: dados.concluida ? new Date().toISOString() : null,
      atualizado_em: new Date().toISOString(),
    })
    .eq('id', entrega.id)

  if (error) return { ok: false, erro: error.message }
  const comentarioNovo = dados.comentario?.trim() ?? ''
  if (dados.comentario !== undefined && comentarioNovo !== (entrega.comentario ?? '').trim() && comentarioNovo) {
    await notificarProfessoresComentario(ctx, ctx.inscricaoId, comentarioNovo)
  }
  revalidatePath(`/ensino/atividade/${atividadeId}`)
  revalidatePath('/ensino/atividades')
  return { ok: true }
}

/** Um item do cronograma riscado (ou desriscado). */
export async function marcarLeituraAction(
  atividadeId: string,
  itemId: string,
  feito: boolean
): Promise<ResultadoAcao> {
  const ctx = await minhaInscricao(atividadeId)
  if (!ctx) return { ok: false, erro: 'Você não está nesta turma.' }

  const { error } = await ctx.admin
    .from('ensino_leitura_itens')
    .update({ feito, feito_em: feito ? new Date().toISOString() : null })
    .eq('id', itemId)
    // O filtro pela inscrição é o que impede riscar o item de um colega.
    .eq('inscricao_id', ctx.inscricaoId)
    .eq('atividade_id', atividadeId)

  if (error) return { ok: false, erro: error.message }

  // A entrega acompanha o checklist: cumprido tudo, o desafio está entregue.
  const entrega = await entregaDe(ctx.admin, atividadeId, ctx.inscricaoId)
  if (entrega) {
    const { data: itens } = await ctx.admin
      .from('ensino_leitura_itens')
      .select('feito')
      .eq('atividade_id', atividadeId)
      .eq('inscricao_id', ctx.inscricaoId)

    const lista = (itens ?? []) as { feito: boolean }[]
    const completo = lista.length > 0 && lista.every((i) => i.feito)
    await ctx.admin
      .from('ensino_atividade_entregas')
      .update({
        concluida: completo,
        status: completo ? 'entregue' : 'pendente',
        entregue_em: completo ? new Date().toISOString() : null,
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', entrega.id)
  }

  revalidatePath(`/ensino/atividade/${atividadeId}`)
  return { ok: true }
}

/**
 * Entrega do quiz.
 *
 * A correção do que é de marcar acontece aqui, no servidor, comparando com o
 * gabarito que nunca saiu do banco. Se a prova só tinha perguntas automáticas,
 * ela já volta corrigida e com nota — não há o que o professor acrescentar.
 */
export async function responderQuizAction(
  atividadeId: string,
  respostas: { perguntaId: string; opcoes: string[]; texto: string | null }[],
  comentario?: string | null
): Promise<ResultadoAcao> {
  const ctx = await minhaInscricao(atividadeId)
  if (!ctx) return { ok: false, erro: 'Você não está nesta turma.' }
  if (!ctx.atividade.publicada) return { ok: false, erro: 'Esta atividade ainda não foi publicada.' }

  const entrega = await entregaDe(ctx.admin, atividadeId, ctx.inscricaoId)
  if (!entrega) return { ok: false, erro: 'Não foi possível registrar a entrega.' }
  if (entrega.status !== 'pendente') return { ok: false, erro: 'Esta prova já foi entregue.' }

  const { data: perguntasData } = await ctx.admin
    .from('ensino_atividade_perguntas')
    .select('id, tipo, opcoes, pontos, obrigatoria')
    .eq('atividade_id', atividadeId)

  const perguntas = (perguntasData ?? []) as {
    id: string; tipo: TipoPergunta; opcoes: OpcaoPergunta[]; pontos: number; obrigatoria: boolean
  }[]
  const porId = new Map(perguntas.map((p) => [p.id, p]))

  const enviadas = new Map(respostas.map((r) => [r.perguntaId, r]))
  const faltando = perguntas.filter((p) => {
    if (!p.obrigatoria) return false
    const r = enviadas.get(p.id)
    if (!r) return true
    return r.opcoes.length === 0 && !r.texto?.trim()
  })
  if (faltando.length > 0) {
    return {
      ok: false,
      erro: `Responda todas as perguntas obrigatórias — faltam ${faltando.length}.`,
    }
  }

  const linhas = respostas
    .filter((r) => porId.has(r.perguntaId))
    .map((r) => {
      const pergunta = porId.get(r.perguntaId)!
      const correta = corrigir(pergunta.tipo, pergunta.opcoes ?? [], r.opcoes)
      return {
        entrega_id: entrega.id,
        pergunta_id: r.perguntaId,
        opcoes: r.opcoes,
        texto: r.texto?.trim() || null,
        correta,
        // Nulo mantém a pergunta na fila do professor; a automática já pontua.
        pontos: correta === null ? null : correta ? Number(pergunta.pontos) : 0,
      }
    })

  const { error } = await ctx.admin
    .from('ensino_atividade_respostas')
    .upsert(linhas, { onConflict: 'entrega_id,pergunta_id' })
  if (error) return { ok: false, erro: error.message }

  const { nota, pendentes } = somarNota(linhas)

  const { error: erroEntrega } = await ctx.admin
    .from('ensino_atividade_entregas')
    .update({
      status: pendentes === 0 ? 'corrigida' : 'entregue',
      concluida: true,
      ...(comentario !== undefined ? { comentario: comentario || null } : {}),
      nota: pendentes === 0 ? nota : null,
      entregue_em: new Date().toISOString(),
      ...(pendentes === 0 ? { corrigida_em: new Date().toISOString() } : {}),
      atualizado_em: new Date().toISOString(),
    })
    .eq('id', entrega.id)

  if (erroEntrega) return { ok: false, erro: erroEntrega.message }
  if (comentario?.trim()) await notificarProfessoresComentario(ctx, ctx.inscricaoId, comentario.trim())

  revalidatePath(`/ensino/atividade/${atividadeId}`)
  revalidatePath('/ensino/atividades')
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Correção pelo professor
// ---------------------------------------------------------------------------

/** Corrige as dissertativas e fecha a nota. */
export async function corrigirEntregaAction(
  atividadeId: string,
  entregaId: string,
  dados: {
    respostas: { respostaId: string; correta: boolean; pontos: number }[]
    observacao?: string | null
  }
): Promise<ResultadoAcao> {
  const ctx = await comAcesso(atividadeId)
  if (!ctx.ok) return ctx

  for (const r of dados.respostas) {
    const { error } = await ctx.admin
      .from('ensino_atividade_respostas')
      .update({
        correta: r.correta,
        pontos: r.pontos,
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', r.respostaId)
      .eq('entrega_id', entregaId)
    if (error) return { ok: false, erro: error.message }
  }

  const { data: todas } = await ctx.admin
    .from('ensino_atividade_respostas')
    .select('correta, pontos')
    .eq('entrega_id', entregaId)

  const { nota, pendentes } = somarNota((todas ?? []) as { correta: boolean | null; pontos: number | null }[])

  const { error } = await ctx.admin
    .from('ensino_atividade_entregas')
    .update({
      status: pendentes === 0 ? 'corrigida' : 'entregue',
      nota: pendentes === 0 ? nota : null,
      ...(dados.observacao !== undefined ? { observacao: dados.observacao || null } : {}),
      corrigida_em: new Date().toISOString(),
      corrigida_por: ctx.acesso.userId,
      atualizado_em: new Date().toISOString(),
    })
    .eq('id', entregaId)
    .eq('atividade_id', atividadeId)

  if (error) return { ok: false, erro: error.message }

  revalidatePath(`/ensino/atividade/${atividadeId}/painel`)
  revalidatePath(`/ensino/atividade/${atividadeId}`)
  return { ok: true }
}

/** Devolutiva sem nota — serve à tarefa e ao desafio de leitura. */
export async function comentarEntregaAction(
  atividadeId: string,
  entregaId: string,
  observacao: string | null
): Promise<ResultadoAcao> {
  const ctx = await comAcesso(atividadeId)
  if (!ctx.ok) return ctx

  const { error } = await ctx.admin
    .from('ensino_atividade_entregas')
    .update({
      observacao: observacao || null,
      corrigida_por: ctx.acesso.userId,
      corrigida_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
    })
    .eq('id', entregaId)
    .eq('atividade_id', atividadeId)

  if (error) return { ok: false, erro: error.message }
  revalidatePath(`/ensino/atividade/${atividadeId}/painel`)
  return { ok: true }
}

