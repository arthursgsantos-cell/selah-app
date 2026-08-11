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
 * Seção de conteúdo sobre fundo personalizado — título e conteúdo no mesmo
 * cartão.
 *
 * É a moldura que a página do evento usa (ver `SecaoChrome`). Um `<h2>` solto
 * era legível enquanto o fundo era branco; desde que a home passou a aceitar
 * cor, imagem e a cascata de fotos, o título precisa do mesmo cartão que o
 * conteúdo — flutuar sozinho sobre a foto deixa a página remendada.
 *
 * PADRÃO DO SITE: em toda página que renderiza `FundoPagina` ou
 * `FundoGaleria` — home, célula, rede, evento e a turma do Ensino — nenhum
 * texto fica direto sobre o fundo. Ou está dentro de um `Card`, ou de um
 * `PAINEL`, ou desta `SECAO` junto do próprio título. Único texto que escapa
 * é o link de voltar do topo, que é navegação e não conteúdo.
 */
export const SECAO = 'space-y-3 rounded-2xl bg-card p-4 shadow-sm'

/** Cabeçalho dentro de uma `SECAO`. */
export const SECAO_TITULO = 'flex items-center gap-2'
