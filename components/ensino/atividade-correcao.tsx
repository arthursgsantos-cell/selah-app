'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2, X, Save, MessageSquare } from 'lucide-react'
import { letraOpcao, TIPO_PERGUNTA } from '@/lib/ensino/atividades'
import { comentarEntregaAction, corrigirEntregaAction } from '@/app/actions/ensino/atividades'
import type { PerguntaCompleta } from '@/lib/ensino/atividades-consultas'

export interface RespostaParaCorrigir {
  id: string
  perguntaId: string
  opcoes: string[]
  texto: string | null
  correta: boolean | null
  pontos: number | null
}

interface Props {
  atividadeId: string
  entregaId: string | null
  perguntas: PerguntaCompleta[]
  respostas: RespostaParaCorrigir[]
  observacao: string | null
  /** Sem perguntas (tarefa ou leitura) só a devolutiva faz sentido. */
  soDevolutiva: boolean
}

/**
 * A correção de uma entrega.
 *
 * O que é de marcar já chega decidido — o app comparou com o gabarito na
 * entrega. O que sobra para o professor são as dissertativas, e é nelas que
 * esta tela insiste: cada uma com a resposta do aluno, a anotação de gabarito
 * ao lado, e os dois botões.
 *
 * A nota fecha sozinha quando a última pendência sai; não existe campo de nota
 * final, porque ele divergiria da soma das questões no primeiro ajuste.
 */
export function AtividadeCorrecao({
  atividadeId, entregaId, perguntas, respostas, observacao, soDevolutiva,
}: Props) {
  const router = useRouter()
  const [notas, setNotas] = useState<Record<string, { correta: boolean; pontos: number }>>(
    Object.fromEntries(
      respostas
        .filter((r) => r.correta !== null || r.pontos !== null)
        .map((r) => [r.id, { correta: r.correta ?? false, pontos: Number(r.pontos ?? 0) }])
    )
  )
  const [texto, setTexto] = useState(observacao ?? '')
  const [erro, setErro] = useState<string | null>(null)
  const [salvo, setSalvo] = useState(false)
  const [pendente, iniciar] = useTransition()

  const porPergunta = new Map(respostas.map((r) => [r.perguntaId, r]))
  const dissertativas = perguntas.filter((p) => !TIPO_PERGUNTA[p.tipo].automatica)

  function avaliar(resposta: RespostaParaCorrigir, pergunta: PerguntaCompleta, correta: boolean) {
    setNotas((n) => ({
      ...n,
      // Certo vale a pergunta inteira; errado, zero. O professor ajusta o meio
      // termo no campo de pontos, que é o caso raro.
      [resposta.id]: { correta, pontos: correta ? pergunta.pontos : 0 },
    }))
  }

  function salvarCorrecao() {
    if (!entregaId) return
    setErro(null)
    iniciar(async () => {
      const r = await corrigirEntregaAction(atividadeId, entregaId, {
        respostas: Object.entries(notas).map(([respostaId, v]) => ({
          respostaId,
          correta: v.correta,
          pontos: v.pontos,
        })),
        observacao: texto,
      })
      if (!r.ok) { setErro(r.erro); return }
      setSalvo(true)
      setTimeout(() => setSalvo(false), 2500)
      router.refresh()
    })
  }

  function salvarDevolutiva() {
    if (!entregaId) return
    setErro(null)
    iniciar(async () => {
      const r = await comentarEntregaAction(atividadeId, entregaId, texto)
      if (!r.ok) { setErro(r.erro); return }
      setSalvo(true)
      setTimeout(() => setSalvo(false), 2500)
      router.refresh()
    })
  }

  if (!entregaId) {
    return (
      <p className="rounded-2xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
        Este aluno ainda não abriu a atividade.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {!soDevolutiva && dissertativas.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Respostas para corrigir
          </h2>

          {dissertativas.map((pergunta, i) => {
            const resposta = porPergunta.get(pergunta.id)
            if (!resposta) return null
            const nota = notas[resposta.id]

            return (
              <div key={pergunta.id} className="space-y-2 rounded-2xl border border-border bg-card p-4">
                <p className="text-sm font-medium leading-snug">
                  {i + 1}. {pergunta.enunciado}
                </p>

                <p className="whitespace-pre-wrap rounded-xl bg-muted/50 px-3 py-2 text-sm">
                  {resposta.texto || (
                    <span className="italic text-muted-foreground">Sem resposta</span>
                  )}
                </p>

                {pergunta.respostaEsperada && (
                  <p className="rounded-xl border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                    <span className="font-semibold">Você esperava:</span> {pergunta.respostaEsperada}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => avaliar(resposta, pergunta, true)}
                    className={`inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      nota?.correta === true
                        ? 'border-green-600 bg-green-600 text-white'
                        : 'border-border hover:bg-accent'
                    }`}
                  >
                    <Check className="h-3.5 w-3.5" />
                    Certa
                  </button>
                  <button
                    type="button"
                    onClick={() => avaliar(resposta, pergunta, false)}
                    className={`inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      nota?.correta === false
                        ? 'border-red-500 bg-red-500 text-white'
                        : 'border-border hover:bg-accent'
                    }`}
                  >
                    <X className="h-3.5 w-3.5" />
                    Errada
                  </button>

                  <label className="ml-auto flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                    Pontos
                    <input
                      type="number"
                      min={0}
                      max={pergunta.pontos}
                      step={0.5}
                      value={nota?.pontos ?? 0}
                      onChange={(e) =>
                        setNotas((n) => ({
                          ...n,
                          [resposta.id]: {
                            correta: n[resposta.id]?.correta ?? false,
                            pontos: Number(e.target.value) || 0,
                          },
                        }))
                      }
                      aria-label={`Pontos da pergunta ${i + 1}`}
                      className="h-8 w-16 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring"
                    />
                    <span className="text-muted-foreground/70">de {pergunta.pontos}</span>
                  </label>
                </div>
              </div>
            )
          })}
        </section>
      )}

      {/* As de marcar, só para conferência — já vieram corrigidas. */}
      {!soDevolutiva && perguntas.some((p) => TIPO_PERGUNTA[p.tipo].automatica) && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Corrigidas pelo app
          </h2>
          <div className="divide-y overflow-hidden rounded-2xl border border-border bg-card">
            {perguntas
              .filter((p) => TIPO_PERGUNTA[p.tipo].automatica)
              .map((pergunta) => {
                const resposta = porPergunta.get(pergunta.id)
                const marcadas = resposta?.opcoes ?? []
                return (
                  <div key={pergunta.id} className="px-3 py-2.5">
                    <div className="flex items-start gap-2">
                      <span
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                          resposta?.correta
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-600'
                        }`}
                      >
                        {resposta?.correta ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium leading-snug">{pergunta.enunciado}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          Marcou:{' '}
                          {marcadas.length === 0
                            ? '—'
                            : pergunta.opcoes
                                .map((o, i) => (marcadas.includes(o.id) ? letraOpcao(i) : null))
                                .filter(Boolean)
                                .join(', ')}
                          {' · '}
                          Certa:{' '}
                          {pergunta.opcoes
                            .map((o, i) => (o.correta ? letraOpcao(i) : null))
                            .filter(Boolean)
                            .join(', ')}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                        {resposta?.pontos ?? 0}/{pergunta.pontos}
                      </span>
                    </div>
                  </div>
                )
              })}
          </div>
        </section>
      )}

      {/* Devolutiva */}
      <section className="space-y-2 rounded-2xl border border-border bg-card p-4">
        <label
          htmlFor="devolutiva"
          className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Devolutiva para o aluno
        </label>
        <textarea
          id="devolutiva"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={3}
          placeholder="O que ele lê ao abrir a atividade..."
          className="w-full resize-y rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
        />

        {erro && <p className="text-sm text-destructive">{erro}</p>}

        <button
          type="button"
          onClick={soDevolutiva ? salvarDevolutiva : salvarCorrecao}
          disabled={pendente}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pendente ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : salvo ? (
            <Check className="h-4 w-4" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {salvo ? 'Salvo' : soDevolutiva ? 'Enviar devolutiva' : 'Salvar correção'}
        </button>
      </section>
    </div>
  )
}
