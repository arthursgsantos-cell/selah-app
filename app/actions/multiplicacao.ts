'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { nomeProvisorioDe, MAX_FILHAS } from '@/lib/multiplicacao'

const CARGOS_GESTAO = ['admin', 'pastor', 'supervisor', 'supervisor_treinamento']

export interface FilhaNova {
  /** Vazio = a célula nasce com nome provisório e a árvore passa a pedir o nome. */
  nome?: string
  /** Quem vai liderar, quando já está definido. Texto solto, como na importação. */
  liderNome?: string
}

export interface ResultadoMultiplicacao {
  ok: boolean
  erro?: string
  /** Ids das células criadas, na ordem em que foram informadas. */
  criadas?: string[]
}

/**
 * Registra que uma célula multiplicou.
 *
 * O que era só uma data-alvo vira fato: as filhas entram no banco como células
 * de verdade — página, calendário, galeria, tudo —, já ligadas à mãe pela
 * linhagem e com a rede e a identidade visual herdadas. A mãe perde a
 * data-alvo, porque ela acabou de ser cumprida.
 *
 * Três filhas de uma vez é caso real (célula grande que se divide em três), e
 * por isso a entrada é uma lista e não um par de campos. Nome é opcional: a
 * multiplicação acontece antes do batismo da célula.
 */
export async function registrarMultiplicacaoAction(dados: {
  celulaMaeId: string
  /** Dia em que a multiplicação aconteceu, em ISO (`2026-08-16`). */
  data: string
  filhas: FilhaNova[]
}): Promise<ResultadoMultiplicacao> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, erro: 'Não autenticado.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  // Mesma régua da célula-mãe em `editCelulaAction`: linhagem é estrutural,
  // quem mexe é quem gerencia a rede.
  if (!CARGOS_GESTAO.includes(profile?.role ?? '')) {
    return { ok: false, erro: 'Só a supervisão registra multiplicação.' }
  }

  const filhas = dados.filhas.slice(0, MAX_FILHAS)
  if (filhas.length === 0) return { ok: false, erro: 'Informe ao menos uma célula nova.' }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dados.data)) {
    return { ok: false, erro: 'Data inválida.' }
  }

  const admin = createAdminClient()

  const { data: mae } = await admin
    .from('celulas')
    .select('id, nome, rede_id, cor, cor_secundaria, fundo_tipo, frequencia, dia_semana, horario')
    .eq('id', dados.celulaMaeId)
    .maybeSingle()

  if (!mae) return { ok: false, erro: 'Célula-mãe não encontrada.' }

  const linhas = filhas.map((f, i) => {
    const nome = (f.nome ?? '').trim()
    const semNome = nome.length === 0
    return {
      rede_id: mae.rede_id,
      nome: semNome ? nomeProvisorioDe(mae.nome, i, filhas.length) : nome,
      nome_provisorio: semNome,
      celula_mae_id: mae.id,
      multiplicada_em: dados.data,
      lider_nome: (f.liderNome ?? '').trim() || null,
      // A filha estreia parecida com a mãe: mesma rede, mesmas cores, mesmo
      // ritmo de encontro. É o ponto de partida mais provável, e cada uma
      // muda o que quiser depois na própria página.
      cor: mae.cor,
      cor_secundaria: mae.cor_secundaria,
      fundo_tipo: mae.fundo_tipo,
      frequencia: mae.frequencia,
      dia_semana: mae.dia_semana,
      horario: mae.horario,
      ativa: true,
    }
  })

  const { data: criadas, error } = await admin
    .from('celulas')
    .insert(linhas as never)
    .select('id')

  if (error) return { ok: false, erro: error.message }

  // A data-alvo da mãe já foi cumprida. Deixá-la no lugar faria a célula
  // reaparecer no alerta de multiplicação atrasada no dia seguinte.
  const { error: erroMae } = await admin
    .from('celulas')
    .update({ multiplicacao_prevista: null } as never)
    .eq('id', mae.id)

  if (erroMae) return { ok: false, erro: erroMae.message }

  revalidatePath('/celula')
  revalidatePath(`/celula/${mae.id}`)
  revalidatePath('/supervisor')
  revalidatePath('/pastor')
  revalidatePath(`/rede/${mae.rede_id}`)

  return { ok: true, criadas: ((criadas ?? []) as { id: string }[]).map((c) => c.id) }
}

/**
 * Dá nome à célula que nasceu sem um.
 *
 * Existe separado de `editCelulaAction` porque é um campo só, disparado de
 * dentro da árvore — quem batiza a célula na reunião de supervisão não quer
 * abrir a página dela para isso.
 */
export async function batizarCelulaAction(
  celulaId: string,
  nome: string,
): Promise<{ ok: boolean; erro?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, erro: 'Não autenticado.' }

  const limpo = nome.trim()
  if (limpo.length < 2) return { ok: false, erro: 'Escolha um nome com pelo menos duas letras.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const gestao = CARGOS_GESTAO.includes(profile?.role ?? '')

  if (!gestao) {
    const { data: membro } = await supabase
      .from('celula_membros')
      .select('papel')
      .eq('celula_id', celulaId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (membro?.papel !== 'lider') return { ok: false, erro: 'Sem permissão.' }
  }

  const admin = createAdminClient()
  const { data: celula, error } = await admin
    .from('celulas')
    .update({ nome: limpo, nome_provisorio: false } as never)
    .eq('id', celulaId)
    .select('rede_id')
    .maybeSingle()

  if (error) return { ok: false, erro: error.message }

  revalidatePath('/celula')
  revalidatePath(`/celula/${celulaId}`)
  revalidatePath('/supervisor')
  revalidatePath('/pastor')
  const redeId = (celula as { rede_id: string } | null)?.rede_id
  if (redeId) revalidatePath(`/rede/${redeId}`)

  return { ok: true }
}
