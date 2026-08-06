/** Posições da escala de serviço da célula — fonte única de verdade. */

import type { FuncaoEscala } from '@/lib/supabase/types'

interface FuncaoConfig {
  label: string
  emoji: string
}

/**
 * Ordem em que as funções aparecem na tela. Anfitriões vem primeiro: é a
 * decisão que trava as outras, porque define onde o encontro acontece.
 */
export const FUNCOES_ESCALA: FuncaoEscala[] = [
  'anfitriao',
  'louvor',
  'quebra_gelo',
  'edificacao',
  'compartilhar',
  'lanche',
  'card',
]

export const FUNCAO_CONFIG: Record<FuncaoEscala, FuncaoConfig> = {
  anfitriao: { label: 'Anfitriões', emoji: '🏠' },
  louvor: { label: 'Louvor', emoji: '🎵' },
  quebra_gelo: { label: 'Quebra-gelo', emoji: '🎲' },
  edificacao: { label: 'Edificação', emoji: '📖' },
  compartilhar: { label: 'Compartilhar', emoji: '🤝' },
  lanche: { label: 'Lista de lanche', emoji: '🥪' },
  card: { label: 'Card do encontro', emoji: '🎨' },
}

/** "🎵 Louvor" — usado em listagens compactas e no texto do WhatsApp. */
export function funcaoComEmoji(funcao: FuncaoEscala): string {
  const c = FUNCAO_CONFIG[funcao]
  return `${c.emoji} ${c.label}`
}
