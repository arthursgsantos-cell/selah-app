/**
 * Seções móveis da home — as que o pastor pode reordenar e renomear direto na
 * tela, sem abrir o painel de administração.
 *
 * Ficam de fora de propósito: o herói, "Minha célula" e o aniversário (são
 * conteúdo pessoal, amarrado a quem está logado, não faz sentido "mover"), o
 * mapa e o rodapé (identidade fixa da igreja), e a liderança (raramente muda
 * de lugar). O que sobra são os quatro cartões institucionais — dízimo,
 * eventos, o convite para servir/ser membro e o atalho do Ensino — que hoje
 * vivem espalhados na página e passam a formar um bloco só, na ordem que a
 * liderança escolher.
 */

export const SECAO_IDS = ['contribuir', 'eventos', 'proximo_passo', 'ensino'] as const

export type SecaoHomeId = (typeof SECAO_IDS)[number]

export const SECAO_LABELS: Record<SecaoHomeId, string> = {
  contribuir: 'Dízimos e ofertas',
  eventos: 'Próximos eventos',
  proximo_passo: 'Dê o próximo passo',
  ensino: 'Escola Bíblica',
}

/** Só "eventos" não tem texto próprio — é a agenda escolhida em cada evento. */
export const SECAO_TEM_TEXTO: Record<SecaoHomeId, boolean> = {
  contribuir: true,
  eventos: false,
  proximo_passo: true,
  ensino: true,
}

export interface TextoSecao {
  titulo?: string | null
  subtitulo?: string | null
}

export type TextosSecoes = Partial<Record<SecaoHomeId, TextoSecao>>

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
  const faltando = SECAO_IDS.filter((id) => !vistos.has(id))
  return [...validas, ...faltando]
}
