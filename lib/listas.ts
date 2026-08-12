/**
 * Listas dinâmicas — recortes da igreja para falar com um grupo específico.
 *
 * O caso real: "manda mensagem para todo mundo da rede Adultos que ainda não
 * está em célula" ou "quem faz aniversário este mês". Hoje isso é uma planilha
 * que alguém filtra à mão e cola no WhatsApp.
 *
 * Inclui quem não tem conta no app. A lista da igreja é maior que a lista de
 * usuários — o pré-cadastro existe justamente para as pessoas que a
 * congregação conhece e que ainda não baixaram nada, e deixá-las de fora
 * tornaria a lista errada logo no primeiro uso.
 */

import type { Role } from '@/lib/supabase/types'

export interface PessoaLista {
  /** `profile:<uuid>` ou `pre:<uuid>` — os dois espaços de id podem colidir. */
  chave: string
  nome: string
  telefone: string | null
  email: string | null
  /** Nulo para quem ainda não tem conta. */
  role: Role | null
  temConta: boolean
  celulaId: string | null
  celulaNome: string | null
  redeId: string | null
  redeNome: string | null
  /** Mês do aniversário, 1–12. Nulo quando a data não foi informada. */
  mesAniversario: number | null
  diaAniversario: number | null
  idade: number | null
}

// ── Filtros ────────────────────────────────────────────────────────────────

export interface FiltrosLista {
  busca: string
  redeId: string
  /** `''` = qualquer; `'sem'` = quem não está em célula nenhuma. */
  celulaId: string
  role: string
  /** `''` = qualquer; `'com'` / `'sem'`. */
  telefone: string
  /** `''` = qualquer; `'app'` = tem conta; `'sem_app'` = ainda não tem. */
  conta: string
  /** 0 = qualquer; 1–12 = mês do aniversário. */
  mesAniversario: number
  idadeMin: string
  idadeMax: string
}

export const FILTROS_VAZIOS: FiltrosLista = {
  busca: '', redeId: '', celulaId: '', role: '', telefone: '', conta: '',
  mesAniversario: 0, idadeMin: '', idadeMax: '',
}

/**
 * Aplica os filtros. Campo vazio não filtra — é o que deixa a lista começar
 * com a igreja inteira e ir estreitando.
 */
export function filtrarPessoas(pessoas: PessoaLista[], f: FiltrosLista): PessoaLista[] {
  const busca = f.busca.trim().toLowerCase()
  const min = f.idadeMin ? Number(f.idadeMin) : null
  const max = f.idadeMax ? Number(f.idadeMax) : null

  return pessoas.filter((p) => {
    if (busca && !p.nome.toLowerCase().includes(busca)) return false
    if (f.redeId && p.redeId !== f.redeId) return false

    if (f.celulaId === 'sem') {
      if (p.celulaId !== null) return false
    } else if (f.celulaId && p.celulaId !== f.celulaId) return false

    if (f.role && p.role !== f.role) return false

    if (f.telefone === 'com' && !p.telefone) return false
    if (f.telefone === 'sem' && p.telefone) return false

    if (f.conta === 'app' && !p.temConta) return false
    if (f.conta === 'sem_app' && p.temConta) return false

    if (f.mesAniversario && p.mesAniversario !== f.mesAniversario) return false

    // Idade desconhecida sai do recorte quando há faixa: incluir quem não se
    // sabe a idade num filtro de idade daria uma lista que não é o que se pediu.
    if (min !== null || max !== null) {
      if (p.idade === null) return false
      if (min !== null && p.idade < min) return false
      if (max !== null && p.idade > max) return false
    }

    return true
  })
}

export const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

/**
 * Monta o CSV da lista.
 *
 * Separador `;` e BOM UTF-8 porque o destino é o Excel em português: com
 * vírgula ele joga tudo numa coluna só, e sem BOM os acentos chegam quebrados.
 */
export function listaParaCsv(pessoas: PessoaLista[]): string {
  const escapar = (v: string | null) => `"${(v ?? '').replace(/"/g, '""')}"`
  const linhas = [
    ['Nome', 'Telefone', 'E-mail', 'Cargo', 'Célula', 'Rede', 'Tem conta'].join(';'),
    ...pessoas.map((p) =>
      [
        escapar(p.nome),
        escapar(p.telefone),
        escapar(p.email),
        escapar(p.role),
        escapar(p.celulaNome),
        escapar(p.redeNome),
        p.temConta ? 'sim' : 'não',
      ].join(';')
    ),
  ]
  return `﻿${linhas.join('\r\n')}`
}
