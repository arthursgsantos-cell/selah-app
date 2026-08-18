'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Search, X, ChevronRight, Users, AlertTriangle, Check, Clock, MessageCircle } from 'lucide-react'
import { STATUS_ENTREGA } from '@/lib/ensino/atividades'
import type { EntregaResumo } from '@/lib/ensino/atividades-consultas'
import type { TipoAtividade } from '@/lib/supabase/types'

type Filtro = 'todos' | 'pendentes' | 'entregues' | 'corrigir' | 'atrasados'

/** Sem acento e em minúsculas, para "jose" encontrar "José". */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/**
 * O painel geral: uma linha por aluno da turma.
 *
 * Mostra quem ainda não entregou, e não só quem entregou — por isso parte dos
 * inscritos e não das entregas. É a pergunta que o professor faz na véspera do
 * encontro: quem preciso cobrar?
 *
 * O filtro "para corrigir" existe porque numa prova com dissertativa a fila do
 * professor não é "quem entregou", é "quem entregou e ainda espera nota".
 */
export function AtividadePainel({
  atividadeId, tipo, entregas,
}: {
  atividadeId: string
  tipo: TipoAtividade
  entregas: EntregaResumo[]
}) {
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todos')

  const contagem = useMemo(() => ({
    total: entregas.length,
    concluidas: entregas.filter((e) => e.concluida).length,
    corrigir: entregas.filter((e) => e.aguardandoCorrecao > 0).length,
    atrasados: entregas.filter((e) => e.leituraAtrasados > 0).length,
  }), [entregas])

  const filtradas = useMemo(() => {
    const termo = normalizar(busca.trim())
    return entregas.filter((e) => {
      if (termo && !normalizar(e.nome).includes(termo)) return false
      if (filtro === 'pendentes') return !e.concluida
      if (filtro === 'entregues') return e.concluida
      if (filtro === 'corrigir') return e.aguardandoCorrecao > 0
      if (filtro === 'atrasados') return e.leituraAtrasados > 0
      return true
    })
  }, [entregas, busca, filtro])

  const filtros: { valor: Filtro; label: string; quantos?: number }[] = [
    { valor: 'todos', label: 'Todos', quantos: contagem.total },
    { valor: 'pendentes', label: 'Não entregaram', quantos: contagem.total - contagem.concluidas },
    { valor: 'entregues', label: 'Entregaram', quantos: contagem.concluidas },
    ...(tipo === 'quiz' ? [{ valor: 'corrigir' as Filtro, label: 'Para corrigir', quantos: contagem.corrigir }] : []),
    ...(tipo === 'leitura' ? [{ valor: 'atrasados' as Filtro, label: 'Atrasados', quantos: contagem.atrasados }] : []),
  ]

  const percentual = contagem.total > 0
    ? Math.round((contagem.concluidas / contagem.total) * 100)
    : 0

  function whatsappHref(telefone: string | null): string | null {
    const numero = telefone?.replace(/\\D/g, '')
    return numero ? `https://wa.me/${numero}` : null
  }

  return (
    <div className="space-y-4">
      {/* O panorama, antes da lista. */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-end justify-between gap-2">
          <div>
            <p className="text-2xl font-bold leading-none">{percentual}%</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {contagem.concluidas} de {contagem.total} {contagem.total === 1 ? 'aluno' : 'alunos'}
            </p>
          </div>
          {contagem.corrigir > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-[11px] font-semibold text-blue-700">
              <Clock className="h-3 w-3" />
              {contagem.corrigir} para corrigir
            </span>
          )}
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percentual}%` }} />
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar aluno..."
          className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-8 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
        />
        {busca && (
          <button
            type="button"
            onClick={() => setBusca('')}
            aria-label="Limpar busca"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {filtros.map((f) => (
          <button
            key={f.valor}
            type="button"
            onClick={() => setFiltro(f.valor)}
            className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
              filtro === f.valor
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border hover:bg-accent'
            }`}
          >
            {f.label}
            {f.quantos !== undefined && <span className="ml-1 opacity-70">{f.quantos}</span>}
          </button>
        ))}
      </div>

      {filtradas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-12 text-center">
          <Users className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            {entregas.length === 0
              ? 'Nenhum aluno aprovado nesta turma ainda.'
              : 'Ninguém neste filtro.'}
          </p>
        </div>
      ) : (
        <div className="divide-y overflow-hidden rounded-2xl border border-border bg-card">
          {filtradas.map((e) => {
            const status = STATUS_ENTREGA[e.status]
            const percLeitura = e.leituraTotal > 0
              ? Math.round((e.leituraFeitos / e.leituraTotal) * 100)
              : null

            return (
              <div
                key={e.inscricaoId}
                className="flex items-center gap-2 px-3 py-2.5 transition-colors hover:bg-accent"
              >
                <Link
                  href={`/ensino/atividade/${atividadeId}/painel/${e.inscricaoId}`}
                  className="flex min-w-0 flex-1 items-center gap-3"
                >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    e.concluida ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {e.concluida ? <Check className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium leading-tight">{e.nome}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className={`rounded-full px-1.5 py-0.5 font-medium ${status.classe}`}>
                      {status.label}
                    </span>
                    {e.nota !== null && (
                      <span className="font-semibold text-muted-foreground">{e.nota} pts</span>
                    )}
                    {e.aguardandoCorrecao > 0 && (
                      <span className="font-medium text-blue-700">
                        {e.aguardandoCorrecao} para corrigir
                      </span>
                    )}
                    {e.leituraAtrasados > 0 && (
                      <span className="inline-flex items-center gap-0.5 font-medium text-amber-700">
                        <AlertTriangle className="h-2.5 w-2.5" />
                        {e.leituraAtrasados} atrasada{e.leituraAtrasados > 1 ? 's' : ''}
                      </span>
                    )}
                    {e.comentario && (
                      <span className="italic text-muted-foreground">deixou comentário</span>
                    )}
                  </div>

                  {percLeitura !== null && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full ${
                            e.leituraAtrasados > 0 ? 'bg-amber-500' : 'bg-primary'
                          }`}
                          style={{ width: `${percLeitura}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-medium text-muted-foreground">
                        {e.leituraFeitos}/{e.leituraTotal}
                      </span>
                    </div>
                  )}
                </div>

                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
                {whatsappHref(e.telefone) && (
                  <a
                    href={whatsappHref(e.telefone)!}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Falar com ${e.nome} no WhatsApp`}
                    title="Falar no WhatsApp"
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700 transition-colors hover:bg-green-200"
                  >
                    <MessageCircle className="h-4 w-4" />
                  </a>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
