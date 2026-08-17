'use server'

/**
 * Declaração de vínculo — o que a pessoa diz ser na igreja.
 *
 * Quem chega já sabe que é membro há dez anos, que lidera a célula da quarta e
 * que dá aula na Escola Bíblica. Antes o app não perguntava, e alguém da
 * secretaria descobria depois, um por um.
 *
 * Nada do que é declarado vale sozinho: vira uma solicitação pendente que
 * pastor ou admin confirma em /pendencias. É pré-cadastro, não
 * autoatribuição — senão qualquer um entraria como pastor.
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import type { CargoSolicitado, Role } from '@/lib/supabase/types'

export interface DeclaracaoVinculo {
  /** Como a pessoa se apresenta na igreja. */
  vinculo: 'membro' | 'congregado' | 'visitante'
  /** Função que ela diz exercer. `null` = nenhuma além de participar. */
  cargo: CargoSolicitado | null
  /** Célula que ela frequenta, se souber qual. */
  celulaId: string | null
  mensagem: string | null
}

export type ResultadoVinculo = { ok: true } | { ok: false; erro: string }

/**
 * Correções que quem confirma pode fazer antes de aceitar.
 *
 * A declaração é o que a pessoa acha que é; quem confirma sabe o que ela de
 * fato é. Sem isso, recusar era a única saída para um pedido quase certo — um
 * líder que apontou a célula errada voltava para o começo.
 */
export interface AjusteVinculo {
  cargo?: CargoSolicitado
  /** `null` aceita sem colocar em célula nenhuma. */
  celulaId?: string | null
}

/** Cargos que existem em `profiles.role`; os do Ensino moram em `ensino_equipe`. */
const CARGOS_DE_PERFIL: Record<string, Role> = {
  membro: 'membro',
  lider_treinamento: 'lider_treinamento',
  lider: 'lider',
  supervisor_treinamento: 'supervisor_treinamento',
  supervisor: 'supervisor',
  pastor: 'pastor',
  admin: 'admin',
}

export async function declararVinculoAction(
  dados: DeclaracaoVinculo
): Promise<ResultadoVinculo> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, erro: 'Não autenticado.' }

  const { data: perfil } = await supabase
    .from('profiles')
    .select('igreja_id')
    .eq('id', user.id)
    .single()
  if (!perfil) return { ok: false, erro: 'Perfil não encontrado.' }

  const admin = createAdminClient()

  // Uma pendência por vez. A nova substitui a anterior em vez de recusar: quem
  // errou a célula na primeira tentativa não deve ficar preso ao erro até
  // alguém aprovar.
  await admin
    .from('solicitacoes_cargo')
    .delete()
    .eq('user_id', user.id)
    .eq('status', 'pendente')

  const { error } = await admin.from('solicitacoes_cargo').insert({
    user_id: user.id,
    igreja_id: perfil.igreja_id,
    // Sem função declarada, o pedido ainda existe: é ele que leva o vínculo e
    // a célula para a mesa de quem confirma.
    cargo_solicitado: (dados.cargo ?? 'membro') as CargoSolicitado,
    celula_id: dados.celulaId,
    vinculo: dados.vinculo,
    mensagem: dados.mensagem?.trim() || null,
  })
  if (error) return { ok: false, erro: error.message }

  await avisarLideranca(perfil.igreja_id, user.id, dados)

  revalidatePath('/pendencias')
  revalidatePath('/perfil')
  return { ok: true }
}

/**
 * Pastor e admin recebem o aviso no sino, com atalho para /pendencias.
 * Sem isso, a declaração ficaria esperando alguém abrir a tela por acaso.
 */
async function avisarLideranca(
  igrejaId: string,
  userId: string,
  dados: DeclaracaoVinculo
): Promise<void> {
  try {
    const admin = createAdminClient()
    const [{ data: quem }, { data: lideranca }] = await Promise.all([
      admin.from('profiles').select('nome').eq('id', userId).single(),
      admin
        .from('profiles')
        .select('id')
        .eq('igreja_id', igrejaId)
        .in('role', ['pastor', 'admin'])
        .neq('id', userId),
    ])

    const destinatarios = (lideranca ?? []) as { id: string }[]
    if (destinatarios.length === 0) return

    const nome = (quem as { nome: string } | null)?.nome ?? 'Alguém'
    const funcao = dados.cargo ? ` e diz exercer uma função` : ''

    await admin.from('notificacoes').insert(
      destinatarios.map((p) => ({
        igreja_id: igrejaId,
        destinatario_id: p.id,
        tipo: 'solicitacao_cargo',
        titulo: 'Alguém se apresentou',
        mensagem: `${nome} contou como participa da igreja${funcao}. Confirme quando puder.`,
        dados: { href: '/pendencias', profile_id: userId },
      })) as never
    )
  } catch {
    // Aviso é acessório: a declaração já está registrada e aparece em
    // /pendencias de qualquer forma.
  }
}

/**
 * Confirmação por quem tem autoridade: aplica de uma vez o cargo, a entrada na
 * célula e, quando for o caso, a linha na equipe do Ensino.
 */
export async function confirmarVinculoAction(
  solicitacaoId: string,
  acao: 'aprovar' | 'rejeitar',
  ajuste?: AjusteVinculo
): Promise<ResultadoVinculo> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, erro: 'Não autenticado.' }

  const { data: caller } = await supabase
    .from('profiles')
    .select('role, igreja_id')
    .eq('id', user.id)
    .single()
  if (!caller || !['pastor', 'admin'].includes(caller.role)) {
    return { ok: false, erro: 'Só pastor ou administrador confirma vínculo.' }
  }

  const admin = createAdminClient()
  const { data: sol } = await admin
    .from('solicitacoes_cargo')
    .select('user_id, cargo_solicitado, celula_id, igreja_id, status')
    .eq('id', solicitacaoId)
    .maybeSingle()

  const pedido = sol as {
    user_id: string; cargo_solicitado: CargoSolicitado
    celula_id: string | null; igreja_id: string; status: string
  } | null

  if (!pedido || pedido.igreja_id !== caller.igreja_id) {
    return { ok: false, erro: 'Solicitação não encontrada.' }
  }

  // O que sai daqui é a decisão de quem confirma, não mais a declaração: se
  // houve correção, é ela que vale e é ela que fica gravada na linha.
  const cargoFinal = (acao === 'aprovar' && ajuste?.cargo) || pedido.cargo_solicitado
  const celulaFinal =
    acao === 'aprovar' && ajuste?.celulaId !== undefined ? ajuste.celulaId : pedido.celula_id

  const { error: erroStatus } = await admin
    .from('solicitacoes_cargo')
    .update({
      status: acao === 'aprovar' ? 'aprovado' : 'rejeitado',
      cargo_solicitado: cargoFinal,
      celula_id: celulaFinal,
      resolvido_por: user.id,
      resolvido_em: new Date().toISOString(),
    })
    .eq('id', solicitacaoId)
  if (erroStatus) return { ok: false, erro: erroStatus.message }

  if (acao === 'aprovar') {
    const cargoPerfil = CARGOS_DE_PERFIL[cargoFinal]
    if (cargoPerfil) {
      await admin
        .from('profiles')
        .update({ role: cargoPerfil, updated_at: new Date().toISOString() })
        .eq('id', pedido.user_id)
    }

    // Coordenador e professor não são cargo em `profiles`: entram na equipe do
    // Ensino, que é onde as telas do módulo procuram.
    if (cargoFinal === 'ensino_coordenador' || cargoFinal === 'ensino_professor') {
      await admin.from('ensino_equipe').upsert(
        {
          igreja_id: pedido.igreja_id,
          profile_id: pedido.user_id,
          papel: cargoFinal === 'ensino_coordenador' ? 'coordenador' : 'professor',
        } as never,
        { onConflict: 'profile_id' }
      )
    }

    if (celulaFinal) {
      await admin.from('celula_membros').upsert(
        {
          celula_id: celulaFinal,
          user_id: pedido.user_id,
          // Quem foi confirmado como líder entra como líder da célula; o
          // resto entra como membro.
          papel: ['lider', 'lider_treinamento'].includes(cargoFinal) ? 'lider' : 'membro',
        },
        { onConflict: 'celula_id,user_id' }
      )
    }
  }

  revalidatePath('/pendencias')
  revalidatePath('/usuarios')
  revalidatePath('/perfil')
  return { ok: true }
}

/** O que a pessoa já declarou, para a tela de perfil não perguntar de novo. */
export async function minhaDeclaracaoAction(): Promise<{
  status: 'pendente' | 'aprovado' | 'rejeitado'
  cargo: CargoSolicitado
  celulaId: string | null
  vinculo: string | null
} | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('solicitacoes_cargo')
    .select('status, cargo_solicitado, celula_id, vinculo')
    .eq('user_id', user.id)
    .order('criado_em', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) return null
  const d = data as {
    status: 'pendente' | 'aprovado' | 'rejeitado'
    cargo_solicitado: CargoSolicitado
    celula_id: string | null
    vinculo: string | null
  }
  return { status: d.status, cargo: d.cargo_solicitado, celulaId: d.celula_id, vinculo: d.vinculo }
}

/** Células ativas da igreja, para a pessoa apontar a dela. */
export async function celulasParaDeclaracaoAction(): Promise<
  { id: string; nome: string; rede: string | null }[]
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: perfil } = await supabase
    .from('profiles')
    .select('igreja_id')
    .eq('id', user.id)
    .single()
  if (!perfil) return []

  const admin = createAdminClient()
  const { data } = await admin
    .from('celulas')
    .select('id, nome, redes!inner(nome, igreja_id)')
    .eq('ativa', true)
    .eq('redes.igreja_id', perfil.igreja_id)
    .order('nome')

  return ((data ?? []) as unknown as {
    id: string; nome: string; redes: { nome: string } | null
  }[]).map((c) => ({ id: c.id, nome: c.nome, rede: c.redes?.nome ?? null }))
}
