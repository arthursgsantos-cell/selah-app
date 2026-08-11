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

/**
 * Uma pessoa na equipe da turma.
 *
 * `profile` é quem tem conta no app; `pre_cadastro` é quem só existe na lista da
 * igreja e ainda vai criar a dela. O par (tipo, id) acompanha a pessoa da busca
 * até a gravação porque os dois ids vêm de tabelas diferentes e um uuid solto
 * não diria em qual procurar.
 */
export interface ProfessorDaTurma {
  tipo: 'profile' | 'pre_cadastro'
  id: string
}
