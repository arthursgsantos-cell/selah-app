/**
 * Frequência dos irmãos — quem parou de ir para a célula.
 *
 * O painel de saúde da rede responde por célula: quantas pessoas, quantos
 * encontros, qual célula silenciou. Nenhuma dessas contas diz o nome de quem
 * sumiu, e é esse nome que a supervisão precisa para agir: uma célula com
 * média estável pode ter trocado três irmãos por três visitantes sem que
 * número nenhum piscasse.
 *
 * A conta acontece no Postgres (`frequencia_irmaos`,
 * `supabase/migrations/chamada_encontro.sql`), sobre a chamada que o líder faz
 * no encontro. Aqui só se dá nome às coisas e se decide o que é alerta.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import type { CelulaSaude } from '@/lib/saude-rede'

/**
 * Faltas seguidas a partir das quais o irmão aparece na lista.
 *
 * Três, e não duas: falta de uma semana é vida — viagem, plantão, gripe. Três
 * encontros seguidos sem aparecer já é o padrão de quem está se afastando, e é
 * cedo o bastante para uma ligação resolver.
 */
export const FALTAS_SEGUIDAS_ALERTA = 3

/** Janela padrão da conta, em dias. Um trimestre de encontros. */
export const JANELA_PADRAO_DIAS = 90

export interface IrmaoFrequencia {
  /** `u:<uuid>` ou `p:<uuid>` — a mesma chave que a chamada usa. */
  chave: string
  nome: string
  avatarUrl: string | null
  /** Está na célula mas ainda não criou conta no app. */
  semConta: boolean
  celulaId: string
  celulaNome: string
  redeNome: string
  redeCor: string
  liderNome: string | null
  liderTelefone: string | null
  /** Encontros com chamada feita na janela, na célula dele. */
  encontros: number
  presencas: number
  /** 0 a 100. */
  frequencia: number
  ultimaPresenca: string | null
  faltasSeguidas: number
}

export interface FrequenciaDaRede {
  /** Células que já fizeram ao menos uma chamada na janela. */
  celulasComChamada: number
  /** Total de células olhadas — dá a escala de quanto disso ainda é chute. */
  celulasOlhadas: number
  irmaos: IrmaoFrequencia[]
  /** Quem está há `FALTAS_SEGUIDAS_ALERTA` encontros ou mais sem aparecer. */
  sumindo: IrmaoFrequencia[]
  /** Média das frequências individuais, 0 a 100. `null` sem dado nenhum. */
  frequenciaMedia: number | null
}

type RpcRow = {
  celula_id: string
  user_id: string | null
  pre_cadastro_id: string | null
  nome: string
  avatar_url: string | null
  encontros: number | string
  presencas: number | string
  ultima_presenca: string | null
  faltas_seguidas: number | string
}

type CelulaCabecalho = Pick<
  CelulaSaude,
  'id' | 'nome' | 'redeNome' | 'redeCor' | 'liderNome' | 'liderTelefone'
>

/**
 * Carrega a frequência das células informadas.
 *
 * Recebe as células já resolvidas em vez de ir buscá-las: quem chama acabou de
 * carregar a saúde da rede, que traz nome, cor e líder de cada uma. Repetir a
 * consulta aqui seria pagar duas vezes pela mesma resposta.
 */
export async function carregarFrequenciaIrmaos(
  celulas: CelulaCabecalho[],
  janelaDias = JANELA_PADRAO_DIAS,
): Promise<FrequenciaDaRede> {
  const vazio: FrequenciaDaRede = {
    celulasComChamada: 0,
    celulasOlhadas: celulas.length,
    irmaos: [],
    sumindo: [],
    frequenciaMedia: null,
  }
  if (celulas.length === 0) return vazio

  const admin = createAdminClient()
  const desde = new Date(Date.now() - janelaDias * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)

  const { data } = await admin.rpc('frequencia_irmaos', {
    p_celula_ids: celulas.map((c) => c.id),
    p_desde: desde,
  })

  const porCelula = new Map(celulas.map((c) => [c.id, c]))

  const irmaos: IrmaoFrequencia[] = ((data ?? []) as RpcRow[])
    // Encontro nenhum com chamada = nada a dizer sobre essa pessoa. Mostrar
    // "0%" aqui seria acusar o irmão de uma falta que ninguém registrou.
    .filter((r) => Number(r.encontros) > 0)
    .map((r) => {
      const celula = porCelula.get(r.celula_id)
      const encontros = Number(r.encontros)
      const presencas = Number(r.presencas)
      return {
        chave: r.user_id ? `u:${r.user_id}` : `p:${r.pre_cadastro_id}`,
        nome: r.nome,
        avatarUrl: r.avatar_url,
        semConta: !r.user_id,
        celulaId: r.celula_id,
        celulaNome: celula?.nome ?? '',
        redeNome: celula?.redeNome ?? '',
        redeCor: celula?.redeCor ?? '#6366f1',
        liderNome: celula?.liderNome ?? null,
        liderTelefone: celula?.liderTelefone ?? null,
        encontros,
        presencas,
        frequencia: Math.round((presencas / encontros) * 100),
        ultimaPresenca: r.ultima_presenca,
        faltasSeguidas: Number(r.faltas_seguidas),
      }
    })

  if (irmaos.length === 0) return vazio

  // Mais faltas seguidas primeiro; empate desempata por frequência mais baixa,
  // e depois por nome, para a lista não dançar entre um carregamento e outro.
  const sumindo = irmaos
    .filter((i) => i.faltasSeguidas >= FALTAS_SEGUIDAS_ALERTA)
    .sort(
      (a, b) =>
        b.faltasSeguidas - a.faltasSeguidas ||
        a.frequencia - b.frequencia ||
        a.nome.localeCompare(b.nome, 'pt-BR'),
    )

  return {
    celulasComChamada: new Set(irmaos.map((i) => i.celulaId)).size,
    celulasOlhadas: celulas.length,
    irmaos: irmaos.sort(
      (a, b) => a.frequencia - b.frequencia || a.nome.localeCompare(b.nome, 'pt-BR'),
    ),
    sumindo,
    frequenciaMedia: Math.round(
      irmaos.reduce((acc, i) => acc + i.frequencia, 0) / irmaos.length,
    ),
  }
}

/** "há 3 encontros", "nunca apareceu" — o rótulo da linha de alerta. */
export function rotuloAusencia(irmao: IrmaoFrequencia): string {
  if (irmao.presencas === 0) {
    return irmao.encontros === 1
      ? 'não veio ao único encontro registrado'
      : `não veio a nenhum dos ${irmao.encontros} encontros`
  }
  return `${irmao.faltasSeguidas} ${irmao.faltasSeguidas === 1 ? 'encontro' : 'encontros'} seguidos sem vir`
}
