'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2, Send, X, Clock, Award } from 'lucide-react'
import { resolverVideo } from '@/lib/video-embed'
import { letraOpcao } from '@/lib/ensino/atividades'
import { responderQuizAction } from '@/app/actions/ensino/atividades'
import type { PerguntaParaResponder } from '@/lib/ensino/atividades'

/** A resposta já entregue, quando o aluno reabre a prova. */
export interface RespostaDada {
  perguntaId: string
  opcoes: string[]
  texto: string | null
  correta: boolean | null
  pontos: number | null
}

interface Props {
  atividadeId: string
  perguntas: PerguntaParaResponder[]
  /** Vazio enquanto a prova não foi entregue. */
  respostas: RespostaDada[]
  entregue: boolean
  nota: number | null
  observacao: string | null
}

/**
 * A prova, do lado do aluno.
 *
 * Enquanto não entregue é um formulário; entregue vira o espelho da correção,
 * com o que ele marcou e o que valeu. É a mesma árvore de componentes nos dois
 * casos de propósito — duas telas separadas divergiriam na primeira mudança de
 * enunciado.
 *
 * As alternativas certas não estão nesta página antes da entrega: elas nem
 * saem do banco, porque a action que monta a prova remove o gabarito. O que
 * chega depois de entregue é só o `correta` de cada resposta dada.
 */
export function AtividadeQuiz({
  atividadeId, perguntas, respostas, entregue, nota, observacao,
}: Props) {
  const router = useRouter()
  const [marcadas, setMarcadas] = useState<Record<string, string[]>>({})
  const [textos, setTextos] = useState<Record<string, string>>({})
  const [comentario, setComentario] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, iniciar] = useTransition()

  const dadas = useMemo(
    () => new Map(respostas.map((r) => [r.perguntaId, r])),
    [respostas]
  )

  const totalPontos = perguntas.reduce((s, p) => s + p.pontos, 0)
  const aguardando = respostas.some((r) => r.correta === null && r.pontos === null)

  const respondidas = perguntas.filter((p) => {
    const op = marcadas[p.id] ?? []
    const tx = textos[p.id] ?? ''
    return op.length > 0 || tx.trim() !== ''
  }).length

  const faltamObrigatorias = perguntas.filter((p) => {
    if (!p.obrigatoria) return false
    const op = marcadas[p.id] ?? []
    const tx = textos[p.id] ?? ''
    return op.length === 0 && tx.trim() === ''
  }).length

  function escolher(pergunta: PerguntaParaResponder, opcaoId: string) {
    setMarcadas((m) => {
      const atual = m[pergunta.id] ?? []
      if (pergunta.tipo === 'unica') return { ...m, [pergunta.id]: [opcaoId] }
      return {
        ...m,
        [pergunta.id]: atual.includes(opcaoId)
          ? atual.filter((id) => id !== opcaoId)
          : [...atual, opcaoId],
      }
    })
  }

  function enviar() {
    if (faltamObrigatorias > 0) {
      setErro(`Faltam ${faltamObrigatorias} ${faltamObrigatorias === 1 ? 'pergunta obrigatória' : 'perguntas obrigatórias'}.`)
      return
    }
    if (!confirm('Entregar a prova? Depois de entregue não dá para mudar as respostas.')) return

    setErro(null)
    iniciar(async () => {
      const r = await responderQuizAction(
        atividadeId,
        perguntas.map((p) => ({
          perguntaId: p.id,
          opcoes: marcadas[p.id] ?? [],
          texto: textos[p.id] ?? null,
        })),
        comentario || null
      )
      if (!r.ok) { setErro(r.erro); return }
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      {entregue && (
        <div
          className={`flex items-center gap-3 rounded-2xl border p-4 ${
            aguardando ? 'border-blue-500/30 bg-blue-50' : 'border-green-600/30 bg-green-50'
          }`}
        >
          {aguardando ? (
            <Clock className="h-5 w-5 shrink-0 text-blue-700" />
          ) : (
            <Award className="h-5 w-5 shrink-0 text-green-700" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              {aguardando ? 'Entregue — aguardando correção' : 'Prova corrigida'}
            </p>
            <p className="text-xs text-muted-foreground">
              {aguardando
                ? 'As perguntas de escrever ainda passam pelo professor.'
                : `Você fez ${nota ?? 0} de ${totalPontos} ${totalPontos === 1 ? 'ponto' : 'pontos'}.`}
            </p>
          </div>
        </div>
      )}

      {perguntas.map((pergunta, indice) => {
        const dada = dadas.get(pergunta.id)
        const embed = pergunta.midiaTipo === 'video' ? resolverVideo(pergunta.midiaUrl) : null

        return (
          <section
            key={pergunta.id}
            className="space-y-3 rounded-2xl border border-border bg-card p-4"
          >
            <div className="flex items-start gap-2">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-[11px] font-bold text-primary">
                {indice + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="whitespace-pre-wrap text-sm font-medium leading-snug">
                  {pergunta.enunciado}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {pergunta.pontos} {pergunta.pontos === 1 ? 'ponto' : 'pontos'}
                  {!pergunta.obrigatoria && ' · opcional'}
                </p>
              </div>
              {/* O resultado da questão, quando já corrigida. */}
              {entregue && dada?.correta !== null && dada?.correta !== undefined && (
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                    dada.correta ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                  }`}
                >
                  {dada.correta ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                </span>
              )}
            </div>

            {/* A ilustração da pergunta. */}
            {pergunta.midiaUrl && pergunta.midiaTipo === 'imagem' && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={pergunta.midiaUrl}
                alt=""
                className="max-h-80 w-full rounded-xl object-contain"
              />
            )}
            {embed && (
              <div className="aspect-video overflow-hidden rounded-xl bg-black">
                {embed.tipo === 'iframe' ? (
                  <iframe
                    src={embed.src}
                    title={`Vídeo da pergunta ${indice + 1}`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    referrerPolicy="strict-origin-when-cross-origin"
                    className="h-full w-full"
                  />
                ) : (
                  // eslint-disable-next-line jsx-a11y/media-has-caption
                  <video src={embed.src} controls playsInline className="h-full w-full" />
                )}
              </div>
            )}

            {pergunta.tipo === 'unica' || pergunta.tipo === 'multipla' ? (
              <div className="space-y-1.5">
                {pergunta.opcoes.map((opcao, i) => {
                  const escolhida = entregue
                    ? (dada?.opcoes ?? []).includes(opcao.id)
                    : (marcadas[pergunta.id] ?? []).includes(opcao.id)

                  return (
                    <button
                      key={opcao.id}
                      type="button"
                      disabled={entregue || enviando}
                      onClick={() => escolher(pergunta, opcao.id)}
                      className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-sm transition-colors disabled:cursor-default ${
                        escolhida
                          ? 'border-primary bg-primary/10 font-medium'
                          : 'border-border hover:bg-accent disabled:hover:bg-transparent'
                      }`}
                    >
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center text-[11px] font-bold ${
                          pergunta.tipo === 'unica' ? 'rounded-full' : 'rounded-md'
                        } border-2 ${
                          escolhida
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-muted-foreground/30 text-muted-foreground'
                        }`}
                      >
                        {letraOpcao(i)}
                      </span>
                      <span className="min-w-0">{opcao.texto}</span>
                    </button>
                  )
                })}
              </div>
            ) : entregue ? (
              <p className="whitespace-pre-wrap rounded-xl bg-muted/50 px-3 py-2 text-sm">
                {dada?.texto || <span className="italic text-muted-foreground">Sem resposta</span>}
              </p>
            ) : (
              <textarea
                value={textos[pergunta.id] ?? ''}
                onChange={(e) => setTextos((t) => ({ ...t, [pergunta.id]: e.target.value }))}
                rows={pergunta.tipo === 'longo' ? 6 : 2}
                placeholder="Sua resposta..."
                aria-label={`Resposta da pergunta ${indice + 1}`}
                className="w-full resize-y rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
              />
            )}

            {/* Pontuação da dissertativa depois de corrigida. */}
            {entregue && dada && dada.pontos !== null && !['unica', 'multipla'].includes(pergunta.tipo) && (
              <p className="text-xs font-medium text-muted-foreground">
                {dada.pontos} de {pergunta.pontos} {pergunta.pontos === 1 ? 'ponto' : 'pontos'}
              </p>
            )}
          </section>
        )
      })}

      {!entregue && (
        <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <label htmlFor="comentario-quiz" className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Comentário (opcional)
          </label>
          <textarea
            id="comentario-quiz"
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            rows={2}
            placeholder="Quer dizer algo ao professor?"
            className="w-full resize-y rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
          />

          {erro && <p className="text-sm text-destructive">{erro}</p>}

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {respondidas} de {perguntas.length} respondidas
            </p>
            <button
              type="button"
              onClick={enviar}
              disabled={enviando}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Entregar prova
            </button>
          </div>
        </section>
      )}

      {observacao && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-primary">
            Devolutiva do professor
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{observacao}</p>
        </div>
      )}
    </div>
  )
}
