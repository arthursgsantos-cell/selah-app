/**
 * Fuso do servidor.
 *
 * As páginas renderizadas no servidor formatam datas com o fuso do processo.
 * Na Vercel esse fuso é UTC, então um evento marcado para as 9h de Brasília
 * aparecia como 12h00 — enquanto os componentes client, que formatam no
 * navegador, mostravam 9h00. Servidor e navegador precisam concordar.
 *
 * `TZ` é nome reservado nas variáveis de ambiente da Vercel, então o ajuste
 * vive aqui: `register()` roda uma vez, antes de qualquer requisição, e o
 * Node relê o fuso a cada formatação de data.
 */
export function register() {
  process.env.TZ = 'America/Sao_Paulo'
}
