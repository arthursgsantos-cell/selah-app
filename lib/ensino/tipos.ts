/**
 * Constantes e tipos compartilhados do Ensino.
 *
 * Vivem fora das server actions porque um arquivo `'use server'` só pode
 * exportar funções assíncronas — uma constante exportada de lá quebra o build.
 */

/** Bucket privado dos materiais. Leitura só pela rota que assina a URL. */
export const BUCKET_MATERIAIS = 'ensino-materiais'

/** Bucket público das capas de curso e turma. */
export const BUCKET_CAPAS = 'ensino-capas'

/** Retorno padrão das ações: erro em texto pronto para a tela. */
export type ResultadoAcao = { ok: true } | { ok: false; erro: string }
