/**
 * Normalização de textos vindos da planilha.
 *
 * `normalizarNome` é o espelho em TypeScript de `public.normalizar_nome(text)`:
 * minúsculas, sem acento, sem espaços nas pontas. Os dois precisam concordar,
 * senão a resolução de célula por apelido dá resultados diferentes no banco e
 * no código.
 */
import { normalizarHorario } from '@/lib/dia-semana'

const ACENTOS = /[̀-ͯ]/g

export function normalizarNome(valor: string): string {
  return valor.normalize('NFD').replace(ACENTOS, '').toLowerCase().trim()
}

/** "1º Retiro da Rede One" → "1-retiro-da-rede-one" */
export function slug(valor: string): string {
  return normalizarNome(valor)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** "2026-07-26 16:35:40" ou "26/07/2026" → "2026-07-26" */
export function normalizarData(valor: string): string {
  const br = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(valor.trim())
  if (br) return `${br[3]}-${br[2]}-${br[1]}`
  const iso = /^(\d{4}-\d{2}-\d{2})/.exec(valor.trim())
  if (iso) return iso[1]
  return new Date().toISOString().split('T')[0]
}

/** A planilha é escrita no fuso de Brasília; o banco guarda timestamptz. */
const FUSO_BRASILIA = '-03:00'

/**
 * "30/07/2026 21:57" → "2026-07-30T21:57:00-03:00".
 * Sem data reconhecível, devolve o instante atual — a data de publicação só
 * serve para ordenar a galeria, nunca é chave de nada.
 */
export function dataHoraPublicacao(valor: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})(?:[\s,]+(\d{1,2}):(\d{2}))?/.exec(valor.trim())
  if (!m) return new Date().toISOString()
  const hora = (m[4] ?? '00').padStart(2, '0')
  const minuto = m[5] ?? '00'
  return `${m[3]}-${m[2]}-${m[1]}T${hora}:${minuto}:00${FUSO_BRASILIA}`
}

/**
 * Data e hora de um encontro de célula, a partir das colunas separadas que a
 * planilha usa ("Data do encontro" e "Horário").
 *
 * "08/08/2026" + "08:30" → "2026-08-08T08:30:00-03:00".
 *
 * Devolve `null` quando a data não é legível — a linha vira pendência em vez de
 * criar encontro em dia inventado. O horário, esse sim, tem reserva: sem ele
 * vale o horário fixo da célula.
 */
export function dataHoraEncontro(
  data: string,
  horario: string,
  horarioPadrao: string | null
): string | null {
  const br = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(data.trim())
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(data.trim())
  if (!br && !iso) return null

  const dia = br ? `${br[3]}-${br[2]}-${br[1]}` : `${iso![1]}-${iso![2]}-${iso![3]}`
  const hora = normalizarHorario(horario) || normalizarHorario(horarioPadrao) || '19:00'

  return `${dia}T${hora}:00${FUSO_BRASILIA}`
}

export type PeriodoEvento = {
  /** ISO com fuso, pronto para `eventos.data_hora` */
  inicio: string
  /** Só quando a planilha descreve um intervalo ("20 e 21/11/2026") */
  fim: string | null
  /** true quando a planilha não trouxe horário e usamos o padrão */
  horaPresumida: boolean
}

/**
 * Horário usado quando a planilha só traz a data. Eventos da igreja são à
 * noite; deixar 00:00 apareceria como "às 00:00" na tela do app.
 */
const HORA_PADRAO = { hora: 19, minuto: 0 }

function iso(ano: number, mes: number, dia: number, hora: number, minuto: number): string {
  const p = (n: number, casas = 2) => String(n).padStart(casas, '0')
  return `${p(ano, 4)}-${p(mes)}-${p(dia)}T${p(hora)}:${p(minuto)}:00${FUSO_BRASILIA}`
}

/**
 * Lê a coluna "Data do evento", preenchida à mão e por isso em formatos
 * variados. Reconhece:
 *
 *   20/11/2026            → um dia
 *   20/11/2026 19:30      → um dia com hora
 *   20 e 21/11/2026       → intervalo (o dia solto herda mês/ano do completo)
 *   20 a 22/11/2026       → idem
 *   2026-11-20            → ISO
 *
 * Devolve `null` quando não encontra nenhuma data completa — a linha vira
 * pendência em vez de entrar no banco com data inventada.
 */
export function parsePeriodoEvento(valor: string): PeriodoEvento | null {
  const texto = valor.trim()
  if (!texto) return null

  const hora = extrairHora(texto)
  // O horário sai do texto antes da varredura de datas: "19:30" viraria dois
  // dias soltos ("19" e "30") e estragaria o fim do intervalo.
  const semHora = hora ? texto.replace(hora.trecho, ' ') : texto
  const { hora: h, minuto: min } = hora ?? HORA_PADRAO

  const isoMatch = /(\d{4})-(\d{1,2})-(\d{1,2})/.exec(semHora)
  if (isoMatch) {
    return {
      inicio: iso(+isoMatch[1], +isoMatch[2], +isoMatch[3], h, min),
      fim: null,
      horaPresumida: hora === null,
    }
  }

  // Cada parte é "dia", "dia/mês" ou "dia/mês/ano". Partes incompletas herdam
  // o que falta da primeira parte completa — é assim que "20 e 21/11/2026" faz
  // sentido para quem escreveu.
  const partes = [...semHora.matchAll(/(\d{1,2})(?:\/(\d{1,2})(?:\/(\d{2,4}))?)?/g)]
    .map((m) => ({
      dia: +m[1],
      mes: m[2] ? +m[2] : null,
      ano: m[3] ? ajustarAno(+m[3]) : null,
    }))
    .filter((p) => p.dia >= 1 && p.dia <= 31)

  const completa = partes.find((p) => p.mes !== null && p.ano !== null)
  if (!completa) return null

  const datas = partes
    .map((p) => ({ dia: p.dia, mes: p.mes ?? completa.mes!, ano: p.ano ?? completa.ano! }))
    .filter((p) => p.mes >= 1 && p.mes <= 12)

  if (datas.length === 0) return null

  const primeira = datas[0]
  const ultima = datas[datas.length - 1]
  const mesmoDia =
    primeira.dia === ultima.dia && primeira.mes === ultima.mes && primeira.ano === ultima.ano

  return {
    inicio: iso(primeira.ano, primeira.mes, primeira.dia, h, min),
    fim: mesmoDia ? null : iso(ultima.ano, ultima.mes, ultima.dia, h, min),
    horaPresumida: hora === null,
  }
}

function ajustarAno(ano: number): number {
  return ano < 100 ? 2000 + ano : ano
}

/** "19:30", "19h", "19h30" — o horário é opcional na planilha. */
function extrairHora(texto: string): { hora: number; minuto: number; trecho: string } | null {
  const doisPontos = /(\d{1,2}):(\d{2})/.exec(texto)
  if (doisPontos) {
    return { hora: +doisPontos[1], minuto: +doisPontos[2], trecho: doisPontos[0] }
  }
  const comH = /(\d{1,2})\s*h(?:\s*(\d{2}))?/i.exec(texto)
  if (comH) return { hora: +comH[1], minuto: comH[2] ? +comH[2] : 0, trecho: comH[0] }
  return null
}
