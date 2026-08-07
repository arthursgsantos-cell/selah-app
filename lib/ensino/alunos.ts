/**
 * A visão do Ensino por pessoa, e não por turma.
 *
 * Todas as telas do módulo até aqui olham de dentro de uma turma: a lista de
 * chamada, os inscritos, a frequência daquela turma. Falta a pergunta oposta —
 * "por onde esta pessoa já passou?" — e é ela que este arquivo responde,
 * juntando as inscrições de todas as turmas da igreja num registro só.
 *
 * Tudo com o cliente admin: a RLS de `ensino_inscricoes` mostra ao professor
 * apenas as turmas que ele leciona, e a coordenação precisa do panorama. Quem
 * barra o acesso é a página (`acesso.coordenador`), como no resto do módulo.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { slug as slugificar } from '@/lib/importacao/texto'
import type {
  PapelCelula, Role, StatusAula, StatusInscricaoEnsino, StatusTurma,
} from '@/lib/supabase/types'

export interface CelulaDoAluno {
  nome: string
  papel: PapelCelula
  redeNome: string | null
}

/** Uma inscrição vista de fora da turma: o que o aluno cursou e como foi. */
export interface Matricula {
  inscricaoId: string
  turmaId: string
  turmaNome: string
  cursoNome: string
  status: StatusInscricaoEnsino
  criadoEm: string
  decididoEm: string | null
  presentes: number
  /** Chamadas registradas — só de aulas já realizadas. */
  registros: number
  /** Null enquanto não houve chamada; zero seria mentira diferente. */
  percentual: number | null
}

export interface AlunoResumo {
  userId: string
  slug: string
  nome: string
  avatarUrl: string | null
  email: string | null
  telefone: string | null
  role: Role
  celulas: CelulaDoAluno[]
  matriculas: Matricula[]
  ativas: number
  concluidas: number
  pendentes: number
  presentes: number
  registros: number
  /** Frequência somando todas as turmas da pessoa. */
  percentual: number | null
}

export interface AulaDoAluno {
  numero: number
  titulo: string | null
  data: string
  status: StatusAula
  /** Null = chamada ainda não registrada para esta pessoa nesta aula. */
  presente: boolean | null
}

export interface MatriculaDetalhada extends Matricula {
  turmaStatus: StatusTurma
  local: string | null
  dataInicio: string | null
  dataFim: string | null
  diasSemana: number[]
  horarioInicio: string | null
  horarioFim: string | null
  observacao: string | null
  /** Respostas do formulário de inscrição, quando a turma usa um. */
  dados: Record<string, string>
  decididoPor: string | null
  aulas: AulaDoAluno[]
}

export interface FichaAluno {
  resumo: AlunoResumo
  perfil: {
    titulo: string | null
    nascimento: string | null
    nascimentoConjuge: string | null
    casamento: string | null
    endereco: string | null
    enderecoComplemento: string | null
    enderecoMaps: string | null
    conjugeNome: string | null
    membroDesde: string
  }
  dependentes: { nome: string; tipo: string; dataNascimento: string | null }[]
  matriculas: MatriculaDetalhada[]
}

/**
 * O slug que dá a URL `/ensino/alunos/ary-barros`.
 *
 * `profiles` não tem coluna `slug`, e criar uma exigiria migração e gatilho
 * numa tabela que o app inteiro usa — para um endereço que só existe aqui.
 * Como a lista de alunos do Ensino é curta e as duas páginas já precisam
 * carregá-la, o slug é derivado do nome nas duas pontas.
 *
 * Homônimo ganha sufixo ("-2"), desempatado pelo `id`: ele não muda, ao
 * contrário da ordem de uma consulta. Trocar o nome no perfil troca a URL —
 * é ficha interna da coordenação, não link divulgado.
 */
export function slugsDosAlunos(pessoas: { id: string; nome: string }[]): Map<string, string> {
  const porBase = new Map<string, string[]>()

  for (const p of [...pessoas].sort((a, b) => a.id.localeCompare(b.id))) {
    const base = slugificar(p.nome) || 'aluno'
    porBase.set(base, [...(porBase.get(base) ?? []), p.id])
  }

  const mapa = new Map<string, string>()
  for (const [base, ids] of porBase) {
    ids.forEach((id, i) => mapa.set(id, i === 0 ? base : `${base}-${i + 1}`))
  }
  return mapa
}

function percentual(presentes: number, registros: number): number | null {
  return registros > 0 ? Math.round((presentes / registros) * 100) : null
}

/**
 * Todo mundo que já se inscreveu em alguma turma da igreja, com frequência e
 * célula. É a fonte da tabela e também de onde a ficha resolve o slug.
 */
export async function listarAlunos(igrejaId: string): Promise<AlunoResumo[]> {
  const admin = createAdminClient()

  const { data: turmasRaw } = await admin
    .from('ensino_turmas')
    .select('id, nome, ensino_cursos(nome)')
    .eq('igreja_id', igrejaId)

  const turmas = (turmasRaw ?? []) as unknown as {
    id: string; nome: string; ensino_cursos: { nome: string } | null
  }[]
  if (turmas.length === 0) return []

  const turmaIds = turmas.map((t) => t.id)
  const turmaPorId = new Map(turmas.map((t) => [t.id, t]))

  const [inscricoesRes, aulasRes] = await Promise.all([
    admin
      .from('ensino_inscricoes')
      .select('id, user_id, turma_id, nome, telefone, email, status, criado_em, decidido_em')
      .in('turma_id', turmaIds)
      .order('criado_em', { ascending: false }),
    // Só as realizadas entram na frequência: contar as futuras faria todo
    // aluno começar o curso com 0%.
    admin.from('ensino_aulas').select('id').in('turma_id', turmaIds).eq('status', 'realizada'),
  ])

  const inscricoes = (inscricoesRes.data ?? []) as {
    id: string; user_id: string; turma_id: string; nome: string
    telefone: string | null; email: string | null
    status: StatusInscricaoEnsino; criado_em: string; decidido_em: string | null
  }[]
  if (inscricoes.length === 0) return []

  const aulaIds = (aulasRes.data ?? []).map((a) => a.id)
  const userIds = [...new Set(inscricoes.map((i) => i.user_id))]

  const [perfisRes, membrosRes, presencasRes] = await Promise.all([
    admin
      .from('profiles')
      .select('id, nome, email, telefone, avatar_url, role')
      .in('id', userIds),
    admin
      .from('celula_membros')
      .select('user_id, papel, celulas(nome, redes(nome))')
      .in('user_id', userIds),
    aulaIds.length > 0
      ? admin.from('ensino_presencas').select('inscricao_id, presente').in('aula_id', aulaIds)
      : Promise.resolve({ data: [] }),
  ])

  const perfis = new Map(
    ((perfisRes.data ?? []) as {
      id: string; nome: string; email: string | null; telefone: string | null
      avatar_url: string | null; role: Role
    }[]).map((p) => [p.id, p])
  )

  const celulasPorUser = new Map<string, CelulaDoAluno[]>()
  for (const m of (membrosRes.data ?? []) as unknown as {
    user_id: string; papel: PapelCelula
    celulas: { nome: string; redes: { nome: string } | null } | null
  }[]) {
    if (!m.celulas) continue
    celulasPorUser.set(m.user_id, [
      ...(celulasPorUser.get(m.user_id) ?? []),
      { nome: m.celulas.nome, papel: m.papel, redeNome: m.celulas.redes?.nome ?? null },
    ])
  }

  const frequencia = new Map<string, { presentes: number; registros: number }>()
  for (const p of (presencasRes.data ?? []) as { inscricao_id: string; presente: boolean }[]) {
    const atual = frequencia.get(p.inscricao_id) ?? { presentes: 0, registros: 0 }
    atual.registros += 1
    if (p.presente) atual.presentes += 1
    frequencia.set(p.inscricao_id, atual)
  }

  // O nome vem do perfil, não da inscrição: a cópia guardada na inscrição é a
  // lista da turma como ela estava, mas a ficha é da pessoa de hoje.
  const slugs = slugsDosAlunos(
    userIds.map((id) => ({
      id,
      nome: perfis.get(id)?.nome ?? inscricoes.find((i) => i.user_id === id)!.nome,
    }))
  )

  const alunos = userIds.map((userId) => {
    const perfil = perfis.get(userId)
    const minhas = inscricoes.filter((i) => i.user_id === userId)
    const maisRecente = minhas[0]

    const matriculas: Matricula[] = minhas.map((i) => {
      const f = frequencia.get(i.id) ?? { presentes: 0, registros: 0 }
      const turma = turmaPorId.get(i.turma_id)
      return {
        inscricaoId: i.id,
        turmaId: i.turma_id,
        turmaNome: turma?.nome ?? 'Turma',
        cursoNome: turma?.ensino_cursos?.nome ?? 'Curso',
        status: i.status,
        criadoEm: i.criado_em,
        decididoEm: i.decidido_em,
        presentes: f.presentes,
        registros: f.registros,
        percentual: percentual(f.presentes, f.registros),
      }
    })

    const presentes = matriculas.reduce((s, m) => s + m.presentes, 0)
    const registros = matriculas.reduce((s, m) => s + m.registros, 0)

    return {
      userId,
      slug: slugs.get(userId)!,
      nome: perfil?.nome ?? maisRecente.nome,
      avatarUrl: perfil?.avatar_url ?? null,
      email: perfil?.email ?? maisRecente.email,
      telefone: perfil?.telefone ?? maisRecente.telefone,
      role: perfil?.role ?? 'membro',
      celulas: celulasPorUser.get(userId) ?? [],
      matriculas,
      ativas: matriculas.filter((m) => m.status === 'aprovada').length,
      concluidas: matriculas.filter((m) => m.status === 'concluida').length,
      pendentes: matriculas.filter((m) => m.status === 'pendente').length,
      presentes,
      registros,
      percentual: percentual(presentes, registros),
    } satisfies AlunoResumo
  })

  return alunos.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

/**
 * A ficha completa de uma pessoa.
 *
 * Começa pela lista inteira porque é ela que resolve o slug — sem coluna no
 * banco, não há como ir direto ao aluno. São consultas pequenas e indexadas, e
 * o alternativo (coluna nova em `profiles`) custa mais do que economiza.
 */
export async function fichaDoAluno(igrejaId: string, slug: string): Promise<FichaAluno | null> {
  const alunos = await listarAlunos(igrejaId)
  const resumo = alunos.find((a) => a.slug === slug)
  if (!resumo) return null

  const admin = createAdminClient()
  const turmaIds = [...new Set(resumo.matriculas.map((m) => m.turmaId))]

  const [perfilRes, dependentesRes, inscricoesRes, aulasRes, presencasRes] = await Promise.all([
    admin
      .from('profiles')
      .select(
        'titulo, conjuge_id, data_nascimento_1, data_nascimento_2, data_casamento, endereco, endereco_complemento, endereco_maps, created_at'
      )
      .eq('id', resumo.userId)
      .maybeSingle(),
    admin
      .from('dependentes')
      .select('nome, tipo, data_nascimento')
      .eq('profile_id', resumo.userId)
      .order('data_nascimento'),
    admin
      .from('ensino_inscricoes')
      // `decisor` precisa da FK nomeada: a tabela tem dois caminhos para
      // `profiles` (`user_id` e `decidido_por`) e o embed ambíguo faz o
      // PostgREST recusar a consulta inteira.
      .select(
        'id, turma_id, status, observacao, dados, criado_em, decidido_em, decisor:profiles!ensino_inscricoes_decidido_por_fkey(nome), ensino_turmas(nome, status, local, data_inicio, data_fim, dias_semana, horario_inicio, horario_fim, ensino_cursos(nome))'
      )
      .eq('user_id', resumo.userId)
      .in('turma_id', turmaIds)
      .order('criado_em', { ascending: false }),
    admin
      .from('ensino_aulas')
      .select('id, turma_id, numero, titulo, data, status')
      .in('turma_id', turmaIds)
      .order('numero'),
    admin
      .from('ensino_presencas')
      .select('aula_id, presente')
      .eq('user_id', resumo.userId),
  ])

  const perfil = perfilRes.data as {
    titulo: string | null; conjuge_id: string | null
    data_nascimento_1: string | null; data_nascimento_2: string | null
    data_casamento: string | null; endereco: string | null
    endereco_complemento: string | null; endereco_maps: string | null
    created_at: string
  } | null

  const { data: conjuge } = perfil?.conjuge_id
    ? await admin.from('profiles').select('nome').eq('id', perfil.conjuge_id).maybeSingle()
    : { data: null }

  const aulas = (aulasRes.data ?? []) as {
    id: string; turma_id: string; numero: number; titulo: string | null
    data: string; status: StatusAula
  }[]

  const presencas = new Map(
    ((presencasRes.data ?? []) as { aula_id: string; presente: boolean }[]).map((p) => [
      p.aula_id,
      p.presente,
    ])
  )

  const porInscricao = new Map(resumo.matriculas.map((m) => [m.inscricaoId, m]))

  const matriculas: MatriculaDetalhada[] = ((inscricoesRes.data ?? []) as unknown as {
    id: string; turma_id: string; status: StatusInscricaoEnsino
    observacao: string | null; dados: Record<string, string> | null
    criado_em: string; decidido_em: string | null
    decisor: { nome: string } | null
    ensino_turmas: {
      nome: string; status: StatusTurma; local: string | null
      data_inicio: string | null; data_fim: string | null; dias_semana: number[]
      horario_inicio: string | null; horario_fim: string | null
      ensino_cursos: { nome: string } | null
    } | null
  }[]).map((i) => {
    const base = porInscricao.get(i.id)
    const turma = i.ensino_turmas
    return {
      inscricaoId: i.id,
      turmaId: i.turma_id,
      turmaNome: turma?.nome ?? 'Turma',
      cursoNome: turma?.ensino_cursos?.nome ?? 'Curso',
      status: i.status,
      criadoEm: i.criado_em,
      decididoEm: i.decidido_em,
      presentes: base?.presentes ?? 0,
      registros: base?.registros ?? 0,
      percentual: base?.percentual ?? null,
      turmaStatus: turma?.status ?? 'aberta',
      local: turma?.local ?? null,
      dataInicio: turma?.data_inicio ?? null,
      dataFim: turma?.data_fim ?? null,
      diasSemana: turma?.dias_semana ?? [],
      horarioInicio: turma?.horario_inicio ?? null,
      horarioFim: turma?.horario_fim ?? null,
      observacao: i.observacao,
      dados: i.dados ?? {},
      decididoPor: i.decisor?.nome ?? null,
      aulas: aulas
        .filter((a) => a.turma_id === i.turma_id)
        .map((a) => ({
          numero: a.numero,
          titulo: a.titulo,
          data: a.data,
          status: a.status,
          presente: presencas.has(a.id) ? presencas.get(a.id)! : null,
        })),
    }
  })

  return {
    resumo,
    perfil: {
      titulo: perfil?.titulo ?? null,
      nascimento: perfil?.data_nascimento_1 ?? null,
      nascimentoConjuge: perfil?.data_nascimento_2 ?? null,
      casamento: perfil?.data_casamento ?? null,
      endereco: perfil?.endereco ?? null,
      enderecoComplemento: perfil?.endereco_complemento ?? null,
      enderecoMaps: perfil?.endereco_maps ?? null,
      conjugeNome: (conjuge as { nome: string } | null)?.nome ?? null,
      membroDesde: perfil?.created_at ?? '',
    },
    dependentes: ((dependentesRes.data ?? []) as {
      nome: string; tipo: string; data_nascimento: string | null
    }[]).map((d) => ({ nome: d.nome, tipo: d.tipo, dataNascimento: d.data_nascimento })),
    matriculas,
  }
}
