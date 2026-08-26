import { normalizarNome } from './texto'
import type { Contexto } from './registro'

/**
 * Resolução dos nomes que a planilha traz (escritos no WhatsApp) para os
 * registros do banco. Nada aqui cria célula ou rede: um erro de digitação na
 * planilha viraria um registro fantasma que ninguém iria notar.
 */

export type Alvo = { id: string; nome: string }

export type Resolvedor = {
  (nome: string): Alvo | null
  /** Nomes cadastrados, para a mensagem de pendência. */
  nomes: string[]
}

function criarResolvedor(pares: { chave: string; alvo: Alvo }[]): Resolvedor {
  const mapa = new Map(pares.map((p) => [p.chave, p.alvo]))
  const nomes = [...new Set(pares.map((p) => p.alvo.nome))].sort()
  const fn = ((nome: string) => {
    const chave = normalizarNome(nome)
    return mapa.get(chave) ?? mapa.get(chave.replace(/\s+[234]\.0$/, '')) ?? null
  }) as Resolvedor
  fn.nomes = nomes
  return fn
}

/**
 * Célula por: nome real → apelido cadastrado em `celula_apelidos` → nada.
 * A comparação ignora acento e caixa, igual à função `normalizar_nome` do
 * banco. Grafias novas do WhatsApp viram linhas em `celula_apelidos`, sem
 * mexer no código.
 */
export async function resolvedorDeCelulas(ctx: Contexto): Promise<Resolvedor> {
  const { data: redes } = await ctx.admin
    .from('redes')
    .select('id')
    .eq('igreja_id', ctx.igrejaId)

  const redeIds = (redes ?? []).map((r) => r.id)
  if (redeIds.length === 0) return criarResolvedor([])

  const { data: celulas } = await ctx.admin
    .from('celulas')
    .select('id, nome')
    .in('rede_id', redeIds)

  const lista = (celulas ?? []) as { id: string; nome: string }[]
  const porId = new Map(lista.map((c) => [c.id, c]))

  const { data: apelidos } = await ctx.admin
    .from('celula_apelidos')
    .select('apelido, celula_id')

  const pares = lista.map((c) => ({ chave: normalizarNome(c.nome), alvo: c }))

  for (const a of (apelidos ?? []) as { apelido: string; celula_id: string }[]) {
    const celula = porId.get(a.celula_id)
    // Apelido de célula de outra igreja não interessa aqui.
    if (celula) pares.push({ chave: normalizarNome(a.apelido), alvo: celula })
  }

  // Grafias históricas que continuam circulando nas planilhas e no WhatsApp.
  // São aliases, não novas células.
  const porNome = new Map(lista.map((c) => [normalizarNome(c.nome), c]))
  const aliasesCanonicos: Record<string, string[]> = {
    pertencer: ['PertenSer'],
    alpha: ['Alfa'],
    omega: ['Omega', 'Ômega'],
  }
  for (const [canonico, aliases] of Object.entries(aliasesCanonicos)) {
    const celula = porNome.get(normalizarNome(canonico))
    if (celula) for (const alias of aliases) pares.push({ chave: normalizarNome(alias), alvo: celula })
  }

  return criarResolvedor(pares)
}

/**
 * Rede pelo nome. A coluna "Destino" costuma vir como "Rede One", então o
 * prefixo "Rede " é descartado antes de comparar.
 */
export async function resolvedorDeRedes(ctx: Contexto): Promise<Resolvedor> {
  const { data } = await ctx.admin
    .from('redes')
    .select('id, nome')
    .eq('igreja_id', ctx.igrejaId)

  const lista = (data ?? []) as { id: string; nome: string }[]
  const pares = lista.flatMap((r) => [
    { chave: normalizarNome(r.nome), alvo: r },
    { chave: normalizarNome(`rede ${r.nome}`), alvo: r },
  ])
  return criarResolvedor(pares)
}

export function semPrefixoRede(destino: string): string {
  return destino.replace(/^\s*rede\s+/i, '').trim()
}

