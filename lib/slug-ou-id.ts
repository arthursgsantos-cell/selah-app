/**
 * Endereço bonito sem quebrar o antigo.
 *
 * As páginas de evento e de turma são divulgadas por link, então a URL mostra o
 * slug (`/ensino/turma/carta-de-tiago`). O UUID continua valendo: link já
 * mandado no WhatsApp não pode virar 404. Filtrar por `id` com um valor que não
 * é UUID faria o Postgres devolver erro, então é o formato da chave que decide
 * qual coluna consultar.
 */

export const PADRAO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function ehUuid(chave: string): boolean {
  return PADRAO_UUID.test(chave)
}

export function porSlugOuId<T extends { eq: (coluna: string, valor: string) => T }>(
  query: T,
  chave: string
): T {
  return ehUuid(chave) ? query.eq('id', chave) : query.eq('slug', chave)
}
