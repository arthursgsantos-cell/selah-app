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

/**
 * Cabeçalho de seção sobre fundo personalizado.
 *
 * Um `<h2>` solto era legível enquanto o fundo era branco. Desde que a página
 * inicial também ganhou cor, imagem e a cascata de fotos, o mesmo título passou
 * a competir com o que está atrás — a pílula translúcida devolve o contraste
 * sem transformar cada título num painel inteiro.
 */
export const TITULO_SECAO =
  'inline-flex items-center gap-2 rounded-full bg-card/85 px-3 py-1 shadow-sm backdrop-blur'
