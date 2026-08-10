'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Search, X, ChevronRight, Users } from 'lucide-react'
import { corFrequencia } from '@/lib/ensino/turma'

export interface AlunoLinha {
  slug: string
  nome: string
  avatarUrl: string | null
  /** Falso no aluno que o professor cadastrou e que ainda não entrou no app. */
  temConta: boolean
  celula: string | null
  cursos: string[]
  ativas: number
  concluidas: number
  pendentes: number
  percentual: number | null
  registros: number
}

type Ordem = 'nome' | 'frequencia' | 'cursos'

const ORDENS: { valor: Ordem; label: string }[] = [
  { valor: 'nome', label: 'Nome' },
  { valor: 'frequencia', label: 'Frequência' },
  { valor: 'cursos', label: 'Cursos' },
]

/** Sem acento e em minúsculas, para "jose" encontrar "José". */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function iniciais(nome: string): string {
  return nome.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
}

/**
 * Tabela de todos os alunos do Ensino.
 *
 * Busca e ordenação são do lado do cliente de propósito: a lista é a igreja
 * inteira que já passou por um curso — dezenas, não milhares — e filtrar sem
 * ida ao servidor deixa a digitação instantânea. Se um dia crescer a ponto de
 * pesar, a paginação entra no servidor como em `/usuarios`.
 */
export function AlunosTabela({ alunos }: { alunos: AlunoLinha[] }) {
  const [busca, setBusca] = useState('')
  const [curso, setCurso] = useState('')
  const [ordem, setOrdem] = useState<Ordem>('nome')

  const cursos = useMemo(
    () => [...new Set(alunos.flatMap((a) => a.cursos))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [alunos]
  )

  const filtrados = useMemo(() => {
    const termo = normalizar(busca.trim())

    const lista = alunos.filter((a) => {
      if (curso && !a.cursos.includes(curso)) return false
      if (!termo) return true
      return (
        normalizar(a.nome).includes(termo) ||
        normalizar(a.celula ?? '').includes(termo) ||
        a.cursos.some((c) => normalizar(c).includes(termo))
      )
    })

    return lista.sort((a, b) => {
      if (ordem === 'frequencia') {
        // Quem ainda não tem chamada fica no fim, e não no topo com "0%".
        const pa = a.percentual ?? -1
        const pb = b.percentual ?? -1
        if (pa !== pb) return pb - pa
      }
      if (ordem === 'cursos') {
        const ca = a.ativas + a.concluidas
        const cb = b.ativas + b.concluidas
        if (ca !== cb) return cb - ca
      }
      return a.nome.localeCompare(b.nome, 'pt-BR')
    })
  }, [alunos, busca, curso, ordem])

  const comPendencia = alunos.filter((a) => a.pendentes > 0).length

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, célula ou curso..."
            className="w-full h-9 rounded-lg border border-input bg-background pl-9 pr-8 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
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

        {cursos.length > 1 && (
          <select
            value={curso}
            onChange={(e) => setCurso(e.target.value)}
            aria-label="Filtrar por curso"
            className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring sm:w-56"
          >
            <option value="">Todos os cursos</option>
            {cursos.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-muted-foreground">
          {filtrados.length} {filtrados.length === 1 ? 'aluno' : 'alunos'}
          {filtrados.length !== alunos.length && ` de ${alunos.length}`}
          {comPendencia > 0 && !busca && !curso && (
            <span className="text-amber-700 font-medium">
              {' '}· {comPendencia} com pedido pendente
            </span>
          )}
        </p>

        <div className="flex items-center gap-1">
          <span className="text-[11px] text-muted-foreground uppercase tracking-widest mr-1">
            Ordenar
          </span>
          {ORDENS.map((o) => (
            <button
              key={o.valor}
              type="button"
              onClick={() => setOrdem(o.valor)}
              className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${
                ordem === o.valor
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border hover:bg-accent'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {filtrados.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-12 text-center">
          <Users className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            {alunos.length === 0
              ? 'Ninguém se inscreveu em uma turma ainda.'
              : 'Nenhum aluno encontrado com esse filtro.'}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          {/* Cabeçalho da tabela: some no celular, onde cada linha já se explica. */}
          <div className="hidden sm:flex items-center gap-3 px-3 py-2 border-b bg-muted/40 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            <span className="min-w-0 flex-1">Aluno</span>
            <span className="w-36 hidden md:block">Célula</span>
            <span className="w-24 text-center">Cursos</span>
            <span className="w-20 text-right">Frequência</span>
            <span className="w-4" />
          </div>

          <div className="divide-y">
            {filtrados.map((a) => (
              <Link
                key={a.slug}
                href={`/ensino/alunos/${a.slug}`}
                className="flex items-center gap-3 px-3 py-2.5 hover:bg-accent transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="h-8 w-8 shrink-0 rounded-full bg-muted text-muted-foreground overflow-hidden flex items-center justify-center text-[11px] font-bold">
                    {a.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        referrerPolicy="no-referrer"
                        src={a.avatarUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      iniciais(a.nome)
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-tight truncate">
                      {a.nome}
                      {a.pendentes > 0 && (
                        <span className="ml-1.5 align-middle text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                          pendente
                        </span>
                      )}
                    </p>
                    {/* No celular as colunas viram esta segunda linha. */}
                    <p className="text-[11px] text-muted-foreground truncate md:hidden">
                      {[
                        a.celula,
                        `${a.ativas + a.concluidas} ${a.ativas + a.concluidas === 1 ? 'curso' : 'cursos'}`,
                        a.temConta ? null : 'sem conta',
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                </div>

                <span className="w-36 hidden md:block text-xs text-muted-foreground truncate">
                  {/* Sem conta não tem célula para mostrar — o app só sabe o
                      que o professor digitou. */}
                  {a.temConta ? (a.celula ?? '—') : <span className="italic">sem conta no app</span>}
                </span>

                <span className="w-24 text-center hidden sm:block">
                  <span className="text-sm font-semibold">{a.ativas + a.concluidas}</span>
                  {a.concluidas > 0 && (
                    <span className="block text-[10px] text-muted-foreground leading-tight">
                      {a.concluidas} concluído{a.concluidas > 1 ? 's' : ''}
                    </span>
                  )}
                </span>

                <span className={`w-20 text-right text-sm font-semibold ${corFrequencia(a.percentual)}`}>
                  {a.percentual === null ? '—' : `${a.percentual}%`}
                </span>

                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
