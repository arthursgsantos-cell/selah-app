/**
 * Campanhas de contribuição — o que o servidor e o cliente compartilham.
 *
 * Ver `supabase/migrations/campanhas_contribuicao.sql` para o porquê do final
 * de centavos, e `campanhas_midia.sql` para o card e o vídeo.
 */

export const BUCKET_CAMPANHAS = 'campanhas'

/** "23" → ",23"; o zero à esquerda importa, é assim que sai no extrato. */
export function centavosTexto(centavos: number): string {
  return `,${String(centavos).padStart(2, '0')}`
}
