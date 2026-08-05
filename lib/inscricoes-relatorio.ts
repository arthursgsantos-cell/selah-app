/**
 * Inscrições de um evento num formato só, venham de onde vierem.
 *
 * Há duas fontes e elas não se parecem:
 *
 *   app      — `inscricoes_evento`, com as respostas em `dados` (jsonb) e os
 *              rótulos das perguntas em `formularios.campos`
 *   planilha — a publicação do Google Forms, quando a inscrição acontece por
 *              link externo e o app não registra nada
 *
 * O relatório não deveria conhecer essa diferença. Aqui as duas viram uma
 * lista de registros com as mesmas colunas, e a tela só desenha.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { baseDaPublicacao, parseCsv } from '@/lib/importacao/planilha'
import { normalizarNome } from '@/lib/importacao/texto'
import type { CampoFormulario } from '@/lib/supabase/types'

export interface RegistroInscricao {
  id: string
  /** Valores por rótulo de coluna, já em texto pronto para exibir. */
  valores: Record<string, string>
  /** Quando a inscrição entrou. ISO, ou null quando a fonte não informa. */
  criadoEm: string | null
}

export interface RelatorioInscricoes {
  fonte: 'app' | 'planilha'
  /** Rótulos das colunas, na ordem em que devem aparecer. */
  colunas: string[]
  registros: RegistroInscricao[]
  /** Colunas com poucos valores distintos — as que rendem gráfico. */
  colunasCategoricas: string[]
  totais: {
    inscritos: number
    valorPrevisto: number
    valorPago: number
    saldo: number
  }
}

const VAZIO: RelatorioInscricoes = {
  fonte: 'app',
  colunas: [],
  registros: [],
  colunasCategoricas: [],
  totais: { inscritos: 0, valorPrevisto: 0, valorPago: 0, saldo: 0 },
}

/**
 * "R$ 1.234,50" → 1234.5. Devolve 0 no que não for número — a planilha é
 * digitada à mão e traz travessão, vazio e texto no meio dos valores.
 */
export function paraNumero(bruto: string | null | undefined): number {
  if (!bruto) return 0
  const limpo = bruto
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.')
  const n = parseFloat(limpo)
  return Number.isFinite(n) ? n : 0
}

/** Quanto das respostas precisa cair em valores repetidos para virar gráfico. */
const PROPORCAO_REPETIDA = 0.7

/**
 * Colunas que rendem gráfico.
 *
 * Contar valores distintos não basta. "Alguém tem restrição alimentar?" é
 * campo aberto, e com poucos inscritos ele passa no teste de "poucos valores"
 * — só que cada resposta é única ("Ricardo alergia a camarão", "Felipe:
 * Camarão"), e o gráfico vira uma lista de barras de tamanho 1.
 *
 * O que separa escolha de texto livre é a REPETIÇÃO: numa pergunta de opções a
 * maioria das pessoas responde a mesma coisa que outra alguém. Daí exigir que
 * pelo menos 70% das respostas caiam em valores que aparecem mais de uma vez.
 */
function detectarCategoricas(colunas: string[], registros: RegistroInscricao[]): string[] {
  const IGNORAR = ['nome', 'telefone', 'email', 'e-mail', 'carimbo', 'observ', 'link', 'id da', 'comprovante', 'ultima', 'última']

  return colunas.filter((coluna) => {
    const c = normalizarNome(coluna)
    if (IGNORAR.some((t) => c.includes(normalizarNome(t)))) return false

    const preenchidos = registros
      .map((r) => (r.valores[coluna] ?? '').trim())
      .filter(Boolean)
    if (preenchidos.length === 0) return false

    // Coluna de dinheiro ou quantidade não é categoria: um gráfico de
    // "R$ 53,75 = 3 · R$ 71,25 = 2" não responde pergunta nenhuma. Os totais
    // já aparecem nos indicadores.
    const numericos = preenchidos.filter((v) => /^[R$\s]*-?[\d.,]+$/.test(v)).length
    if (numericos / preenchidos.length >= PROPORCAO_REPETIDA) return false

    const contagem = new Map<string, number>()
    for (const v of preenchidos) contagem.set(v, (contagem.get(v) ?? 0) + 1)

    // Acima de 12 vira lista, não gráfico; com 1 só não há o que comparar.
    if (contagem.size < 2 || contagem.size > 12) return false

    const emRepetidos = [...contagem.values()].filter((n) => n > 1).reduce((a, b) => a + b, 0)
    return emRepetidos / preenchidos.length >= PROPORCAO_REPETIDA
  })
}

/** Distribuição de uma coluna, da resposta mais comum para a menos. */
export function distribuicao(
  registros: RegistroInscricao[],
  coluna: string
): { rotulo: string; quantidade: number }[] {
  const contagem = new Map<string, number>()
  for (const r of registros) {
    const v = (r.valores[coluna] ?? '').trim() || '—'
    contagem.set(v, (contagem.get(v) ?? 0) + 1)
  }
  return [...contagem.entries()]
    .map(([rotulo, quantidade]) => ({ rotulo, quantidade }))
    .sort((a, b) => b.quantidade - a.quantidade)
}

// ---------------------------------------------------------------------------
// Fonte: app
// ---------------------------------------------------------------------------

async function doApp(eventoId: string, formularioId: string | null): Promise<RelatorioInscricoes> {
  const admin = createAdminClient()

  const [{ data: inscricoes }, { data: form }] = await Promise.all([
    admin
      .from('inscricoes_evento')
      .select('id, nome, telefone, dados, status, valor_total, criado_em')
      .eq('evento_id', eventoId)
      .order('criado_em'),
    formularioId
      ? admin.from('formularios').select('campos').eq('id', formularioId).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const linhas = (inscricoes ?? []) as {
    id: string; nome: string; telefone: string | null
    dados: Record<string, string>; status: string
    valor_total: number | null; criado_em: string
  }[]

  const campos = ((form as { campos?: CampoFormulario[] } | null)?.campos ?? [])
    .filter((c) => c.id !== 'nome' && c.id !== 'telefone')

  const colunas = ['Nome', 'Telefone', 'Status', ...campos.map((c) => c.label), 'Valor total', 'Valor pago', 'Saldo']

  // Pagamentos registrados no app, somados por inscrição.
  const ids = linhas.map((l) => l.id)
  const { data: pagamentos } = ids.length > 0
    ? await admin.from('inscricao_pagamentos').select('inscricao_id, valor').in('inscricao_id', ids)
    : { data: [] }

  const pagoPorInscricao = new Map<string, number>()
  for (const p of (pagamentos ?? []) as { inscricao_id: string; valor: number }[]) {
    pagoPorInscricao.set(p.inscricao_id, (pagoPorInscricao.get(p.inscricao_id) ?? 0) + (p.valor ?? 0))
  }

  const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  let valorPrevisto = 0
  let valorPago = 0

  const registros: RegistroInscricao[] = linhas.map((l) => {
    const previsto = l.status === 'cancelado' ? 0 : (l.valor_total ?? 0)
    const pago = pagoPorInscricao.get(l.id) ?? 0
    valorPrevisto += previsto
    valorPago += pago

    const valores: Record<string, string> = {
      Nome: l.nome,
      Telefone: l.telefone ?? '',
      Status: l.status,
      'Valor total': previsto ? brl(previsto) : '',
      'Valor pago': pago ? brl(pago) : '',
      Saldo: previsto ? brl(Math.max(0, previsto - pago)) : '',
    }
    for (const campo of campos) valores[campo.label] = l.dados?.[campo.id] ?? ''

    return { id: l.id, valores, criadoEm: l.criado_em }
  })

  return {
    fonte: 'app',
    colunas,
    registros,
    colunasCategoricas: detectarCategoricas(colunas, registros),
    totais: {
      inscritos: linhas.filter((l) => l.status !== 'cancelado').length,
      valorPrevisto,
      valorPago,
      saldo: Math.max(0, valorPrevisto - valorPago),
    },
  }
}

// ---------------------------------------------------------------------------
// Fonte: planilha
// ---------------------------------------------------------------------------

async function baixar(url: string): Promise<string> {
  // Cinco minutos de folga: o relatório não precisa ser ao vivo, e sem cache
  // cada abertura bateria no Google.
  const res = await fetch(url, { redirect: 'follow', next: { revalidate: 300 } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

async function daPlanilha(urlPublicada: string): Promise<RelatorioInscricoes> {
  const base = baseDaPublicacao(urlPublicada)
  const html = await baixar(`${base}html`)
  const gids = [...new Set([...html.matchAll(/gid=(\d+)/g)].map((m) => m[1]))]

  let inscritos: { cabecalho: string[]; linhas: string[][] } | null = null

  for (const gid of gids) {
    const texto = await baixar(`${base}?gid=${gid}&single=true&output=csv`)
    if (texto.trimStart().startsWith('<')) continue
    const linhas = parseCsv(texto)
    if (linhas.length < 2) continue

    const cabecalho = linhas[0]
    // A aba de inscritos é a que tem "nome completo"; a de pagamentos, não.
    const ehInscritos = cabecalho.some((c) => normalizarNome(c).includes('nome completo'))
    if (ehInscritos) {
      inscritos = { cabecalho, linhas: linhas.slice(1).filter((l) => l.some((c) => c.trim())) }
      break
    }
  }

  if (!inscritos) return { ...VAZIO, fonte: 'planilha' }

  // Colunas vazias no cabeçalho viram ruído na tabela.
  const indices = inscritos.cabecalho
    .map((rotulo, i) => ({ rotulo: rotulo.trim(), i }))
    .filter((c) => c.rotulo)

  const colunas = indices.map((c) => c.rotulo)

  const registros: RegistroInscricao[] = inscritos.linhas.map((linha, n) => {
    const valores: Record<string, string> = {}
    for (const { rotulo, i } of indices) valores[rotulo] = (linha[i] ?? '').trim()
    return { id: `linha-${n}`, valores, criadoEm: null }
  })

  // Os totais saem das colunas de dinheiro da própria planilha, quando existem.
  const acha = (...trechos: string[]) =>
    colunas.find((c) => trechos.some((t) => normalizarNome(c).includes(normalizarNome(t)))) ?? null

  const colTotal = acha('valor total')
  const colPago = acha('valor pago')
  const colSaldo = acha('saldo restante', 'saldo')

  let valorPrevisto = 0
  let valorPago = 0
  let saldo = 0
  for (const r of registros) {
    if (colTotal) valorPrevisto += paraNumero(r.valores[colTotal])
    if (colPago) valorPago += paraNumero(r.valores[colPago])
    if (colSaldo) saldo += paraNumero(r.valores[colSaldo])
  }

  return {
    fonte: 'planilha',
    colunas,
    registros,
    colunasCategoricas: detectarCategoricas(colunas, registros),
    totais: {
      inscritos: registros.length,
      valorPrevisto,
      valorPago,
      // A planilha traz o saldo pronto; a subtração é só a rede de segurança.
      saldo: colSaldo ? saldo : Math.max(0, valorPrevisto - valorPago),
    },
  }
}

/**
 * `null` quando a planilha não pôde ser lida — link revogado, republicação ou
 * Google fora do ar. A tela mostra o aviso em vez de uma tabela vazia mentindo
 * que ninguém se inscreveu.
 */
export async function carregarRelatorio(evento: {
  id: string
  formulario_id: string | null
  inscricoes_planilha_url: string | null
}): Promise<RelatorioInscricoes | null> {
  if (evento.inscricoes_planilha_url) {
    try {
      return await daPlanilha(evento.inscricoes_planilha_url)
    } catch {
      return null
    }
  }
  return doApp(evento.id, evento.formulario_id)
}
