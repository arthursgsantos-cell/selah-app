/**
 * Consolidação — leitura no banco.
 *
 * Separado de `lib/consolidacao.ts` por uma razão prática: aqui dentro se usa
 * `next/headers` (para ler a sessão) e a service role, e nenhum dos dois
 * sobrevive num bundle de navegador. Os componentes de cliente importam só a
 * outra metade — rótulos, tipos e contas puras.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import {
  diasAte, estaEsfriando,
  type AcessoConsolidacao, type FichaConsolidacao,
} from '@/lib/consolidacao'
import type {
  CanalContato, DecisaoConsolidacao, EtapaConsolidacao, OrigemConsolidacao,
  ResultadoContato,
} from '@/lib/supabase/types'

/**
 * Quem enxerga o quê.
 *
 * Ficha de consolidação carrega telefone e situação espiritual de alguém que
 * nem conta tem — não é lista aberta à igreja inteira. Enxerga quem tem o
 * vínculo: a direção (tudo), o supervisor (as células das redes dele), o líder
 * (a célula dele) e quem foi posto como responsável (as suas).
 *
 * É a cópia em TypeScript da função `consolidacao_pode` que governa a RLS
 * (`supabase/migrations/consolidacao.sql`). Serve para montar a consulta e
 * decidir o que desenhar; quem recusa de verdade é o banco.
 */
export async function acessoConsolidacao(): Promise<AcessoConsolidacao | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('igreja_id, role')
    .eq('id', user.id)
    .single()
  if (!profile) return null

  const role = profile.role
  const direcao = role === 'pastor' || role === 'admin'
  const podeAcolher = direcao || [
    'lider', 'lider_treinamento', 'supervisor', 'supervisor_treinamento',
  ].includes(role)

  const base = { userId: user.id, igrejaId: profile.igreja_id, role, direcao, podeAcolher }
  if (direcao) return { ...base, celulaIds: [] }

  const admin = createAdminClient()
  const celulaIds = new Set<string>()

  // Células que a pessoa lidera.
  const { data: lideradas } = await admin
    .from('celula_membros')
    .select('celula_id')
    .eq('user_id', user.id)
    .eq('papel', 'lider')
  for (const c of (lideradas ?? []) as { celula_id: string }[]) celulaIds.add(c.celula_id)

  // Células das redes que a pessoa supervisiona.
  if (role.startsWith('supervisor')) {
    const { data: redes } = await admin
      .from('rede_supervisores')
      .select('rede_id')
      .eq('supervisor_id', user.id)
    const redeIds = (redes ?? []).map((r) => (r as { rede_id: string }).rede_id)
    if (redeIds.length > 0) {
      const { data: celulas } = await admin
        .from('celulas')
        .select('id')
        .in('rede_id', redeIds)
      for (const c of (celulas ?? []) as { id: string }[]) celulaIds.add(c.id)
    }
  }

  return { ...base, celulaIds: [...celulaIds] }
}

/**
 * Carrega as fichas que a pessoa enxerga, já com contatos e o cálculo de
 * silêncio.
 *
 * Traz as fichas inteiras em vez de paginar no banco porque o volume é humano:
 * são as pessoas que chegaram à igreja, não um log. Uma igreja grande fecha o
 * ano na casa das centenas, e o filtro por etapa acontece na tela.
 */
export async function carregarFichas(
  acesso: AcessoConsolidacao
): Promise<FichaConsolidacao[]> {
  const admin = createAdminClient()

  let consulta = admin
    .from('consolidacao')
    .select('id, nome, telefone, origem, decisao, etapa, observacao, data_acolhimento, celula_id, responsavel_id, celulas(nome)')
    .eq('igreja_id', acesso.igrejaId)
    .order('data_acolhimento', { ascending: false })

  if (!acesso.direcao) {
    // Responsável pela ficha OU líder/supervisor da célula de destino. Sem
    // nenhum dos dois vínculos, a ficha não aparece.
    const condicoes = [`responsavel_id.eq.${acesso.userId}`]
    if (acesso.celulaIds.length > 0) {
      condicoes.push(`celula_id.in.(${acesso.celulaIds.join(',')})`)
    }
    consulta = consulta.or(condicoes.join(','))
  }

  const { data } = await consulta

  const linhas = (data ?? []) as unknown as {
    id: string; nome: string; telefone: string | null
    origem: OrigemConsolidacao; decisao: DecisaoConsolidacao | null
    etapa: EtapaConsolidacao; observacao: string | null
    data_acolhimento: string; celula_id: string | null; responsavel_id: string | null
    celulas: { nome: string } | null
  }[]

  if (linhas.length === 0) return []

  const ids = linhas.map((f) => f.id)
  const responsavelIds = [...new Set(linhas.map((f) => f.responsavel_id).filter(Boolean))] as string[]

  const [{ data: contatosData }, { data: responsaveisData }] = await Promise.all([
    admin
      .from('consolidacao_contatos')
      .select('id, consolidacao_id, canal, resultado, nota, data, autor_id')
      .in('consolidacao_id', ids)
      .order('data', { ascending: false }),
    responsavelIds.length > 0
      ? admin.from('profiles').select('id, nome').in('id', responsavelIds)
      : Promise.resolve({ data: [] }),
  ])

  const contatos = (contatosData ?? []) as {
    id: string; consolidacao_id: string; canal: CanalContato
    resultado: ResultadoContato; nota: string | null; data: string; autor_id: string | null
  }[]

  // Nomes dos autores dos contatos entram na mesma tabela de nomes: o autor
  // costuma ser o próprio responsável, mas nem sempre.
  const autorIds = [...new Set(contatos.map((c) => c.autor_id).filter(Boolean))] as string[]
  const faltando = autorIds.filter((id) => !responsavelIds.includes(id))
  const { data: autoresData } = faltando.length > 0
    ? await admin.from('profiles').select('id, nome').in('id', faltando)
    : { data: [] }

  const nomePorId = new Map(
    [
      ...((responsaveisData ?? []) as { id: string; nome: string }[]),
      ...((autoresData ?? []) as { id: string; nome: string }[]),
    ].map((p) => [p.id, p.nome])
  )

  return linhas.map((f) => {
    const meus = contatos
      .filter((c) => c.consolidacao_id === f.id)
      .map((c) => ({
        id: c.id,
        canal: c.canal,
        resultado: c.resultado,
        nota: c.nota,
        data: c.data,
        autorNome: c.autor_id ? nomePorId.get(c.autor_id) ?? null : null,
      }))

    // A lista já vem da mais recente para a mais antiga.
    const ultimo = meus[0] ?? null
    const diasSemContato = ultimo ? diasAte(ultimo.data) : null
    const diasDesdeAcolhimento = diasAte(f.data_acolhimento)

    return {
      id: f.id,
      nome: f.nome,
      telefone: f.telefone,
      origem: f.origem,
      decisao: f.decisao,
      etapa: f.etapa,
      observacao: f.observacao,
      dataAcolhimento: f.data_acolhimento,
      celulaId: f.celula_id,
      celulaNome: f.celulas?.nome ?? null,
      responsavelId: f.responsavel_id,
      responsavelNome: f.responsavel_id ? nomePorId.get(f.responsavel_id) ?? null : null,
      contatos: meus,
      diasSemContato,
      diasDesdeAcolhimento,
      esfriando: estaEsfriando(f.etapa, diasSemContato, diasDesdeAcolhimento),
    }
  })
}
