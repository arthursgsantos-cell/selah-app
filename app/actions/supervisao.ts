'use server'

/**
 * Registro das reuniões de supervisão.
 *
 * O que hoje vive no caderno do supervisor: quando sentou com o líder, quem
 * apareceu, o que foi combinado. Guardar isso resolve duas coisas — o
 * histórico do combinado, e a resposta para "faz quanto tempo que ninguém
 * senta com esse líder?", que é o que alimenta o painel de saúde da rede.
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export interface DadosSupervisao {
  redeId: string
  /** Nulo = reunião da rede inteira, não de uma célula. */
  celulaId: string | null
  data: string
  pauta: string | null
  encaminhamentos: string | null
  /** Quem foi convocado, com a marcação de quem apareceu. */
  participantes: { userId: string; presente: boolean }[]
}

interface Permissao {
  userId: string
  igrejaId: string
  role: string
}

/**
 * Quem registra supervisão numa rede: a direção da igreja e o supervisor
 * daquela rede — ninguém mais. É a mesma regra da função `supervisiona_rede`
 * que governa a RLS; esta cópia serve para recusar cedo, com mensagem legível.
 */
async function permissaoNaRede(redeId: string): Promise<Permissao | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('igreja_id, role')
    .eq('id', user.id)
    .single()
  if (!profile) return null

  const admin = createAdminClient()

  // A rede precisa ser da igreja de quem chama, senão pastor de uma igreja
  // registraria supervisão na rede de outra.
  const { data: rede } = await admin
    .from('redes')
    .select('igreja_id')
    .eq('id', redeId)
    .maybeSingle()
  if (!rede || rede.igreja_id !== profile.igreja_id) return null

  const base = { userId: user.id, igrejaId: profile.igreja_id, role: profile.role }

  if (profile.role === 'pastor' || profile.role === 'admin') return base

  if (profile.role === 'supervisor' || profile.role === 'supervisor_treinamento') {
    const { data: vinculo } = await admin
      .from('rede_supervisores')
      .select('supervisor_id')
      .eq('rede_id', redeId)
      .eq('supervisor_id', user.id)
      .maybeSingle()
    if (vinculo) return base
  }

  return null
}

export async function registrarSupervisaoAction(
  dados: DadosSupervisao
): Promise<{ ok: true; id: string } | { ok: false; erro: string }> {
  const permissao = await permissaoNaRede(dados.redeId)
  if (!permissao) return { ok: false, erro: 'Sem permissão para esta rede.' }
  if (!dados.data) return { ok: false, erro: 'Informe a data da reunião.' }

  const admin = createAdminClient()

  // Célula informada tem de pertencer à rede: uma reunião pendurada na célula
  // errada estragaria o indicador das duas.
  if (dados.celulaId) {
    const { data: celula } = await admin
      .from('celulas')
      .select('rede_id')
      .eq('id', dados.celulaId)
      .maybeSingle()
    if (!celula || celula.rede_id !== dados.redeId) {
      return { ok: false, erro: 'Esta célula não é da rede escolhida.' }
    }
  }

  const { data: criada, error } = await admin
    .from('supervisoes')
    .insert({
      rede_id: dados.redeId,
      celula_id: dados.celulaId,
      supervisor_id: permissao.userId,
      data: dados.data,
      pauta: dados.pauta?.trim() || null,
      encaminhamentos: dados.encaminhamentos?.trim() || null,
      criado_por: permissao.userId,
    })
    .select('id')
    .single()

  if (error || !criada) return { ok: false, erro: error?.message ?? 'Não foi possível registrar.' }

  if (dados.participantes.length > 0) {
    const { error: erroPart } = await admin.from('supervisao_participantes').insert(
      dados.participantes.map((p) => ({
        supervisao_id: criada.id,
        user_id: p.userId,
        presente: p.presente,
      }))
    )
    // A reunião já está gravada; perder a lista de presença não justifica
    // apagá-la, mas quem registrou precisa saber para lançar de novo.
    if (erroPart) {
      return { ok: false, erro: `Reunião registrada, mas a lista de presença falhou: ${erroPart.message}` }
    }
  }

  revalidatePath('/supervisor')
  revalidatePath('/pastor')
  revalidatePath(`/rede/${dados.redeId}`)
  if (dados.celulaId) revalidatePath(`/celula/${dados.celulaId}`)

  return { ok: true, id: criada.id }
}

export async function excluirSupervisaoAction(
  id: string
): Promise<{ ok: boolean; erro?: string }> {
  const admin = createAdminClient()

  const { data: sup } = await admin
    .from('supervisoes')
    .select('rede_id, celula_id')
    .eq('id', id)
    .maybeSingle()
  if (!sup) return { ok: false, erro: 'Registro não encontrado.' }

  const permissao = await permissaoNaRede(sup.rede_id)
  if (!permissao) return { ok: false, erro: 'Sem permissão para esta rede.' }

  const { error } = await admin.from('supervisoes').delete().eq('id', id)
  if (error) return { ok: false, erro: error.message }

  revalidatePath('/supervisor')
  revalidatePath('/pastor')
  revalidatePath(`/rede/${sup.rede_id}`)
  if (sup.celula_id) revalidatePath(`/celula/${sup.celula_id}`)

  return { ok: true }
}

export interface ParticipanteSugerido {
  id: string
  nome: string
  avatarUrl: string | null
  /** Verdadeiro para quem lidera a célula da reunião. */
  lider: boolean
}

/**
 * Quem provavelmente estará na reunião.
 *
 * Com célula escolhida, são os líderes dela — que é quem o supervisor senta
 * para ouvir. Sem célula, a reunião é da rede: entram os líderes de todas as
 * células dela.
 */
export async function sugerirParticipantesAction(
  redeId: string,
  celulaId: string | null
): Promise<ParticipanteSugerido[]> {
  const permissao = await permissaoNaRede(redeId)
  if (!permissao) return []

  const admin = createAdminClient()

  let celulaIds: string[]
  if (celulaId) {
    celulaIds = [celulaId]
  } else {
    const { data: celulas } = await admin
      .from('celulas')
      .select('id')
      .eq('rede_id', redeId)
      .neq('ativa', false)
    celulaIds = ((celulas ?? []) as { id: string }[]).map((c) => c.id)
  }
  if (celulaIds.length === 0) return []

  const { data } = await admin
    .from('celula_membros')
    .select('user_id, papel, profiles(nome, avatar_url)')
    .in('celula_id', celulaIds)
    .eq('papel', 'lider')

  const linhas = (data ?? []) as unknown as {
    user_id: string
    papel: string
    profiles: { nome: string; avatar_url: string | null } | null
  }[]

  // Um líder pode estar em mais de uma célula da rede; a reunião o convoca uma
  // vez só.
  const porId = new Map<string, ParticipanteSugerido>()
  for (const l of linhas) {
    if (!l.profiles || porId.has(l.user_id)) continue
    porId.set(l.user_id, {
      id: l.user_id,
      nome: l.profiles.nome,
      avatarUrl: l.profiles.avatar_url,
      lider: true,
    })
  }

  return [...porId.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}
