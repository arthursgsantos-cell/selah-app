/**
 * Lógica condicional dos formulários de inscrição.
 *
 * Dois recursos, que se combinam:
 *  - condição: o campo só aparece se outro campo tiver certo valor
 *    ("Nome dos filhos" só se "Tem filhos?" = Sim)
 *  - grupo repetido: um bloco de campos que se repete N vezes, onde N vem de um
 *    campo numérico ("Quantos filhos?" = 3 → três blocos de nome e idade)
 */

import type { CampoFormulario } from '@/lib/supabase/types'

/** Respostas do formulário: id do campo → valor. */
export type RespostasFormulario = Record<string, string | string[] | undefined>

export const MAX_REPETICOES_PADRAO = 10

/** Um campo de grupo gera ids assim, para as respostas não colidirem. */
export function idSubcampo(grupoId: string, indice: number, subcampoId: string): string {
  return `${grupoId}.${indice}.${subcampoId}`
}

function comoTexto(valor: string | string[] | undefined): string[] {
  if (valor === undefined || valor === '') return []
  return Array.isArray(valor) ? valor : [valor]
}

/**
 * O campo deve aparecer? Sem condição, sempre. Com condição, só quando o campo
 * de origem tiver algum dos valores esperados.
 */
export function campoVisivel(
  campo: CampoFormulario,
  respostas: RespostasFormulario,
): boolean {
  if (!campo.condicao) return true

  const { campoId, valores } = campo.condicao
  if (valores.length === 0) return true

  const atual = comoTexto(respostas[campoId])
  return atual.some((v) => valores.includes(v))
}

/**
 * Quantas vezes um grupo se repete, lendo o campo numérico de origem.
 * Valor inválido ou vazio resulta em zero repetições — nada aparece.
 */
export function repeticoesDoGrupo(
  grupo: CampoFormulario,
  respostas: RespostasFormulario,
): number {
  if (!grupo.repetirPorCampoId) return 0

  const bruto = respostas[grupo.repetirPorCampoId]
  const n = Number(Array.isArray(bruto) ? bruto[0] : bruto)
  if (!Number.isFinite(n) || n <= 0) return 0

  const teto = grupo.maxRepeticoes ?? MAX_REPETICOES_PADRAO
  return Math.min(Math.floor(n), teto)
}

/**
 * Campos que podem servir de origem para uma condição: apenas os que já
 * apareceram antes do campo atual (senão a condição nunca teria como ser
 * satisfeita) e que têm valor discreto.
 */
export function candidatosCondicao(
  campos: CampoFormulario[],
  ateIndice: number,
): CampoFormulario[] {
  return campos
    .slice(0, ateIndice)
    .filter((c) => c.tipo === 'opcoes' || c.tipo === 'checkbox')
}

/** Campos numéricos anteriores, que podem controlar quantas vezes um grupo repete. */
export function candidatosRepeticao(
  campos: CampoFormulario[],
  ateIndice: number,
): CampoFormulario[] {
  return campos.slice(0, ateIndice).filter((c) => c.tipo === 'numero')
}

/**
 * Valida as respostas considerando o que está de fato visível: um campo
 * obrigatório escondido por uma condição não pode bloquear o envio.
 */
export function validarRespostas(
  campos: CampoFormulario[],
  respostas: RespostasFormulario,
): string | null {
  for (const campo of campos) {
    if (!campoVisivel(campo, respostas)) continue

    if (campo.tipo === 'grupo') {
      const n = repeticoesDoGrupo(campo, respostas)
      for (let i = 0; i < n; i++) {
        for (const sub of campo.subcampos ?? []) {
          if (!sub.obrigatorio) continue
          const v = respostas[idSubcampo(campo.id, i, sub.id)]
          if (comoTexto(v).length === 0) {
            return `Preencha "${sub.label}" de ${campo.label} ${i + 1}.`
          }
        }
      }
      continue
    }

    if (campo.obrigatorio && comoTexto(respostas[campo.id]).length === 0) {
      return `Preencha "${campo.label}".`
    }
  }

  return null
}

/**
 * Achata as respostas para leitura humana (exportação, listagem de inscritos),
 * já descartando o que estava escondido por condição.
 */
export function respostasLegiveis(
  campos: CampoFormulario[],
  respostas: RespostasFormulario,
): { label: string; valor: string }[] {
  const saida: { label: string; valor: string }[] = []

  for (const campo of campos) {
    if (!campoVisivel(campo, respostas)) continue

    if (campo.tipo === 'grupo') {
      const n = repeticoesDoGrupo(campo, respostas)
      for (let i = 0; i < n; i++) {
        for (const sub of campo.subcampos ?? []) {
          const v = respostas[idSubcampo(campo.id, i, sub.id)]
          const texto = comoTexto(v).join(', ')
          if (texto) saida.push({ label: `${campo.label} ${i + 1} — ${sub.label}`, valor: texto })
        }
      }
      continue
    }

    const texto = comoTexto(respostas[campo.id]).join(', ')
    if (texto) saida.push({ label: campo.label, valor: texto })
  }

  return saida
}
