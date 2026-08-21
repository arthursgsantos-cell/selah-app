'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { compararDependentes } from '@/lib/familia-dependentes'

export type DependenteItem = {
  id?: number
  nome: string
  data_nascimento: string | null
  tipo: 'cônjuge' | 'filho'
  sexo?: 'M' | 'F' | null
  /**
   * O registro vale para os dois lados do casal: quem abrir o perfil do outro
   * vê a mesma criança, e editar aqui edita lá.
   */
  compartilhado?: boolean
  /** Primeiro nome de quem cadastrou, quando não foi o dono da tela. */
  cadastradoPor?: string | null
}

type LinhaDependente = {
  id: number
  profile_id: string
  co_profile_id: string | null
  nome: string
  data_nascimento: string | null
  tipo: 'cônjuge' | 'filho'
  sexo: 'M' | 'F' | null
}

const COLUNAS = 'id, profile_id, co_profile_id, nome, data_nascimento, tipo, sexo'

async function getCallerUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')
  return user
}

async function getCallerAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'pastor', 'supervisor', 'lider'].includes(profile?.role ?? ''))
    throw new Error('Sem permissão')
  return user
}

type ClienteAdmin = ReturnType<typeof createAdminClient>

async function conjugeDe(admin: ClienteAdmin, profileId: string): Promise<string | null> {
  const { data } = await admin.from('profiles').select('conjuge_id').eq('id', profileId).single()
  return (data?.conjuge_id as string | null) ?? null
}

/** Tudo que este perfil enxerga: o que ele cadastrou e o que o cônjuge dividiu com ele. */
async function linhasVisiveis(admin: ClienteAdmin, profileId: string): Promise<LinhaDependente[]> {
  const { data, error } = await admin
    .from('dependentes')
    .select(COLUNAS)
    .or(`profile_id.eq.${profileId},co_profile_id.eq.${profileId}`)
    .order('created_at')
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as LinhaDependente[]
}

async function primeiroNomeDe(admin: ClienteAdmin, profileId: string | null): Promise<string | null> {
  if (!profileId) return null
  const { data } = await admin.from('profiles').select('nome').eq('id', profileId).single()
  return (data?.nome as string | undefined)?.split(' ')[0] ?? null
}

async function listarDependentesDe(profileId: string): Promise<DependenteItem[]> {
  const admin = createAdminClient()
  const [linhas, conjugeId] = await Promise.all([
    linhasVisiveis(admin, profileId),
    conjugeDe(admin, profileId),
  ])
  const nomeConjuge = await primeiroNomeDe(admin, conjugeId)

  return linhas.map((l) => ({
    id: l.id,
    nome: l.nome,
    data_nascimento: l.data_nascimento,
    tipo: l.tipo,
    sexo: l.sexo,
    compartilhado: Boolean(l.co_profile_id),
    cadastradoPor: l.profile_id === profileId ? null : nomeConjuge,
  }))
}

export async function buscarDependentesAction(): Promise<DependenteItem[]> {
  const user = await getCallerUser()
  return listarDependentesDe(user.id)
}

export async function buscarDependentesAdminAction(userId: string): Promise<DependenteItem[]> {
  await getCallerAdmin()
  return listarDependentesDe(userId)
}

async function filhosDoConjugeDisponiveisPara(profileId: string): Promise<DependenteItem[]> {
  const admin = createAdminClient()
  const conjugeId = await conjugeDe(admin, profileId)
  if (!conjugeId) return []

  const [{ data }, meus, nomeConjuge] = await Promise.all([
    admin.from('dependentes').select(COLUNAS).eq('profile_id', conjugeId).order('created_at'),
    linhasVisiveis(admin, profileId),
    primeiroNomeDe(admin, conjugeId),
  ])

  const linhas = ((data ?? []) as unknown as LinhaDependente[])
    .filter((l) => l.tipo === 'filho')
    .filter((l) => l.co_profile_id !== profileId)
    // Se já tenho uma linha parecida, o caso é de mesclagem, não de seleção:
    // oferecer aqui seria convidar à duplicata que estamos tentando evitar.
    .filter((l) => !meus.some((m) => compararDependentes(m, l).duplicado))

  return linhas.map((l) => ({
    id: l.id,
    nome: l.nome,
    data_nascimento: l.data_nascimento,
    tipo: l.tipo,
    sexo: l.sexo,
    compartilhado: false,
    cadastradoPor: nomeConjuge,
  }))
}

/**
 * Filhos que o cônjuge já cadastrou e que este perfil ainda não assumiu.
 * É a lista que a tela oferece para marcar em vez de digitar tudo de novo —
 * o caminho que evita a duplicata antes dela existir.
 */
export async function filhosDoConjugeDisponiveisAction(): Promise<DependenteItem[]> {
  const user = await getCallerUser()
  return filhosDoConjugeDisponiveisPara(user.id)
}

export async function filhosDoConjugeDisponiveisAdminAction(userId: string): Promise<DependenteItem[]> {
  await getCallerAdmin()
  return filhosDoConjugeDisponiveisPara(userId)
}

/**
 * Salvamento por diferença, e não apagar-tudo-e-reinserir. O id da linha
 * precisa sobreviver: é ele que liga a mesma criança aos dois responsáveis, e
 * recriar tudo a cada salvamento derrubaria o vínculo do outro lado.
 */
async function salvarDependentesPara(alvoId: string, itens: DependenteItem[]) {
  const admin = createAdminClient()
  const conjugeId = await conjugeDe(admin, alvoId)

  const visiveis = await linhasVisiveis(admin, alvoId)
  const doConjugeRes = conjugeId
    ? await admin.from('dependentes').select(COLUNAS).eq('profile_id', conjugeId)
    : { data: [] }
  const doConjuge = ((doConjugeRes.data ?? []) as unknown as LinhaDependente[])

  const porId = new Map<number, LinhaDependente>()
  for (const l of visiveis) porId.set(l.id, l)
  const conjugePorId = new Map<number, LinhaDependente>()
  for (const l of doConjuge) if (!porId.has(l.id)) conjugePorId.set(l.id, l)

  const validos = itens.filter((d) => d.nome.trim())
  const preservados = new Set<number>()
  const novos: DependenteItem[] = []
  const atualizar: Array<{ linha: LinhaDependente; item: DependenteItem; assumir: boolean }> = []

  for (const item of validos) {
    const existente = item.id ? porId.get(item.id) : undefined
    if (existente && !preservados.has(existente.id)) {
      preservados.add(existente.id)
      atualizar.push({ linha: existente, item, assumir: false })
      continue
    }

    // Veio da lista do cônjuge: assumir a linha dele em vez de criar outra.
    const doOutro = item.id ? conjugePorId.get(item.id) : undefined
    if (doOutro) {
      conjugePorId.delete(doOutro.id)
      atualizar.push({ linha: doOutro, item, assumir: true })
      continue
    }

    // Sem id: antes de inserir, ver se não é uma segunda digitação de algo que
    // já está na lista — do próprio perfil ou vindo do cônjuge.
    const jaVisivel = visiveis.find(
      (l) => !preservados.has(l.id) && compararDependentes(l, item).duplicado
    )
    if (jaVisivel) {
      preservados.add(jaVisivel.id)
      atualizar.push({ linha: jaVisivel, item, assumir: false })
      continue
    }

    const jaDoConjuge = [...conjugePorId.values()].find((l) => compararDependentes(l, item).duplicado)
    if (jaDoConjuge) {
      conjugePorId.delete(jaDoConjuge.id)
      atualizar.push({ linha: jaDoConjuge, item, assumir: true })
      continue
    }

    if (novos.some((n) => compararDependentes(n, item).duplicado)) continue

    novos.push(item)
  }

  const valores = (item: DependenteItem) => ({
    nome: item.nome.trim(),
    data_nascimento: item.data_nascimento || null,
    tipo: item.tipo,
    sexo: item.tipo === 'filho' ? item.sexo ?? null : null,
  })

  for (const { linha, item, assumir } of atualizar) {
    const patch: ReturnType<typeof valores> & { co_profile_id?: string | null } = valores(item)
    // Assumir a linha do cônjuge é só preencher o segundo responsável: filho de
    // casal não troca de dono porque o outro confirmou que também é dele.
    if (assumir) {
      patch.co_profile_id = alvoId
    } else if (
      conjugeId &&
      item.tipo === 'filho' &&
      !linha.co_profile_id &&
      linha.profile_id === alvoId
    ) {
      // Casal já vinculado: filho novo nasce dos dois.
      patch.co_profile_id = conjugeId
    }
    const { error } = await admin.from('dependentes').update(patch).eq('id', linha.id)
    if (error) throw new Error(error.message)
  }

  if (novos.length > 0) {
    const { error } = await admin.from('dependentes').insert(
      novos.map((item) => ({
        profile_id: alvoId,
        co_profile_id: conjugeId && item.tipo === 'filho' ? conjugeId : null,
        ...valores(item),
      }))
    )
    if (error) throw new Error(error.message)
  }

  // O que sumiu da lista. Remover é sempre "não é meu", nunca "não existe":
  // enquanto o outro responsável ainda tiver a criança na lista dele, a linha
  // continua viva e só troca de dono. Some de vez quando ninguém mais a
  // reivindica — e, se for engano, o cônjuge pode devolvê-la pela seleção.
  const removidos = visiveis.filter((l) => !preservados.has(l.id))
  for (const l of removidos) {
    const souDono = l.profile_id === alvoId
    const outroResponsavel = souDono ? l.co_profile_id : l.profile_id

    const { error } = !outroResponsavel
      ? await admin.from('dependentes').delete().eq('id', l.id)
      : await admin
          .from('dependentes')
          .update({ profile_id: outroResponsavel, co_profile_id: null })
          .eq('id', l.id)
    if (error) throw new Error(error.message)
  }
}

export async function salvarDependentesAction(dependentes: DependenteItem[]) {
  const user = await getCallerUser()
  await salvarDependentesPara(user.id, dependentes)
}

export async function salvarDependentesAdminAction(userId: string, dependentes: DependenteItem[]) {
  await getCallerAdmin()
  await salvarDependentesPara(userId, dependentes)
}
