'use server'

/**
 * A chamada do encontro.
 *
 * O que o app já tinha era o RSVP: o irmão diz, antes, se pretende ir. Isso
 * nunca respondeu a pergunta da supervisão — quem de fato esteve na célula. É
 * o líder, no dia, que sabe. Aqui ele marca.
 *
 * Duas decisões que moldam o resto do arquivo:
 *
 * - **a lista é a célula inteira, não só quem tem conta.** Hoje a maioria das
 *   pessoas organizadas nas células está em `membros_pre_cadastro` e nunca
 *   criou login. Chamada que ignora essa gente mede a metade errada da igreja.
 * - **cada toque grava sozinho.** A chamada é feita no celular, em pé, no meio
 *   da sala. Não existe "salvar no fim": perder a lista pela metade por causa
 *   de uma aba fechada seria perder o encontro inteiro.
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { exigirPermissaoEncontro } from '@/lib/celula-permissoes'
import { revalidatePath } from 'next/cache'
import type { StatusPresenca } from '@/lib/supabase/types'

/** Cargos que fazem chamada em qualquer célula da igreja. */
const CARGOS_DIRECAO = ['admin', 'pastor', 'supervisor', 'supervisor_treinamento']

export type TipoLinha = 'membro' | 'pre_cadastro' | 'visitante'

export interface LinhaChamada {
  /**
   * Identidade da linha para o cliente: `m:<user_id>`, `p:<pre_cadastro_id>`
   * ou `v:<id da própria linha de presença>`. Uma chave só, porque a lista
   * mistura os três tipos e o React precisa de um `key` estável.
   */
  chave: string
  tipo: TipoLinha
  nome: string
  avatarUrl: string | null
  lider: boolean
  /** `null` = a chamada ainda não passou por esta pessoa. */
  presente: boolean | null
  /** O que ela respondeu antes do encontro, quando respondeu. */
  rsvp: StatusPresenca | null
  /**
   * Cônjuge que não tem linha própria na lista — cônjuge de fora da célula, ou
   * cadastrado só como dependente. Sem isso ele não teria como ser contado.
   */
  conjugeNome: string | null
  comConjuge: boolean
  /** Visitantes que a pessoa avisou que traria, no RSVP. Só um lembrete. */
  visitantesDeclarados: number
}

export interface Chamada {
  encontroId: string
  celulaId: string
  celulaNome: string
  dataHora: string
  /** Membros e pré-cadastrados, líderes primeiro, depois em ordem de nome. */
  linhas: LinhaChamada[]
  /** Visitantes daquele dia, na ordem em que foram acrescentados. */
  visitantes: LinhaChamada[]
}

interface Acesso {
  userId: string
  encontroId: string
  celulaId: string
  celulaNome: string
  dataHora: string
  statusEncontro: string
}

/**
 * Quem faz a chamada de um encontro: o líder daquela célula e a direção da
 * igreja. Membro comum responde pela própria presença no RSVP e para por aí —
 * chamada em que qualquer um marca qualquer um não é registro, é palpite.
 */
async function acessoChamada(encontroId: string): Promise<Acesso | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()

  const { data: encontro } = await admin
    .from('encontros')
    .select('id, celula_id, data_hora, status, celulas(nome)')
    .eq('id', encontroId)
    .maybeSingle()

  if (!encontro) return null

  const e = encontro as unknown as {
    id: string; celula_id: string; data_hora: string; status: string
    celulas: { nome: string } | null
  }

  const base: Acesso = {
    userId: user.id,
    encontroId: e.id,
    celulaId: e.celula_id,
    celulaNome: e.celulas?.nome ?? 'Célula',
    dataHora: e.data_hora,
    statusEncontro: e.status,
  }

  const { data: vinculo } = await admin
    .from('celula_membros')
    .select('papel')
    .eq('celula_id', e.celula_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (vinculo?.papel === 'lider') return base

  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  return profile && CARGOS_DIRECAO.includes(profile.role) ? base : null
}

/** `true` quando a pessoa logada pode abrir a chamada deste encontro. */
export async function podeFazerChamada(encontroId: string): Promise<boolean> {
  return (await acessoChamada(encontroId)) !== null
}

/**
 * A lista da chamada: todo mundo da célula, mais os visitantes já
 * acrescentados, com o que já foi marcado.
 */
export async function carregarChamada(encontroId: string): Promise<Chamada | null> {
  const acesso = await acessoChamada(encontroId)
  if (!acesso) return null

  const admin = createAdminClient()

  const [
    { data: membrosData },
    { data: preCadastradosData },
    { data: presencasData },
  ] = await Promise.all([
    admin
      .from('celula_membros')
      .select('user_id, papel, profiles(nome, avatar_url, conjuge_id)')
      .eq('celula_id', acesso.celulaId),
    admin
      .from('membros_pre_cadastro')
      .select('id, nome')
      .eq('celula_id', acesso.celulaId)
      .is('profile_id', null)
      .order('nome'),
    admin
      .from('presencas')
      .select('id, user_id, pre_cadastro_id, visitante_nome, status, presente, com_conjuge, num_visitantes')
      .eq('encontro_id', encontroId),
  ])

  const membros = ((membrosData ?? []) as unknown as {
    user_id: string
    papel: 'lider' | 'membro'
    profiles: { nome: string; avatar_url: string | null; conjuge_id: string | null } | null
  }[]).filter((m) => m.profiles)

  const preCadastrados = (preCadastradosData ?? []) as { id: string; nome: string }[]

  const presencas = (presencasData ?? []) as {
    id: string
    user_id: string | null
    pre_cadastro_id: string | null
    visitante_nome: string | null
    status: StatusPresenca
    presente: boolean | null
    com_conjuge: boolean
    num_visitantes: number
  }[]

  const porUsuario = new Map(presencas.filter((p) => p.user_id).map((p) => [p.user_id!, p]))
  const porPreCadastro = new Map(
    presencas.filter((p) => p.pre_cadastro_id).map((p) => [p.pre_cadastro_id!, p]),
  )

  // ── Cônjuges que não têm linha própria
  //
  // Quem é casado com outro membro da célula aparece duas vezes na lista, uma
  // para cada um: aí não existe "+ cônjuge" a marcar. Sobram dois casos — o
  // cônjuge de fora da célula e o que existe só como dependente —, e são esses
  // que ganham o botão, senão sumiriam da conta.
  const naLista = new Set(membros.map((m) => m.user_id))
  const conjugesDeFora = membros
    .map((m) => m.profiles!.conjuge_id)
    .filter((id): id is string => !!id && !naLista.has(id))

  const [{ data: conjugesData }, { data: dependentesData }] = await Promise.all([
    conjugesDeFora.length > 0
      ? admin.from('profiles').select('id, nome').in('id', conjugesDeFora)
      : Promise.resolve({ data: [] }),
    membros.length > 0
      ? admin
          .from('dependentes')
          .select('profile_id, co_profile_id, nome')
          .eq('tipo', 'cônjuge')
          .or(
            `profile_id.in.(${membros.map((m) => m.user_id).join(',')}),` +
            `co_profile_id.in.(${membros.map((m) => m.user_id).join(',')})`,
          )
      : Promise.resolve({ data: [] }),
  ])

  const nomeConjugePorId = new Map(
    ((conjugesData ?? []) as { id: string; nome: string }[]).map((c) => [c.id, c.nome]),
  )
  const conjugeDependentePorMembro = new Map<string, string>()
  ;((dependentesData ?? []) as { profile_id: string; co_profile_id: string | null; nome: string }[])
    .forEach((d) => {
      if (d.profile_id) conjugeDependentePorMembro.set(d.profile_id, d.nome)
      if (d.co_profile_id) conjugeDependentePorMembro.set(d.co_profile_id, d.nome)
    })

  const linhasMembros: LinhaChamada[] = membros.map((m) => {
    const p = porUsuario.get(m.user_id)
    const conjugeId = m.profiles!.conjuge_id
    const conjugeNome =
      conjugeId && !naLista.has(conjugeId)
        ? nomeConjugePorId.get(conjugeId) ?? null
        : conjugeId
          ? null
          : conjugeDependentePorMembro.get(m.user_id) ?? null

    return {
      chave: `m:${m.user_id}`,
      tipo: 'membro' as const,
      nome: m.profiles!.nome,
      avatarUrl: m.profiles!.avatar_url,
      lider: m.papel === 'lider',
      presente: p?.presente ?? null,
      rsvp: p?.status ?? null,
      conjugeNome: conjugeNome ? conjugeNome.split(' ')[0] : null,
      comConjuge: p?.com_conjuge ?? false,
      visitantesDeclarados: p?.num_visitantes ?? 0,
    }
  })

  const linhasPreCadastro: LinhaChamada[] = preCadastrados.map((pc) => {
    const p = porPreCadastro.get(pc.id)
    return {
      chave: `p:${pc.id}`,
      tipo: 'pre_cadastro' as const,
      nome: pc.nome,
      avatarUrl: null,
      lider: false,
      presente: p?.presente ?? null,
      rsvp: null,
      conjugeNome: null,
      comConjuge: p?.com_conjuge ?? false,
      visitantesDeclarados: 0,
    }
  })

  const linhas = [...linhasMembros, ...linhasPreCadastro].sort((a, b) => {
    if (a.lider !== b.lider) return a.lider ? -1 : 1
    return a.nome.localeCompare(b.nome, 'pt-BR')
  })

  const visitantes: LinhaChamada[] = presencas
    .filter((p) => p.visitante_nome)
    .map((p) => ({
      chave: `v:${p.id}`,
      tipo: 'visitante' as const,
      nome: p.visitante_nome!,
      avatarUrl: null,
      lider: false,
      presente: p.presente ?? true,
      rsvp: null,
      conjugeNome: null,
      comConjuge: false,
      visitantesDeclarados: 0,
    }))

  return {
    encontroId,
    celulaId: acesso.celulaId,
    celulaNome: acesso.celulaNome,
    dataHora: acesso.dataHora,
    linhas,
    visitantes,
  }
}

/** Resumo da chamada para quem só quer o número: a aba do encontro, a célula. */
export interface ResumoChamada {
  feita: boolean
  presentes: number
  ausentes: number
  semMarcar: number
  /** Pessoas no total: presentes + cônjuges marcados + visitantes. */
  totalPessoas: number
}

export async function resumoDaChamada(encontroId: string): Promise<ResumoChamada> {
  await exigirPermissaoEncontro(encontroId)

  const admin = createAdminClient()

  const vazio: ResumoChamada = {
    feita: false, presentes: 0, ausentes: 0, semMarcar: 0, totalPessoas: 0,
  }

  const [{ data: presencasData }, { data: encontro }] = await Promise.all([
    admin
      .from('presencas')
      .select('visitante_nome, presente, com_conjuge')
      .eq('encontro_id', encontroId),
    admin.from('encontros').select('celula_id').eq('id', encontroId).maybeSingle(),
  ])

  const presencas = (presencasData ?? []) as {
    visitante_nome: string | null
    presente: boolean | null
    com_conjuge: boolean
  }[]

  const marcadas = presencas.filter((p) => p.presente !== null)
  const celulaId = (encontro as { celula_id: string } | null)?.celula_id
  if (marcadas.length === 0 || !celulaId) return vazio

  // O denominador é a célula inteira, com conta e sem conta: "12 de 20" só
  // significa alguma coisa se os 20 forem todas as pessoas da lista.
  const [{ count: totalMembros }, { count: totalPre }] = await Promise.all([
    admin
      .from('celula_membros')
      .select('user_id', { count: 'exact', head: true })
      .eq('celula_id', celulaId),
    admin
      .from('membros_pre_cadastro')
      .select('id', { count: 'exact', head: true })
      .eq('celula_id', celulaId)
      .is('profile_id', null),
  ])

  const presentes = marcadas.filter((p) => p.presente && !p.visitante_nome).length
  const ausentes = marcadas.filter((p) => p.presente === false).length
  const visitantes = marcadas.filter((p) => p.presente && p.visitante_nome).length
  const conjuges = marcadas.filter((p) => p.presente && p.com_conjuge).length

  return {
    feita: true,
    presentes,
    ausentes,
    semMarcar: Math.max(0, (totalMembros ?? 0) + (totalPre ?? 0) - presentes - ausentes),
    totalPessoas: presentes + conjuges + visitantes,
  }
}

type Resultado = { ok: true } | { ok: false; erro: string }

/**
 * O encontro passa a "realizado" na primeira marcação.
 *
 * Poupa o líder de um segundo passo e, mais importante, é o que faz o encontro
 * entrar nas contas da supervisão: `saude_celulas` e `presenca_serie` só olham
 * encontro realizado. Sem isso, a célula que se reúne toda semana continuaria
 * aparecendo como silenciosa no painel.
 */
async function marcarEncontroRealizado(admin: ReturnType<typeof createAdminClient>, encontroId: string) {
  await admin
    .from('encontros')
    .update({ status: 'realizado' })
    .eq('id', encontroId)
    .eq('status', 'agendado')
}

function revalidar(encontroId: string) {
  revalidatePath(`/encontro/${encontroId}`)
  revalidatePath(`/encontro/${encontroId}/chamada`)
  revalidatePath('/celula')
  revalidatePath('/supervisor')
}

/** Marca (ou corrige) uma pessoa da lista. Um toque, uma gravação. */
export async function marcarPresencaChamadaAction(params: {
  encontroId: string
  chave: string
  presente: boolean
}): Promise<Resultado> {
  const acesso = await acessoChamada(params.encontroId)
  if (!acesso) return { ok: false, erro: 'Você não faz a chamada deste encontro.' }

  const admin = createAdminClient()
  const [tipo, id] = params.chave.split(':')
  const marca = { presente: params.presente, marcado_por: acesso.userId, marcado_em: new Date().toISOString() }

  if (tipo === 'm') {
    const { error } = await admin
      .from('presencas')
      .upsert({ encontro_id: params.encontroId, user_id: id, ...marca }, { onConflict: 'encontro_id,user_id' })
    if (error) return { ok: false, erro: error.message }
  } else if (tipo === 'p') {
    // A pessoa sem conta tem de ser desta célula: sem esta conferência, um id
    // de pré-cadastro de outra célula entraria na chamada desta.
    const { data: pc } = await admin
      .from('membros_pre_cadastro')
      .select('celula_id')
      .eq('id', id)
      .maybeSingle()
    if (!pc || pc.celula_id !== acesso.celulaId) {
      return { ok: false, erro: 'Esta pessoa não é desta célula.' }
    }
    const { error } = await admin
      .from('presencas')
      .upsert(
        { encontro_id: params.encontroId, pre_cadastro_id: id, ...marca },
        { onConflict: 'encontro_id,pre_cadastro_id' },
      )
    if (error) return { ok: false, erro: error.message }
  } else if (tipo === 'v') {
    const { error } = await admin
      .from('presencas')
      .update(marca)
      .eq('id', id)
      .eq('encontro_id', params.encontroId)
    if (error) return { ok: false, erro: error.message }
  } else {
    return { ok: false, erro: 'Linha desconhecida.' }
  }

  await marcarEncontroRealizado(admin, params.encontroId)
  revalidar(params.encontroId)
  return { ok: true }
}

/** O atalho de "todos presentes" — e o de desfazer, marcando todos ausentes. */
export async function marcarTodosChamadaAction(params: {
  encontroId: string
  presente: boolean
}): Promise<Resultado> {
  const acesso = await acessoChamada(params.encontroId)
  if (!acesso) return { ok: false, erro: 'Você não faz a chamada deste encontro.' }

  const admin = createAdminClient()
  const marca = { presente: params.presente, marcado_por: acesso.userId, marcado_em: new Date().toISOString() }

  const [{ data: membros }, { data: preCadastrados }] = await Promise.all([
    admin.from('celula_membros').select('user_id').eq('celula_id', acesso.celulaId),
    admin
      .from('membros_pre_cadastro')
      .select('id')
      .eq('celula_id', acesso.celulaId)
      .is('profile_id', null),
  ])

  // Dois upserts, e não um: cada tipo de linha entra pela sua chave única.
  const erros: string[] = []

  if ((membros ?? []).length > 0) {
    const { error } = await admin.from('presencas').upsert(
      (membros ?? []).map((m) => ({ encontro_id: params.encontroId, user_id: m.user_id, ...marca })),
      { onConflict: 'encontro_id,user_id' },
    )
    if (error) erros.push(error.message)
  }

  if ((preCadastrados ?? []).length > 0) {
    const { error } = await admin.from('presencas').upsert(
      (preCadastrados ?? []).map((p) => ({ encontro_id: params.encontroId, pre_cadastro_id: p.id, ...marca })),
      { onConflict: 'encontro_id,pre_cadastro_id' },
    )
    if (error) erros.push(error.message)
  }

  if (erros.length > 0) return { ok: false, erro: erros.join(' · ') }

  await marcarEncontroRealizado(admin, params.encontroId)
  revalidar(params.encontroId)
  return { ok: true }
}

/** Cônjuge que não tem linha própria: veio junto, conta como pessoa. */
export async function marcarConjugeChamadaAction(params: {
  encontroId: string
  chave: string
  comConjuge: boolean
}): Promise<Resultado> {
  const acesso = await acessoChamada(params.encontroId)
  if (!acesso) return { ok: false, erro: 'Você não faz a chamada deste encontro.' }

  const [tipo, id] = params.chave.split(':')
  if (tipo !== 'm') return { ok: false, erro: 'Só membro com cadastro tem cônjuge na lista.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('presencas')
    .upsert(
      { encontro_id: params.encontroId, user_id: id, com_conjuge: params.comConjuge },
      { onConflict: 'encontro_id,user_id' },
    )
  if (error) return { ok: false, erro: error.message }

  revalidar(params.encontroId)
  return { ok: true }
}

/**
 * Visitante do dia: nome escrito na hora, já presente.
 *
 * Quem visita não está em lista nenhuma — não é membro nem pré-cadastro —, e é
 * exatamente ele que a supervisão quer ver crescendo. Guardar só o número, como
 * o RSVP fazia, perde o nome de quem voltou na semana seguinte.
 */
export async function adicionarVisitanteAction(params: {
  encontroId: string
  nome: string
}): Promise<{ ok: true; chave: string; nome: string } | { ok: false; erro: string }> {
  const acesso = await acessoChamada(params.encontroId)
  if (!acesso) return { ok: false, erro: 'Você não faz a chamada deste encontro.' }

  const nome = params.nome.trim()
  if (!nome) return { ok: false, erro: 'Escreva o nome do visitante.' }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('presencas')
    .insert({
      encontro_id: params.encontroId,
      visitante_nome: nome,
      presente: true,
      marcado_por: acesso.userId,
      marcado_em: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error) return { ok: false, erro: error.message }

  await marcarEncontroRealizado(admin, params.encontroId)
  revalidar(params.encontroId)
  return { ok: true, chave: `v:${data.id}`, nome }
}

/** Tira o visitante da lista de vez — nome errado, ou linha repetida. */
export async function removerVisitanteAction(params: {
  encontroId: string
  chave: string
}): Promise<Resultado> {
  const acesso = await acessoChamada(params.encontroId)
  if (!acesso) return { ok: false, erro: 'Você não faz a chamada deste encontro.' }

  const [tipo, id] = params.chave.split(':')
  if (tipo !== 'v') return { ok: false, erro: 'Só visitante sai da lista.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('presencas')
    .delete()
    .eq('id', id)
    .eq('encontro_id', params.encontroId)
    .not('visitante_nome', 'is', null)

  if (error) return { ok: false, erro: error.message }

  revalidar(params.encontroId)
  return { ok: true }
}
