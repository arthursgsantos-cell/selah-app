/**
 * Painel de conteúdo sobre fundo personalizado.
 *
 * Desde que as páginas ganharam fundo próprio (cor, nébula e a galeria em
 * cascata), texto solto sobre esse fundo fica ilegível. Todo bloco de texto
 * que não esteja dentro de um `Card` usa este painel.
 *
 * Está aqui, e não copiado em cada página, para que célula, rede e evento não
 * divirjam com o tempo.
 */
export const PAINEL = 'rounded-2xl bg-card p-4 shadow-sm'

/**
 * Cartão aninhado dentro de um `PAINEL`. Branco sobre branco some, então o
 * conteúdo interno usa o tom suave.
 */
export const CARTAO_ANINHADO = 'bg-muted'
