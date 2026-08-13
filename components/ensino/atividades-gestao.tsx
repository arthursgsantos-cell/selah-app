'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  BookOpen, ClipboardList, FileQuestion, Loader2, Plus, X, CalendarClock,
  EyeOff, ChevronRight,
} from 'lucide-react'
import { criarAtividadeAction } from '@/app/actions/ensino/atividades'
import { textoPrazo, TIPO_ATIVIDADE } from '@/lib/ensino/atividades'
import type { AtividadeResumo } from '@/lib/ensino/atividades-consultas'
import type { TipoAtividade } from '@/lib/supabase/types'

const ICONE: Record<TipoAtividade, React.ComponentType<{ className?: string }>> = {
  tarefa: ClipboardList,
  leitura: BookOpen,
  quiz: FileQuestion,
}

const ORDEM_TIPOS: TipoAtividade[] = ['tarefa', 'leitura', 'quiz']

interface Props {
  turmaId: string
  atividades: (AtividadeResumo & {
    entregues: number
    total: number
    aguardandoCorrecao: number
  })[]
}

/**
 * A lista de atividades da turma, do lado de quem leciona.
 *
 * Cada linha mostra o que o professor pergunta ao bater o olho: quantos já
 * entregaram e quantos esperam correção. O rascunho fica na mesma lista, com
 * a marca de não publicado — separá-lo em outra aba faria a atividade que se
 * está montando sumir de vista.
 */
export function AtividadesGestao({ turmaId, atividades }: Props) {
  const router = useRouter()
  const [criando, setCriando] = useState(false)
  const [tipo, setTipo] = useState<TipoAtividade>('tarefa')
  const [titulo, setTitulo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  function criar() {
    if (!titulo.trim()) { setErro('Dê um título à atividade.'); return }
    setErro(null)
    iniciar(async () => {
      const r = await criarAtividadeAction(turmaId, { tipo, titulo })
      if (!r.ok) { setErro(r.erro); return }
      setCriando(false)
      setTitulo('')
      // Direto para o editor: recém-criada, ela ainda não tem nada dentro.
      if (r.id) router.push(`/ensino/atividade/${r.id}/editar`)
      else router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      {criando ? (
        <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Nova atividade</h2>
            <button
              type="button"
              onClick={() => { setCriando(false); setErro(null) }}
              aria-label="Cancelar"
              className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-accent"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            {ORDEM_TIPOS.map((t) => {
              const Icone = ICONE[t]
              const meta = TIPO_ATIVIDADE[t]
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTipo(t)}
                  className={`rounded-xl border p-3 text-left transition-colors ${
                    tipo === t ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent'
                  }`}
                >
                  <Icone className={`h-4 w-4 ${tipo === t ? 'text-primary' : 'text-muted-foreground'}`} />
                  <p className="mt-1.5 text-xs font-semibold">{meta.label}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                    {meta.descricao}
                  </p>
                </button>
              )
            })}
          </div>

          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && criar()}
            placeholder={
              tipo === 'leitura'
                ? 'Ex.: Ler a carta de Tiago 30 vezes'
                : tipo === 'quiz'
                  ? 'Ex.: Prova da unidade 1'
                  : 'Ex.: Questões do capítulo 3'
            }
            aria-label="Título da atividade"
            className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
          />

          {erro && <p className="text-sm text-destructive">{erro}</p>}

          <button
            type="button"
            onClick={criar}
            disabled={pendente}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pendente ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Criar e montar
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCriando(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-2 text-sm font-medium transition-colors hover:bg-accent"
        >
          <Plus className="h-4 w-4" />
          Nova atividade
        </button>
      )}

      {atividades.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-12 text-center">
          <ClipboardList className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Nenhuma atividade nesta turma.</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground/70 leading-relaxed">
            É o que a turma faz entre um encontro e outro: a tarefa do livro, um
            desafio de leitura bíblica com cronograma, ou uma prova.
          </p>
        </div>
      ) : (
        <div className="divide-y overflow-hidden rounded-2xl border border-border bg-card">
          {atividades.map((a) => {
            const Icone = ICONE[a.tipo]
            const prazo = textoPrazo(a.prazo)
            const percentual = a.total > 0 ? Math.round((a.entregues / a.total) * 100) : 0

            return (
              <Link
                key={a.id}
                href={`/ensino/atividade/${a.id}/painel`}
                className="flex items-center gap-3 px-3 py-3 transition-colors hover:bg-accent"
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                    a.publicada ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  <Icone className="h-4 w-4" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold leading-tight">
                    {a.titulo}
                    {!a.publicada && (
                      <span className="ml-1.5 inline-flex items-center gap-0.5 align-middle text-[10px] font-medium text-muted-foreground">
                        <EyeOff className="h-2.5 w-2.5" />
                        rascunho
                      </span>
                    )}
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span>{TIPO_ATIVIDADE[a.tipo].label}</span>
                    {prazo && (
                      <span
                        className={`inline-flex items-center gap-0.5 ${
                          prazo.vencido ? 'text-red-600' : prazo.urgente ? 'text-amber-700' : ''
                        }`}
                      >
                        · <CalendarClock className="h-2.5 w-2.5" />
                        {prazo.texto}
                      </span>
                    )}
                    {a.aguardandoCorrecao > 0 && (
                      <span className="font-medium text-blue-700">
                        · {a.aguardandoCorrecao} para corrigir
                      </span>
                    )}
                  </div>

                  {a.publicada && a.total > 0 && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${percentual}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-medium text-muted-foreground">
                        {a.entregues}/{a.total}
                      </span>
                    </div>
                  )}
                </div>

                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
