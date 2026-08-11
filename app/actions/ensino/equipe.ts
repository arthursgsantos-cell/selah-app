'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { acessoEnsino } from '@/lib/ensino/permissoes'
import type { PapelEnsino } from '@/lib/supabase/types'
import type { ResultadoAcao } from '@/lib/ensino/tipos'

export interface MembroEquipe {
  profileId: string
  nome: string
  email: string | null
  avatarUrl: string | null
  papel: PapelEnsino
  turmas: number
}

/** Quem é professor ou coordenador na igreja, com quantas turmas leciona. */
export async function listarEquipe(): Promise<MembroEquipe[]> {
  const acesso = await acessoEnsino()
  if (!acesso) return []

  const supabase = await createClient()
  const { data } = await supabase
    .from('ensino_equipe')
    .select('profile_id, papel, profiles(nome, email, avatar_url)')
    .eq('igreja_id', acesso.igrejaId)

  const linhas = (data ?? []) as unknown as {
    profile_id: string
    papel: PapelEnsino
    profiles: { nome: string; email: string | null; avatar_url: string | null } | null
  }[]

  if (linhas.length === 0) return []

  const { data: vinculos } = await supabase
    .from('ensino_turma_professores')
    .select('profile_id')
    .in('profile_id', linhas.map((l) => l.profile_id))

  const porProfessor = new Map<string, number>()
  for (const v of (vinculos ?? []) as { profile_id: string | null }[]) {
    // A turma também aceita professor sem conta, que não tem `profile_id` e
    // portanto não conta para ninguém desta lista.
    if (!v.profile_id) continue
    porProfessor.set(v.profile_id, (porProfessor.get(v.profile_id) ?? 0) + 1)
  }

  return linhas
    .map((l) => ({
      profileId: l.profile_id,
      nome: l.profiles?.nome ?? 'Sem nome',
      email: l.profiles?.email ?? null,
      avatarUrl: l.profiles?.avatar_url ?? null,
      papel: l.papel,
      turmas: porProfessor.get(l.profile_id) ?? 0,
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome))
}

export interface CandidatoProfessor {
  id: string
  /** `pre_cadastro` é quem ainda não tem conta no app. */
  tipo: 'profile' | 'pre_cadastro'
  nome: string
  avatarUrl: string | null
  /** De onde vem a permissão de dar aula. */
  origem: 'equipe' | 'lideranca' | 'turma' | 'sem_conta'
}

/**
 * Quem pode ser posto como professor de uma turma.
 *
 * Três fontes: a equipe do Ensino, a liderança da igreja — pastor e admin
 * coordenam sem cadastro em `ensino_equipe` — e quem já leciona a turma. A
 * terceira existe porque quem cria a turma vira professor dela na hora, mesmo
 * sem passar pela equipe: sem esse resgate, o nome que está na turma sumiria da
 * lista que ele mesmo ocupa e a primeira gravação o derrubaria sem aviso.
 */
export async function listarCandidatosProfessor(
  turmaId?: string
): Promise<CandidatoProfessor[]> {
  const acesso = await acessoEnsino()
  if (!acesso?.coordenador) return []

  const admin = createAdminClient()

  const [equipeRes, liderancaRes, atuaisRes] = await Promise.all([
    admin.from('ensino_equipe').select('profile_id').eq('igreja_id', acesso.igrejaId),
    admin
      .from('profiles')
      .select('id')
      .eq('igreja_id', acesso.igrejaId)
      .in('role', ['pastor', 'admin']),
    turmaId
      ? admin
          .from('ensino_turma_professores')
          .select('profile_id, pre_cadastro_id')
          .eq('turma_id', turmaId)
      : Promise.resolve({ data: [] as { profile_id: string | null; pre_cadastro_id: string | null }[] }),
  ])

  const atuais = (atuaisRes.data ?? []) as {
    profile_id: string | null; pre_cadastro_id: string | null
  }[]

  const daEquipe = new Set(((equipeRes.data ?? []) as { profile_id: string }[]).map((e) => e.profile_id))
  const daLideranca = new Set(((liderancaRes.data ?? []) as { id: string }[]).map((p) => p.id))
  const daTurma = new Set(atuais.map((t) => t.profile_id).filter((id): id is string => id !== null))
  const semConta = atuais.map((t) => t.pre_cadastro_id).filter((id): id is string => id !== null)

  const ids = [...new Set([...daEquipe, ...daLideranca, ...daTurma])]

  const [perfisRes, presRes] = await Promise.all([
    ids.length > 0
      ? admin
          .from('profiles')
          .select('id, nome, avatar_url')
          .eq('igreja_id', acesso.igrejaId)
          .in('id', ids)
      : Promise.resolve({ data: [] as { id: string; nome: string; avatar_url: string | null }[] }),
    // Quem já está na turma sem ter conta. Só estes: a lista da igreja inteira
    // viraria centenas de linhas de checkbox — para achar alguém novo existe a
    // busca.
    semConta.length > 0
      ? admin.from('membros_pre_cadastro').select('id, nome').in('id', semConta)
      : Promise.resolve({ data: [] as { id: string; nome: string }[] }),
  ])

  const perfis: CandidatoProfessor[] = (
    (perfisRes.data ?? []) as { id: string; nome: string; avatar_url: string | null }[]
  ).map((p) => ({
    id: p.id,
    tipo: 'profile' as const,
    nome: p.nome,
    avatarUrl: p.avatar_url,
    origem: daEquipe.has(p.id)
      ? ('equipe' as const)
      : daLideranca.has(p.id)
        ? ('lideranca' as const)
        : ('turma' as const),
  }))

  const pres: CandidatoProfessor[] = ((presRes.data ?? []) as { id: string; nome: string }[]).map(
    (p) => ({
      id: p.id,
      tipo: 'pre_cadastro' as const,
      nome: p.nome,
      avatarUrl: null,
      origem: 'sem_conta' as const,
    })
  )

  return [...perfis, ...pres].sort((a, b) => a.nome.localeCompare(b.nome))
}

/** Vira `%joão%` sem os caracteres que quebrariam o filtro do PostgREST. */
function curinga(termo: string): string {
  return `%${termo.replace(/[%,()*\\]/g, ' ').trim()}%`
}

function limpar(valor: string | null | undefined): string | null {
  const t = valor?.trim()
  return t ? t : null
}

/**
 * Procura quem pôr como professor entre os perfis e os pré-cadastros da igreja.
 *
 * Gêmea de `buscarPessoasParaTurma`, que faz o mesmo para o aluno: a lista fixa
 * de candidatos só mostra a equipe do Ensino e a liderança, e a turma pode ser
 * dada por qualquer membro. A busca vem antes do cadastro na tela porque
 * recadastrar quem o app já conhece criaria uma segunda ficha, sem histórico.
 */
export async function buscarPessoasParaProfessor(termo: string): Promise<CandidatoProfessor[]> {
  const acesso = await acessoEnsino()
  if (!acesso?.coordenador) return []

  const busca = termo.trim()
  if (busca.length < 2) return []

  const admin = createAdminClient()
  const padrao = curinga(busca)

  const [perfisRes, preRes] = await Promise.all([
    admin
      .from('profiles')
      .select('id, nome, avatar_url')
      .eq('igreja_id', acesso.igrejaId)
      .or(`nome.ilike.${padrao},email.ilike.${padrao},telefone.ilike.${padrao}`)
      .order('nome')
      .limit(8),
    // Só quem ainda não virou perfil: o pré-cadastro já vinculado seria a mesma
    // pessoa do resultado de cima, duas vezes na lista.
    admin
      .from('membros_pre_cadastro')
      .select('id, nome')
      .eq('igreja_id', acesso.igrejaId)
      .is('profile_id', null)
      .or(`nome.ilike.${padrao},email.ilike.${padrao},telefone.ilike.${padrao}`)
      .order('nome')
      .limit(8),
  ])

  const perfis: CandidatoProfessor[] = (
    (perfisRes.data ?? []) as { id: string; nome: string; avatar_url: string | null }[]
  ).map((p) => ({
    id: p.id,
    tipo: 'profile' as const,
    nome: p.nome,
    avatarUrl: p.avatar_url,
    origem: 'equipe' as const,
  }))

  const pres: CandidatoProfessor[] = ((preRes.data ?? []) as { id: string; nome: string }[]).map(
    (p) => ({
      id: p.id,
      tipo: 'pre_cadastro' as const,
      nome: p.nome,
      avatarUrl: null,
      origem: 'sem_conta' as const,
    })
  )

  // Quem tem conta primeiro: é o cadastro mais completo dos dois.
  return [...perfis, ...pres].slice(0, 10)
}

/**
 * Cadastra na igreja um professor que o app não conhece.
 *
 * Só o nome é obrigatório, como no cadastro de aluno manual e pela mesma razão:
 * quem está montando a turma nem sempre sabe o contato de quem vai dar aula. A
 * pessoa é gravada em `membros_pre_cadastro` — a lista da igreja, não uma tabela
 * do Ensino —, então ela passa a existir para o app inteiro e é reconhecida pelo
 * e-mail quando criar a conta.
 *
 * Não toca na turma: devolve a pessoa para a tela pôr na lista, e o vínculo é
 * gravado quando o formulário for salvo. É o que faz esta ação servir também à
 * turma que ainda não existe, na tela de nova turma.
 */
export async function cadastrarProfessorSemContaAction(params: {
  nome: string
  telefone?: string | null
  email?: string | null
}): Promise<{ ok: true; pessoa: CandidatoProfessor } | { ok: false; erro: string }> {
  const acesso = await acessoEnsino()
  if (!acesso?.coordenador) {
    return { ok: false, erro: 'Só a coordenação do Ensino cadastra professores.' }
  }

  const nome = params.nome.trim().replace(/\s+/g, ' ')
  if (nome.length < 2) return { ok: false, erro: 'Informe o nome do professor.' }

  const email = limpar(params.email)?.toLowerCase() ?? null
  const telefone = limpar(params.telefone)
  const admin = createAdminClient()

  // E-mail é identidade: se já é de alguém no app, é aquela pessoa que entra na
  // turma, em vez de uma segunda ficha para o mesmo nome.
  if (email) {
    const { data: perfil } = await admin
      .from('profiles')
      .select('id, nome, avatar_url')
      .eq('igreja_id', acesso.igrejaId)
      .ilike('email', email)
      .limit(1)
      .maybeSingle()

    if (perfil) {
      const p = perfil as { id: string; nome: string; avatar_url: string | null }
      return {
        ok: true,
        pessoa: {
          id: p.id, tipo: 'profile', nome: p.nome, avatarUrl: p.avatar_url, origem: 'equipe',
        },
      }
    }

    const { data: pre } = await admin
      .from('membros_pre_cadastro')
      .select('id, nome')
      .eq('igreja_id', acesso.igrejaId)
      .is('profile_id', null)
      .ilike('email', email)
      .limit(1)
      .maybeSingle()

    if (pre) {
      const p = pre as { id: string; nome: string }
      return {
        ok: true,
        pessoa: { id: p.id, tipo: 'pre_cadastro', nome: p.nome, avatarUrl: null, origem: 'sem_conta' },
      }
    }
  }

  // Sem cargo: definir cargo de membro é decisão da liderança, não efeito
  // colateral de escalar alguém para dar aula.
  const { data: criado, error } = await admin
    .from('membros_pre_cadastro')
    .insert({
      igreja_id: acesso.igrejaId,
      nome,
      telefone,
      email,
      obs: 'Cadastrado pelo Ensino como professor',
      created_by: acesso.userId,
    })
    .select('id')
    .single()

  if (error || !criado) {
    return { ok: false, erro: error?.message ?? 'Não foi possível cadastrar a pessoa.' }
  }

  revalidatePath('/usuarios')
  revalidatePath('/pendencias')
  return {
    ok: true,
    pessoa: {
      id: (criado as { id: string }).id,
      tipo: 'pre_cadastro',
      nome,
      avatarUrl: null,
      origem: 'sem_conta',
    },
  }
}

export async function definirPapelAction(
  profileId: string,
  papel: PapelEnsino
): Promise<ResultadoAcao> {
  const acesso = await acessoEnsino()
  if (!acesso?.coordenador) {
    return { ok: false, erro: 'Só a coordenação do Ensino altera permissões.' }
  }

  const admin = createAdminClient()

  // Confere que a pessoa é da mesma igreja: `profileId` chega da interface e
  // não pode virar porta para promover alguém de fora.
  const { data: alvo } = await admin
    .from('profiles')
    .select('id, igreja_id')
    .eq('id', profileId)
    .single()

  if (!alvo || alvo.igreja_id !== acesso.igrejaId) {
    return { ok: false, erro: 'Pessoa não encontrada nesta igreja.' }
  }

  const { error } = await admin
    .from('ensino_equipe')
    .upsert(
      { igreja_id: acesso.igrejaId, profile_id: profileId, papel },
      { onConflict: 'igreja_id,profile_id' }
    )

  if (error) return { ok: false, erro: error.message }
  revalidatePath('/ensino/admin')
  return { ok: true }
}

export async function removerDaEquipeAction(profileId: string): Promise<ResultadoAcao> {
  const acesso = await acessoEnsino()
  if (!acesso?.coordenador) {
    return { ok: false, erro: 'Só a coordenação do Ensino altera permissões.' }
  }
  if (profileId === acesso.userId) {
    return { ok: false, erro: 'Você não pode remover a si mesmo da equipe.' }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('ensino_equipe')
    .delete()
    .eq('igreja_id', acesso.igrejaId)
    .eq('profile_id', profileId)

  if (error) return { ok: false, erro: error.message }

  // Sai também das turmas: manter o vínculo deixaria alguém sem papel no
  // Ensino ainda fazendo chamada, já que `ensino_leciona` olha essa tabela.
  await admin.from('ensino_turma_professores').delete().eq('profile_id', profileId)

  revalidatePath('/ensino/admin')
  return { ok: true }
}

/** Candidatos a professor: membros da igreja que ainda não estão na equipe. */
export async function buscarCandidatos(termo: string): Promise<
  { id: string; nome: string; email: string | null; avatarUrl: string | null }[]
> {
  const acesso = await acessoEnsino()
  if (!acesso?.coordenador) return []

  const busca = termo.trim()
  if (busca.length < 2) return []

  const admin = createAdminClient()
  const { data: equipe } = await admin
    .from('ensino_equipe')
    .select('profile_id')
    .eq('igreja_id', acesso.igrejaId)

  const jaNaEquipe = new Set((equipe ?? []).map((e) => e.profile_id))

  const { data } = await admin
    .from('profiles')
    .select('id, nome, email, avatar_url')
    .eq('igreja_id', acesso.igrejaId)
    .ilike('nome', `%${busca}%`)
    .limit(20)

  return (data ?? [])
    .filter((p) => !jaNaEquipe.has(p.id))
    .map((p) => ({ id: p.id, nome: p.nome, email: p.email, avatarUrl: p.avatar_url }))
}
