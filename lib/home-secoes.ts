/**
 * Seções da home — as que a liderança reordena, redimensiona e pinta direto na
 * tela, sem abrir painel nenhum.
 *
 * Começou com os quatro cartões institucionais e hoje é a página quase
 * inteira: liderança, dízimo, eventos, célula, aniversariantes, fotos, mapa.
 *
 * Continuam fora, de propósito: a saudação do topo (é a identidade de quem
 * entrou, não um cartão), o aviso de aniversário próprio e o convite de célula
 * (aparecem conforme a situação da pessoa, não conforme a ordem escolhida) e o
 * rodapé.
 */

export const SECAO_IDS = [
  'pastores',
  'contribuir',
  'eventos',
  'proximo_passo',
  'ensino',
  'minha_celula',
  'eventos_igreja',
  'aniversariantes',
  'historico',
  'comunidade',
  'info_igreja',
  'mapa',
] as const

export type SecaoHomeId = (typeof SECAO_IDS)[number]

export const SECAO_LABELS: Record<SecaoHomeId, string> = {
  pastores: 'Liderança',
  contribuir: 'Dízimos e ofertas',
  eventos: 'Próximos eventos',
  proximo_passo: 'Dê o próximo passo',
  ensino: 'Escola Bíblica',
  minha_celula: 'Minha célula',
  eventos_igreja: 'Eventos da igreja',
  aniversariantes: 'Aniversariantes',
  historico: 'Histórico',
  comunidade: 'Nossa comunidade',
  info_igreja: 'Cultos e endereço',
  mapa: 'Mapa',
}

/**
 * Quem tem título próprio para a liderança escrever. Fica de fora o que é
 * lista pura — a agenda de eventos e o histórico se explicam pelo conteúdo, e
 * um título inventado ali só competiria com os nomes dos eventos.
 */
export const SECAO_TEM_TEXTO: Record<SecaoHomeId, boolean> = {
  pastores: false,
  contribuir: true,
  eventos: false,
  proximo_passo: true,
  ensino: true,
  minha_celula: false,
  eventos_igreja: true,
  aniversariantes: true,
  historico: true,
  comunidade: true,
  info_igreja: false,
  mapa: false,
}

export interface TextoSecao {
  titulo?: string | null
  subtitulo?: string | null
}

export type TextosSecoes = Partial<Record<SecaoHomeId, TextoSecao>>

/**
 * Aparência e tamanho de cada cartão na grade da home.
 *
 * A grade tem duas colunas. `largura: 2` ocupa a linha inteira (o padrão, que
 * é como a home sempre foi); `largura: 1` ocupa metade, e dois cartões de
 * metade seguidos ficam lado a lado — que é justamente o que se ganha ao
 * arrastar a alça de tamanho para a esquerda.
 *
 * `estilo` reaproveita os mesmos fundos das páginas de rede e célula
 * (`lib/rede-fundo.ts`), para a home não inventar um vocabulário visual novo:
 * quem já pintou a página da rede sabe o que "nébula" faz.
 */
export type EstiloSecao = 'padrao' | 'cor' | 'gradiente' | 'nebula'

/**
 * Formato do cartão, em proporção — a mesma linguagem de quem monta arte para
 * a igreja: 6:4 é o banner deitado, 9:16 é o story em pé.
 *
 * `padrao` deixa a altura seguir o conteúdo, que é como a home sempre foi.
 * As proporções nunca cortam nada: conteúdo maior que a proporção escolhida
 * continua crescendo, senão a liderança esconderia sem querer o que quis
 * mostrar.
 */
export type AlturaSecao = 'padrao' | 'r64' | 'r916'

export const ALTURA_PROPORCAO: Record<AlturaSecao, string | undefined> = {
  padrao: undefined,
  r64: '6 / 4',
  r916: '9 / 16',
}

export const ALTURA_LABELS: Record<AlturaSecao, string> = {
  padrao: 'Padrão',
  r64: '6:4',
  r916: '9:16',
}

export interface LayoutSecao {
  largura: 1 | 2
  altura: AlturaSecao
  estilo: EstiloSecao
  cor: string | null
  cor2: string | null
  /** `auto` decide pelo brilho da cor de fundo. */
  texto: 'auto' | 'claro' | 'escuro'
}

export type LayoutSecoes = Partial<Record<SecaoHomeId, LayoutSecao>>

export const LAYOUT_PADRAO: LayoutSecao = {
  largura: 2,
  altura: 'padrao',
  estilo: 'padrao',
  cor: null,
  cor2: null,
  texto: 'auto',
}

/** Descarta o que não é layout válido — o jsonb aceita qualquer coisa. */
export function normalizarLayoutSecoes(salvo: unknown): LayoutSecoes {
  const limpo: LayoutSecoes = {}
  if (!salvo || typeof salvo !== 'object') return limpo

  for (const [id, valor] of Object.entries(salvo as Record<string, unknown>)) {
    if (!(SECAO_IDS as readonly string[]).includes(id)) continue
    if (!valor || typeof valor !== 'object') continue
    const v = valor as Record<string, unknown>
    limpo[id as SecaoHomeId] = {
      largura: v.largura === 1 ? 1 : 2,
      altura: v.altura === 'r64' || v.altura === 'r916' ? v.altura : 'padrao',
      estilo: ['cor', 'gradiente', 'nebula'].includes(v.estilo as string)
        ? (v.estilo as EstiloSecao)
        : 'padrao',
      cor: typeof v.cor === 'string' && v.cor ? v.cor : null,
      cor2: typeof v.cor2 === 'string' && v.cor2 ? v.cor2 : null,
      texto: v.texto === 'claro' || v.texto === 'escuro' ? v.texto : 'auto',
    }
  }
  return limpo
}

/**
 * Claro ou escuro sobre a cor de fundo, pela luminância percebida.
 * Sem isso, um cartão azul-marinho ficaria com texto cinza-escuro ilegível.
 */
export function textoClaroSobre(hex: string | null | undefined): boolean {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec((hex ?? '').trim())
  if (!m) return false
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h, 16))
  // Coeficientes de luminância do sRGB.
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.6
}

/**
 * A ordem salva pode vir incompleta ou desatualizada — se a igreja nunca
 * reordenou nada, `home_secoes_ordem` é `null`. Também é o que absorve uma
 * seção nova adicionada no código depois de igrejas já terem salvo uma ordem:
 * ela entra no fim, e não desaparece por não estar na lista salva.
 */
export function normalizarOrdemSecoes(salva: string[] | null | undefined): SecaoHomeId[] {
  const vistos = new Set<SecaoHomeId>()
  const validas: SecaoHomeId[] = []
  for (const id of salva ?? []) {
    // Só ids conhecidos, e cada um uma vez só — um id repetido (banco editado
    // à mão, valor de uma versão antiga) faria o cartão renderizar duas vezes
    // com a mesma `key`.
    if (!(SECAO_IDS as readonly string[]).includes(id) || vistos.has(id as SecaoHomeId)) continue
    vistos.add(id as SecaoHomeId)
    validas.push(id as SecaoHomeId)
  }
  // Cada seção nova entra ao lado de quem é vizinho dela na lista canônica, e
  // não no fim: com a home inteira virando grade, jogar "liderança" e "mapa"
  // no fim mudaria a página de quem nunca reordenou nada — a igreja abriria o
  // app e encontraria tudo fora do lugar.
  const resultado = [...validas]
  for (const id of SECAO_IDS) {
    if (vistos.has(id)) continue
    const posicaoCanonica = SECAO_IDS.indexOf(id)
    // O vizinho de cima: o último id canônico anterior que já está na lista.
    let depoisDe = -1
    for (let i = posicaoCanonica - 1; i >= 0; i--) {
      const indice = resultado.indexOf(SECAO_IDS[i])
      if (indice >= 0) { depoisDe = indice; break }
    }
    resultado.splice(depoisDe + 1, 0, id)
    vistos.add(id)
  }
  return resultado
}
