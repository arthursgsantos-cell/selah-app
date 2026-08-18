/**
 * As consultas das telas de atividade.
 *
 * Ficam fora das páginas porque as mesmas quatro perguntas se repetem em cinco
 * telas — a lista do aluno, a da turma, a página da atividade, o painel geral e
 * o individual —, e cada uma delas precisa cruzar entregas com inscrições de um
 * jeito que o PostgREST não faz num `select` só.
 *
 * Tudo com o cliente admin, e a permissão conferida pela página que chama, como
 * no resto do módulo.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { progressoLeitura } from '@/lib/ensino/leitura'
import { hojeIso, somarNota } from '@/lib/ensino/atividades'
import type {
  ConfigLeitura, OpcaoPergunta, StatusEntrega, TipoAtividade, TipoPergunta,
  TipoSecaoAtividade,
} from '@/lib/supabase/types'

export interface AtividadeResumo {
  id: string
  turmaId: string
  turmaNome: string
  cursoNome: string
  tipo: TipoAtividade
  titulo: string
  descricao: string | null
  capaUrl: string | null
  cor: string | null
  prazo: string | null
  abreEm: string | null
  publicada: boolean
  ordem: number
}

export interface AtividadeCompleta extends AtividadeResumo {
  fundoUrl: string | null
  fundoOpacidade: number
  videoUrl: string | null
  leitura: ConfigLeitura | null
  secoes: SecaoAtividade[]
}

export interface SecaoAtividade {
  id: string
  tipo: TipoSecaoAtividade
  titulo: string | null
  conteudo: string | null
  midiaUrl: string | null
  videoUrl: string | null
  ordem: number
}

/** A pergunta como o professor a vê: com gabarito. */
export interface PerguntaCompleta {
  id: string
  secaoId: string | null
  ordem: number
  enunciado: string
  tipo: TipoPergunta
  opcoes: OpcaoPergunta[]
  respostaEsperada: string | null
  pontos: number
  obrigatoria: boolean
  midiaUrl: string | null
  midiaTipo: 'imagem' | 'video' | null
}

export interface EntregaResumo {
  id: string
  inscricaoId: string
  nome: string
  telefone: string | null
  status: StatusEntrega
  concluida: boolean
  comentario: string | null
  nota: number | null
  observacao: string | null
  entregueEm: string | null
  /** Só no desafio de leitura. */
  leituraFeitos: number
  leituraTotal: number
  leituraAtrasados: number
  /** Respostas dissertativas ainda sem correção. Só no quiz. */
  aguardandoCorrecao: number
}

const CAMPOS_ATIVIDADE =
  'id, turma_id, tipo, titulo, descricao, capa_url, fundo_url, fundo_opacidade, cor, video_url, abre_em, prazo, publicada, ordem, leitura'

interface LinhaAtividade {
  id: string
  turma_id: string
  tipo: TipoAtividade
  titulo: string
  descricao: string | null
  capa_url: string | null
  fundo_url: string | null
  fundo_opacidade: number
  cor: string | null
  video_url: string | null
  abre_em: string | null
  prazo: string | null
  publicada: boolean
  ordem: number
  leitura: ConfigLeitura | null
  ensino_turmas?: { nome: string; ensino_cursos: { nome: string } | null } | null
}

function paraResumo(a: LinhaAtividade): AtividadeResumo {
  return {
    id: a.id,
    turmaId: a.turma_id,
    turmaNome: a.ensino_turmas?.nome ?? '',
    cursoNome: a.ensino_turmas?.ensino_cursos?.nome ?? '',
    tipo: a.tipo,
    titulo: a.titulo,
    descricao: a.descricao,
    capaUrl: a.capa_url,
    cor: a.cor,
    prazo: a.prazo,
    abreEm: a.abre_em,
    publicada: a.publicada,
    ordem: a.ordem,
  }
}

/** As atividades de uma turma, na ordem que o professor definiu. */
export async function atividadesDaTurma(turmaId: string): Promise<AtividadeResumo[]> {
  const { data } = await createAdminClient()
    .from('ensino_atividades')
    .select(`${CAMPOS_ATIVIDADE}, ensino_turmas(nome, ensino_cursos(nome))`)
    .eq('turma_id', turmaId)
    .order('ordem')
    .order('criado_em')

  return ((data ?? []) as unknown as LinhaAtividade[]).map(paraResumo)
}

/** A atividade com seções, para montar a página. */
export async function atividadeCompleta(id: string): Promise<AtividadeCompleta | null> {
  const admin = createAdminClient()

  const [atividadeRes, secoesRes] = await Promise.all([
    admin
      .from('ensino_atividades')
      .select(`${CAMPOS_ATIVIDADE}, ensino_turmas(nome, ensino_cursos(nome))`)
      .eq('id', id)
      .maybeSingle(),
    admin
      .from('ensino_atividade_secoes')
      .select('id, tipo, titulo, conteudo, midia_url, video_url, ordem')
      .eq('atividade_id', id)
      .order('ordem'),
  ])

  const linha = atividadeRes.data as unknown as LinhaAtividade | null
  if (!linha) return null

  const secoes = ((secoesRes.data ?? []) as unknown as {
    id: string; tipo: TipoSecaoAtividade; titulo: string | null; conteudo: string | null
    midia_url: string | null; video_url: string | null; ordem: number
  }[]).map((s) => ({
    id: s.id,
    tipo: s.tipo,
    titulo: s.titulo,
    conteudo: s.conteudo,
    midiaUrl: s.midia_url,
    videoUrl: s.video_url,
    ordem: s.ordem,
  }))

  return {
    ...paraResumo(linha),
    fundoUrl: linha.fundo_url,
    fundoOpacidade: linha.fundo_opacidade,
    videoUrl: linha.video_url,
    leitura: linha.leitura,
    secoes,
  }
}

export async function perguntasDaAtividade(atividadeId: string): Promise<PerguntaCompleta[]> {
  const { data } = await createAdminClient()
    .from('ensino_atividade_perguntas')
    .select(
      'id, secao_id, ordem, enunciado, tipo, opcoes, resposta_esperada, pontos, obrigatoria, midia_url, midia_tipo'
    )
    .eq('atividade_id', atividadeId)
    .order('ordem')

  return ((data ?? []) as unknown as {
    id: string; secao_id: string | null; ordem: number; enunciado: string; tipo: TipoPergunta
    opcoes: OpcaoPergunta[]; resposta_esperada: string | null; pontos: number
    obrigatoria: boolean; midia_url: string | null; midia_tipo: 'imagem' | 'video' | null
  }[]).map((p) => ({
    id: p.id,
    secaoId: p.secao_id,
    ordem: p.ordem,
    enunciado: p.enunciado,
    tipo: p.tipo,
    opcoes: p.opcoes ?? [],
    respostaEsperada: p.resposta_esperada,
    pontos: Number(p.pontos),
    obrigatoria: p.obrigatoria,
    midiaUrl: p.midia_url,
    midiaTipo: p.midia_tipo,
  }))
}

/**
 * A inscrição de uma pessoa numa turma.
 *
 * Devolve também o nome porque quem cadastrou o aluno à mão pode ter digitado
 * um nome diferente do perfil, e é o da inscrição que a turma reconhece.
 */
export async function inscricaoNaTurma(
  turmaId: string,
  userId: string
): Promise<{ id: string; nome: string } | null> {
  const { data } = await createAdminClient()
    .from('ensino_inscricoes')
    .select('id, nome')
    .eq('turma_id', turmaId)
    .eq('user_id', userId)
    .in('status', ['aprovada', 'concluida'])
    .maybeSingle()

  return (data as { id: string; nome: string } | null) ?? null
}

/**
 * O painel: uma linha por aluno aprovado, com o estado da entrega.
 *
 * Parte dos inscritos, e não das entregas: quem ainda não abriu a atividade não
 * tem linha em `ensino_atividade_entregas`, e é exatamente essa gente que o
 * professor precisa ver no painel.
 */
export async function painelDaAtividade(
  atividadeId: string,
  turmaId: string,
  tipo: TipoAtividade
): Promise<EntregaResumo[]> {
  const admin = createAdminClient()

  const [inscricoesRes, entregasRes] = await Promise.all([
    admin
      .from('ensino_inscricoes')
      .select('id, nome, telefone')
      .eq('turma_id', turmaId)
      .in('status', ['aprovada', 'concluida'])
      .order('nome'),
    admin
      .from('ensino_atividade_entregas')
      .select('id, inscricao_id, status, concluida, comentario, nota, observacao, entregue_em')
      .eq('atividade_id', atividadeId),
  ])

  const inscricoes = (inscricoesRes.data ?? []) as { id: string; nome: string; telefone: string | null }[]
  const entregas = new Map(
    ((entregasRes.data ?? []) as {
      id: string; inscricao_id: string; status: StatusEntrega; concluida: boolean
      comentario: string | null; nota: number | null; observacao: string | null
      entregue_em: string | null
    }[]).map((e) => [e.inscricao_id, e])
  )

  // O progresso da leitura e a fila de correção do quiz vêm em consultas
  // próprias, e só do tipo que as usa: buscar as duas sempre dobraria o custo
  // do painel de uma tarefa simples, que não precisa de nenhuma delas.
  const hoje = hojeIso()

  const porLeitura = new Map<string, { feitos: number; total: number; atrasados: number }>()
  if (tipo === 'leitura') {
    const { data } = await admin
      .from('ensino_leitura_itens')
      .select('inscricao_id, feito, data_prevista')
      .eq('atividade_id', atividadeId)

    const agrupado = new Map<string, { feito: boolean; dataPrevista: string | null }[]>()
    for (const i of (data ?? []) as {
      inscricao_id: string; feito: boolean; data_prevista: string | null
    }[]) {
      const lista = agrupado.get(i.inscricao_id) ?? []
      lista.push({ feito: i.feito, dataPrevista: i.data_prevista })
      agrupado.set(i.inscricao_id, lista)
    }
    for (const [inscricaoId, itens] of agrupado) {
      porLeitura.set(inscricaoId, progressoLeitura(itens, hoje))
    }
  }

  const porCorrigir = new Map<string, number>()
  if (tipo === 'quiz' && entregas.size > 0) {
    const { data } = await admin
      .from('ensino_atividade_respostas')
      .select('entrega_id, correta, pontos')
      .in('entrega_id', [...entregas.values()].map((e) => e.id))

    const agrupado = new Map<string, { correta: boolean | null; pontos: number | null }[]>()
    for (const r of (data ?? []) as {
      entrega_id: string; correta: boolean | null; pontos: number | null
    }[]) {
      const lista = agrupado.get(r.entrega_id) ?? []
      lista.push({ correta: r.correta, pontos: r.pontos })
      agrupado.set(r.entrega_id, lista)
    }
    for (const [entregaId, respostas] of agrupado) {
      porCorrigir.set(entregaId, somarNota(respostas).pendentes)
    }
  }

  return inscricoes.map((i) => {
    const entrega = entregas.get(i.id)
    const leitura = porLeitura.get(i.id)
    return {
      id: entrega?.id ?? '',
      inscricaoId: i.id,
      nome: i.nome,
      telefone: i.telefone,
      status: entrega?.status ?? 'pendente',
      concluida: entrega?.concluida ?? false,
      comentario: entrega?.comentario ?? null,
      nota: entrega?.nota === null || entrega?.nota === undefined ? null : Number(entrega.nota),
      observacao: entrega?.observacao ?? null,
      entregueEm: entrega?.entregue_em ?? null,
      leituraFeitos: leitura?.feitos ?? 0,
      leituraTotal: leitura?.total ?? 0,
      leituraAtrasados: leitura?.atrasados ?? 0,
      aguardandoCorrecao: entrega ? porCorrigir.get(entrega.id) ?? 0 : 0,
    }
  })
}

/**
 * As atividades que aparecem para um aluno.
 *
 * Junta todas as turmas em que ele está, porque a página `/ensino/atividades`
 * responde "o que eu tenho para fazer", e não "o que esta turma pediu". Só as
 * publicadas e já abertas.
 */
export async function minhasAtividades(userId: string): Promise<
  (AtividadeResumo & {
    inscricaoId: string
    concluida: boolean
    status: StatusEntrega
    nota: number | null
    leituraFeitos: number
    leituraTotal: number
    leituraAtrasados: number
  })[]
> {
  const admin = createAdminClient()

  const { data: inscricoesData } = await admin
    .from('ensino_inscricoes')
    .select('id, turma_id')
    .eq('user_id', userId)
    .in('status', ['aprovada', 'concluida'])

  const inscricoes = (inscricoesData ?? []) as { id: string; turma_id: string }[]
  if (inscricoes.length === 0) return []

  const hoje = hojeIso()
  const { data: atividadesData } = await admin
    .from('ensino_atividades')
    .select(`${CAMPOS_ATIVIDADE}, ensino_turmas(nome, ensino_cursos(nome))`)
    .in('turma_id', inscricoes.map((i) => i.turma_id))
    .eq('publicada', true)
    .or(`abre_em.is.null,abre_em.lte.${hoje}`)

  const atividades = (atividadesData ?? []) as unknown as LinhaAtividade[]
  if (atividades.length === 0) return []

  const porTurma = new Map(inscricoes.map((i) => [i.turma_id, i.id]))
  const meusIds = inscricoes.map((i) => i.id)

  const [entregasRes, leituraRes] = await Promise.all([
    admin
      .from('ensino_atividade_entregas')
      .select('atividade_id, inscricao_id, status, concluida, nota')
      .in('atividade_id', atividades.map((a) => a.id))
      .in('inscricao_id', meusIds),
    admin
      .from('ensino_leitura_itens')
      .select('atividade_id, feito, data_prevista')
      .in('atividade_id', atividades.filter((a) => a.tipo === 'leitura').map((a) => a.id))
      .in('inscricao_id', meusIds),
  ])

  const entregas = new Map(
    ((entregasRes.data ?? []) as {
      atividade_id: string; inscricao_id: string; status: StatusEntrega
      concluida: boolean; nota: number | null
    }[]).map((e) => [e.atividade_id, e])
  )

  const leituraPorAtividade = new Map<string, { feito: boolean; dataPrevista: string | null }[]>()
  for (const i of (leituraRes.data ?? []) as {
    atividade_id: string; feito: boolean; data_prevista: string | null
  }[]) {
    const lista = leituraPorAtividade.get(i.atividade_id) ?? []
    lista.push({ feito: i.feito, dataPrevista: i.data_prevista })
    leituraPorAtividade.set(i.atividade_id, lista)
  }

  return atividades
    .map((a) => {
      const entrega = entregas.get(a.id)
      const leitura = progressoLeitura(leituraPorAtividade.get(a.id) ?? [], hoje)
      return {
        ...paraResumo(a),
        inscricaoId: porTurma.get(a.turma_id) ?? '',
        concluida: entrega?.concluida ?? false,
        status: entrega?.status ?? ('pendente' as StatusEntrega),
        nota: entrega?.nota === null || entrega?.nota === undefined ? null : Number(entrega.nota),
        leituraFeitos: leitura.feitos,
        leituraTotal: leitura.total,
        leituraAtrasados: leitura.atrasados,
      }
    })
    .sort((a, b) => {
      // O que falta primeiro, e dentro disso o prazo mais próximo. Quem abre a
      // tela quer saber o que fazer hoje, não o que já entregou.
      if (a.concluida !== b.concluida) return a.concluida ? 1 : -1
      if (a.prazo && b.prazo) return a.prazo.localeCompare(b.prazo)
      if (a.prazo) return -1
      if (b.prazo) return 1
      return a.titulo.localeCompare(b.titulo, 'pt-BR')
    })
}

/** Os livros da Bíblia — o catálogo que o montador de leitura usa. */
export async function livrosDaBiblia() {
  const { data } = await createAdminClient()
    .from('biblia_livros')
    .select('id, sigla, nome, testamento, capitulos')
    .order('id')
  return (data ?? []) as {
    id: number; sigla: string; nome: string; testamento: 'AT' | 'NT'; capitulos: number
  }[]
}
