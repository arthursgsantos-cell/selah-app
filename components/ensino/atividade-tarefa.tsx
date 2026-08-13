'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2, MessageSquare, Send } from 'lucide-react'
import { concluirTarefaAction } from '@/app/actions/ensino/atividades'

interface Props {
  atividadeId: string
  concluida: boolean
  comentario: string | null
  /** A devolutiva do professor, quando já houve uma. */
  observacao: string | null
}

/**
 * A tarefa livre: um botão de feito e um comentário.
 *
 * O comentário é do aluno para o professor — "li, mas travei no capítulo 3" —
 * e vale por si: quem não terminou também tem o que dizer, e por isso o campo
 * não depende de a tarefa estar marcada.
 *
 * Marcar grava na hora, sem botão de salvar, pela mesma razão da chamada: um
 * toque que não persiste sozinho é um toque que se perde.
 */
export function AtividadeTarefa({ atividadeId, concluida, comentario, observacao }: Props) {
  const router = useRouter()
  const [feito, setFeito] = useState(concluida)
  const [texto, setTexto] = useState(comentario ?? '')
  const [salvo, setSalvo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  const mudou = texto.trim() !== (comentario ?? '').trim()

  function alternar() {
    const proximo = !feito
    setFeito(proximo) // otimista: o toque responde antes da rede
    setErro(null)
    iniciar(async () => {
      const r = await concluirTarefaAction(atividadeId, { concluida: proximo })
      if (!r.ok) {
        setFeito(!proximo)
        setErro(r.erro)
        return
      }
      router.refresh()
    })
  }

  function enviarComentario() {
    setErro(null)
    iniciar(async () => {
      const r = await concluirTarefaAction(atividadeId, { concluida: feito, comentario: texto })
      if (!r.ok) { setErro(r.erro); return }
      setSalvo(true)
      setTimeout(() => setSalvo(false), 2500)
      router.refresh()
    })
  }

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <button
        type="button"
        onClick={alternar}
        disabled={pendente}
        className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors disabled:opacity-60 ${
          feito
            ? 'border-green-600/40 bg-green-50 text-green-800'
            : 'border-border hover:bg-accent'
        }`}
      >
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 transition-colors ${
            feito ? 'border-green-600 bg-green-600 text-white' : 'border-muted-foreground/30'
          }`}
        >
          {pendente ? <Loader2 className="h-4 w-4 animate-spin" /> : feito && <Check className="h-4 w-4" />}
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold">
            {feito ? 'Feito' : 'Marcar como feito'}
          </span>
          <span className="block text-xs text-muted-foreground">
            {feito ? 'O professor já vê no painel.' : 'Toque quando terminar a tarefa.'}
          </span>
        </span>
      </button>

      <div className="space-y-2">
        <label
          htmlFor="comentario-tarefa"
          className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Comentário
        </label>
        <textarea
          id="comentario-tarefa"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={3}
          placeholder="Alguma dúvida ou observação para o professor?"
          className="w-full resize-y rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
        />
        {(mudou || salvo) && (
          <button
            type="button"
            onClick={enviarComentario}
            disabled={pendente || !mudou}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pendente ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {salvo && !mudou ? 'Enviado' : 'Enviar comentário'}
          </button>
        )}
      </div>

      {erro && <p className="text-sm text-destructive">{erro}</p>}

      {observacao && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-primary">
            Resposta do professor
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{observacao}</p>
        </div>
      )}
    </section>
  )
}
