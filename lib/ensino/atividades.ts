/**
 * Vocabulário compartilhado das atividades.
 *
 * Rótulos, cores e as duas contas que servidor e cliente precisam fazer igual:
 * a correção automática do quiz e o estado em que uma entrega aparece.
 */

import type {
  OpcaoPergunta, StatusEntrega, TipoAtividade, TipoPergunta,
} from '@/lib/supabase/types'

export const TIPO_ATIVIDADE: Record<
  TipoAtividade,
  { label: string; descricao: string; icone: string }
> = {
  tarefa: {
    label: 'Tarefa',
    descricao: 'O aluno marca quando fizer e pode deixar um comentário.',
    icone: 'ClipboardList',
  },
  leitura: {
    label: 'Desafio de leitura',
    descricao: 'O app divide a leitura por dia e o aluno vai riscando a lista.',
    icone: 'BookOpen',
  },
  quiz: {
    label: 'Quiz / prova',
    descricao: 'Perguntas de marcar e de escrever, com correção.',
    icone: 'FileQuestion',
  },
}

export const STATUS_ENTREGA: Record<StatusEntrega, { label: string; classe: string }> = {
  pendente: { label: 'Pendente', classe: 'bg-muted text-muted-foreground' },
  entregue: { label: 'Entregue', classe: 'bg-blue-100 text-blue-700' },
  corrigida: { label: 'Corrigida', classe: 'bg-green-100 text-green-700' },
}

export const TIPO_PERGUNTA: Record<TipoPergunta, { label: string; automatica: boolean }> = {
  unica: { label: 'Escolha única', automatica: true },
  multipla: { label: 'Múltipla escolha', automatica: true },
  texto: { label: 'Resposta curta', automatica: false },
  longo: { label: 'Resposta longa', automatica: false },
}

/** Letras das alternativas, na ordem em que aparecem. */
export function letraOpcao(indice: number): string {
  return String.fromCharCode(65 + indice)
}

/** Id curto e estável para uma alternativa nova. */
export function novaOpcaoId(): string {
  return Math.random().toString(36).slice(2, 8)
}

/**
 * A pergunta como o aluno a recebe: sem `correta` e sem `resposta_esperada`.
 *
 * A RLS não consegue esconder uma coluna, só uma linha — e a linha inteira é
 * legítima, o gabarito dentro dela não. Então a policy de leitura de
 * `ensino_atividade_perguntas` fica só para quem leciona, e é esta função que
 * monta o que desce para a prova.
 */
export interface PerguntaParaResponder {
  id: string
  secaoId: string | null
  ordem: number
  enunciado: string
  tipo: TipoPergunta
  opcoes: { id: string; texto: string }[]
  pontos: number
  obrigatoria: boolean
  midiaUrl: string | null
  midiaTipo: 'imagem' | 'video' | null
}

export function semGabarito(p: {
  id: string
  secao_id: string | null
  ordem: number
  enunciado: string
  tipo: TipoPergunta
  opcoes: OpcaoPergunta[]
  pontos: number
  obrigatoria: boolean
  midia_url: string | null
  midia_tipo: 'imagem' | 'video' | null
}): PerguntaParaResponder {
  return {
    id: p.id,
    secaoId: p.secao_id,
    ordem: p.ordem,
    enunciado: p.enunciado,
    tipo: p.tipo,
    opcoes: (p.opcoes ?? []).map((o) => ({ id: o.id, texto: o.texto })),
    pontos: Number(p.pontos),
    obrigatoria: p.obrigatoria,
    midiaUrl: p.midia_url,
    midiaTipo: p.midia_tipo,
  }
}

/**
 * Corrige uma resposta de marcar.
 *
 * Na múltipla escolha exige o conjunto exato: marcar duas certas de três não é
 * meio ponto, é a resposta errada — a pergunta é "quais destas", e deixar uma
 * de fora responde outra coisa. Meia pontuação também tornaria vantajoso
 * marcar tudo.
 *
 * Devolve `null` na dissertativa: ali quem corrige é o professor, e é esse
 * nulo que o painel lê como "esta prova ainda espera você".
 */
export function corrigir(
  tipo: TipoPergunta,
  opcoes: OpcaoPergunta[],
  escolhidas: string[]
): boolean | null {
  if (!TIPO_PERGUNTA[tipo].automatica) return null

  const certas = opcoes.filter((o) => o.correta).map((o) => o.id).sort()
  const marcadas = [...new Set(escolhidas)].sort()

  // Pergunta sem gabarito não reprova ninguém: o professor esqueceu de marcar
  // a alternativa certa, e o erro é dele.
  if (certas.length === 0) return null

  return certas.length === marcadas.length && certas.every((id, i) => id === marcadas[i])
}

/** Soma da prova, considerando só o que já foi corrigido. */
export function somarNota(
  respostas: { correta: boolean | null; pontos: number | null }[]
): { nota: number; pendentes: number } {
  let nota = 0
  let pendentes = 0
  for (const r of respostas) {
    if (r.correta === null && r.pontos === null) pendentes++
    else nota += Number(r.pontos ?? 0)
  }
  return { nota: Math.round(nota * 100) / 100, pendentes }
}

/** Data local em `yyyy-mm-dd` — a mesma régua das aulas. */
export function hojeIso(): string {
  const d = new Date()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

/**
 * Como o prazo aparece para o aluno.
 *
 * "Faltam 2 dias" diz mais que "20/12" quando a data está perto, e menos
 * quando está longe — por isso os dois formatos, com o corte em uma semana.
 */
export function textoPrazo(prazo: string | null, hoje = hojeIso()): {
  texto: string
  urgente: boolean
  vencido: boolean
} | null {
  if (!prazo) return null

  const [a1, m1, d1] = hoje.split('-').map(Number)
  const [a2, m2, d2] = prazo.split('-').map(Number)
  const dias = Math.round(
    (new Date(a2, m2 - 1, d2).getTime() - new Date(a1, m1 - 1, d1).getTime()) / 86_400_000
  )

  const formatado = `${String(d2).padStart(2, '0')}/${String(m2).padStart(2, '0')}`

  if (dias < 0) {
    const atraso = Math.abs(dias)
    return {
      texto: atraso === 1 ? 'Venceu ontem' : `Venceu há ${atraso} dias`,
      urgente: false,
      vencido: true,
    }
  }
  if (dias === 0) return { texto: 'Vence hoje', urgente: true, vencido: false }
  if (dias === 1) return { texto: 'Vence amanhã', urgente: true, vencido: false }
  if (dias <= 7) return { texto: `Faltam ${dias} dias`, urgente: true, vencido: false }
  return { texto: `Até ${formatado}`, urgente: false, vencido: false }
}

/** A atividade já abriu para o aluno? Rascunho e data futura seguram. */
export function disponivel(
  a: { publicada: boolean; abre_em: string | null },
  hoje = hojeIso()
): boolean {
  return a.publicada && (a.abre_em === null || a.abre_em <= hoje)
}
