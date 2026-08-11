/**
 * Saúde da rede — o que o supervisor precisa saber antes de abrir célula por
 * célula.
 *
 * Duas leituras, dos mesmos dados:
 *
 * - **onde olhar primeiro**: a célula que parou de registrar encontro. Não é
 *   acusação de célula parada — é sinal de que ninguém sabe se ela parou, que
 *   é justamente o problema;
 * - **para onde a rede está indo**: a presença ao longo do tempo, comparável
 *   entre semanas, meses e anos.
 *
 * A contagem acontece no Postgres (`saude_celulas` e `presenca_serie`,
 * `supabase/migrations/saude_rede.sql`). Aqui só se dá nome às coisas.
 */

import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Semanas sem encontro registrado a partir das quais a célula acende o alerta.
 *
 * Três, e não duas, porque célula quinzenal registra a cada duas semanas por
 * definição — duas semanas de silêncio é o funcionamento normal dela.
 */
export const SEMANAS_ALERTA = 3

/** Dias sem reunião de supervisão a partir dos quais o líder aparece na lista. */
export const DIAS_SEM_SUPERVISAO_ALERTA = 60

const MS_POR_SEMANA = 7 * 24 * 60 * 60 * 1000
const MS_POR_DIA = 24 * 60 * 60 * 1000

export interface CelulaSaude {
  id: string
  nome: string
  redeId: string
  redeNome: string
  redeCor: string
  liderNome: string | null
  liderTelefone: string | null
  /** Último encontro marcado como realizado. `null` = nunca registrou nenhum. */
  ultimoEncontro: string | null
  /** `null` quando a célula nunca registrou encontro. */
  semanasSemRegistro: number | null
  /** Encontros realizados nos últimos 90 dias. */
  encontros90d: number
  /** Média de pessoas por encontro nos últimos 90 dias (membros + cônjuges + visitantes). */
  mediaPresenca: number | null
  ultimaSupervisao: string | null
  diasSemSupervisao: number | null
  multiplicacaoPrevista: string | null
  /** Nunca registrou, ou parou de registrar há mais de `SEMANAS_ALERTA`. */
  inatingivel: boolean
}

export interface PontoSerie {
  /** Primeiro dia do período, em ISO (`2026-08-10`). */
  inicio: string
  encontros: number
  membros: number
  conjuges: number
  visitantes: number
  /** Membros + cônjuges + visitantes. É este número que a barra desenha. */
  total: number
}

export type Granularidade = 'semana' | 'mes' | 'ano'

export interface SaudeDaRede {
  celulas: CelulaSaude[]
  serie: PontoSerie[]
  /** Células que pararam de registrar, da mais silenciosa para a menos. */
  inatingiveis: CelulaSaude[]
  /** Células sem reunião de supervisão registrada há tempo demais. */
  semSupervisao: CelulaSaude[]
  /** Células com multiplicação prevista para os próximos 90 dias ou já vencida. */
  multiplicandoEmBreve: CelulaSaude[]
}

/** Quantos períodos a série traz, por granularidade. */
const PERIODOS: Record<Granularidade, number> = {
  semana: 12,
  mes: 12,
  ano: 5,
}

type SaudeRpcRow = {
  celula_id: string
  ultimo_encontro: string | null
  encontros_90d: number
  media_presenca: number | string | null
  ultima_supervisao: string | null
}

type SerieRpcRow = {
  inicio: string
  encontros: number
  membros: number
  conjuges: number
  visitantes: number
}

type CelulaRow = {
  id: string
  nome: string
  rede_id: string
  lider_nome: string | null
  multiplicacao_prevista: string | null
}

type RedeRow = { id: string; nome: string; cor: string | null }

/**
 * Carrega o painel de saúde das redes informadas.
 *
 * Quem chama já resolveu quais redes a pessoa enxerga — esta função confia no
 * recorte que recebe e não refaz a checagem de cargo.
 */
export async function carregarSaudeRede(
  redeIds: string[],
  granularidade: Granularidade = 'semana',
): Promise<SaudeDaRede> {
  const vazio: SaudeDaRede = {
    celulas: [], serie: [], inatingiveis: [], semSupervisao: [], multiplicandoEmBreve: [],
  }
  if (redeIds.length === 0) return vazio

  const admin = createAdminClient()

  const [{ data: celulasData }, { data: redesData }] = await Promise.all([
    admin
      .from('celulas')
      .select('id, nome, rede_id, lider_nome, multiplicacao_prevista')
      .in('rede_id', redeIds)
      .neq('ativa', false),
    admin.from('redes').select('id, nome, cor').in('id', redeIds),
  ])

  const celulas = (celulasData ?? []) as CelulaRow[]
  if (celulas.length === 0) return vazio

  const celulaIds = celulas.map((c) => c.id)
  const redePorId = new Map(
    ((redesData ?? []) as RedeRow[]).map((r) => [r.id, r]),
  )

  const [{ data: saudeData }, { data: serieData }, { data: lideresData }] = await Promise.all([
    admin.rpc('saude_celulas', { p_celula_ids: celulaIds }),
    admin.rpc('presenca_serie', {
      p_celula_ids: celulaIds,
      p_granularidade: granularidade,
      p_periodos: PERIODOS[granularidade],
    }),
    // O nome do líder pode vir do texto solto em `celulas.lider_nome` (célula
    // importada da planilha) ou do vínculo real. O vínculo ganha, e é o único
    // que traz telefone para o botão do WhatsApp.
    admin
      .from('celula_membros')
      .select('celula_id, profiles(nome, telefone)')
      .in('celula_id', celulaIds)
      .eq('papel', 'lider'),
  ])

  const saudePorCelula = new Map(
    ((saudeData ?? []) as SaudeRpcRow[]).map((s) => [s.celula_id, s]),
  )

  const liderPorCelula = new Map(
    ((lideresData ?? []) as unknown as {
      celula_id: string
      profiles: { nome: string; telefone: string | null } | null
    }[])
      .filter((l) => l.profiles)
      .map((l) => [l.celula_id, l.profiles!]),
  )

  const agora = Date.now()

  const lista: CelulaSaude[] = celulas.map((c) => {
    const s = saudePorCelula.get(c.id)
    const rede = redePorId.get(c.rede_id)
    const lider = liderPorCelula.get(c.id)

    const ultimoEncontro = s?.ultimo_encontro ?? null
    const semanasSemRegistro = ultimoEncontro
      ? Math.floor((agora - new Date(ultimoEncontro).getTime()) / MS_POR_SEMANA)
      : null

    const ultimaSupervisao = s?.ultima_supervisao ?? null
    const diasSemSupervisao = ultimaSupervisao
      ? Math.floor((agora - new Date(`${ultimaSupervisao}T12:00:00`).getTime()) / MS_POR_DIA)
      : null

    return {
      id: c.id,
      nome: c.nome,
      redeId: c.rede_id,
      redeNome: rede?.nome ?? '',
      redeCor: rede?.cor ?? '#6366f1',
      liderNome: lider?.nome ?? c.lider_nome,
      liderTelefone: lider?.telefone ?? null,
      ultimoEncontro,
      semanasSemRegistro,
      encontros90d: Number(s?.encontros_90d ?? 0),
      mediaPresenca: s?.media_presenca == null ? null : Number(s.media_presenca),
      ultimaSupervisao,
      diasSemSupervisao,
      multiplicacaoPrevista: c.multiplicacao_prevista,
      // Nunca registrou também é alerta: é o líder que nunca começou.
      inatingivel: semanasSemRegistro === null || semanasSemRegistro >= SEMANAS_ALERTA,
    }
  })

  const serie: PontoSerie[] = ((serieData ?? []) as SerieRpcRow[]).map((p) => {
    const membros = Number(p.membros)
    const conjuges = Number(p.conjuges)
    const visitantes = Number(p.visitantes)
    return {
      inicio: p.inicio,
      encontros: Number(p.encontros),
      membros,
      conjuges,
      visitantes,
      total: membros + conjuges + visitantes,
    }
  })

  // Silêncio mais longo primeiro; quem nunca registrou encabeça a lista.
  const inatingiveis = lista
    .filter((c) => c.inatingivel)
    .sort((a, b) => (b.semanasSemRegistro ?? 9999) - (a.semanasSemRegistro ?? 9999))

  const semSupervisao = lista
    .filter((c) => c.diasSemSupervisao === null || c.diasSemSupervisao >= DIAS_SEM_SUPERVISAO_ALERTA)
    .sort((a, b) => (b.diasSemSupervisao ?? 9999) - (a.diasSemSupervisao ?? 9999))

  const limite = new Date(agora + 90 * MS_POR_DIA).toISOString().slice(0, 10)
  const multiplicandoEmBreve = lista
    .filter((c) => c.multiplicacaoPrevista && c.multiplicacaoPrevista <= limite)
    .sort((a, b) => (a.multiplicacaoPrevista ?? '').localeCompare(b.multiplicacaoPrevista ?? ''))

  return { celulas: lista, serie, inatingiveis, semSupervisao, multiplicandoEmBreve }
}

/**
 * Variação percentual entre o último período fechado e o anterior.
 *
 * O período corrente fica de fora do cálculo de propósito: comparar uma semana
 * pela metade com uma semana inteira sempre acusa queda.
 *
 * Devolve `null` quando não há dois períodos fechados para comparar, ou quando
 * o anterior foi zero — variação a partir de zero não tem percentual honesto.
 */
export function variacao(serie: PontoSerie[]): number | null {
  if (serie.length < 3) return null
  const anterior = serie[serie.length - 3]
  const ultimo = serie[serie.length - 2]
  if (!anterior || anterior.total === 0) return null
  return Math.round(((ultimo.total - anterior.total) / anterior.total) * 100)
}

/** Rótulo curto do eixo, conforme a granularidade. */
export function rotuloPeriodo(inicio: string, granularidade: Granularidade): string {
  // `inicio` vem como data pura; o meio-dia evita que o fuso puxe para o dia anterior.
  const d = new Date(`${inicio}T12:00:00`)
  if (granularidade === 'ano') return String(d.getFullYear())
  if (granularidade === 'mes') {
    return d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')
  }
  return `${d.getDate()}/${d.getMonth() + 1}`
}
