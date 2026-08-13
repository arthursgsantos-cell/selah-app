'use client'

import { useMemo, useState } from 'react'
import { Check, X, Minus, Search, Users } from 'lucide-react'
import { corFrequencia, dataBr } from '@/lib/ensino/turma'
import type { StatusAula } from '@/lib/supabase/types'

export interface AulaColuna {
  id: string
  numero: number
  data: string
  status: StatusAula
}

export interface LinhaPresenca {
  id: string
  nome: string
  presentes: number
  /** Chamadas registradas para esta pessoa — só de aulas realizadas. */
  total: number
  /** Null enquanto não houve nenhuma chamada; zero seria mentira diferente. */
  percentual: number | null
}

interface Props {
  aulas: AulaColuna[]
  linhas: LinhaPresenca[]
  /** Chave "aulaId|inscricaoId" → presente. Um Map não atravessa o servidor. */
  marcacoes: Record<string, boolean>
}

/**
 * Faixas de risco, e não quartis.
 *
 * O corte em 75% é o que a secretaria já usa para decidir aprovação, e o de 50%
 * marca quem praticamente parou de vir. Uma faixa "sem registro" à parte evita
 * que quem nunca teve chamada apareça junto de quem falta.
 */
type Faixa = 'todas' | 'critica' | 'risco' | 'boa' | 'sem'

const FAIXAS: { valor: Faixa; label: string }[] = [
  { valor: 'todas', label: 'Todos' },
  { valor: 'critica', label: 'Abaixo de 50%' },
  { valor: 'risco', label: '50 a 74%' },
  { valor: 'boa', label: '75% ou mais' },
  { valor: 'sem', label: 'Sem registro' },
]

type Ordem = 'nome' | 'pior' | 'melhor'

const ORDENS: { valor: Ordem; label: string }[] = [
  { valor: 'nome', label: 'Nome' },
  { valor: 'pior', label: 'Menor frequência' },
  { valor: 'melhor', label: 'Maior frequência' },
]

/** Sem acento e em minúsculas, para "jose" encontrar "José". */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function naFaixa(percentual: number | null, faixa: Faixa): boolean {
  if (faixa === 'todas') return true
  if (percentual === null) return faixa === 'sem'
  if (faixa === 'sem') return false
  if (faixa === 'critica') return percentual < 50
  if (faixa === 'risco') return percentual >= 50 && percentual < 75
  return percentual >= 75
}

/**
 * A grade de frequência da turma, com busca e filtros.
 *
 * Vira componente de cliente por causa dos filtros, e não por causa dos dados:
 * a turma tem dezenas de alunos e uma dúzia de aulas, então filtrar em memória
 * deixa a digitação instantânea e evita uma ida ao servidor por tecla — a
 * mesma escolha de `alunos-tabela.tsx`.
 *
 * Esconder as aulas futuras é o padrão: elas ocupam metade da largura no meio
 * do semestre e não têm nada para mostrar, mas continuam disponíveis para quem
 * quiser conferir o calendário inteiro.
 */
export function PresencasTabela({ aulas, linhas, marcacoes }: Props) {
  const [busca, setBusca] = useState('')
  const [faixa, setFaixa] = useState<Faixa>('todas')
  const [ordem, setOrdem] = useState<Ordem>('nome')
  const [mostrarFuturas, setMostrarFuturas] = useState(false)

  const realizadas = useMemo(() => aulas.filter((a) => a.status === 'realizada'), [aulas])
  const colunas = mostrarFuturas ? aulas : realizadas
  const futuras = aulas.length - realizadas.length

  const filtradas = useMemo(() => {
    const termo = normalizar(busca.trim())

    const lista = linhas.filter((l) => {
      if (!naFaixa(l.percentual, faixa)) return false
      if (!termo) return true
      return normalizar(l.nome).includes(termo)
    })

    return [...lista].sort((a, b) => {
      if (ordem !== 'nome') {
        // Quem não tem chamada fica sempre no fim: não é o pior nem o melhor
        // aluno da turma, é o aluno de quem ainda não se sabe nada.
        const pa = a.percentual
        const pb = b.percentual
        if (pa === null && pb !== null) return 1
        if (pb === null && pa !== null) return -1
        if (pa !== null && pb !== null && pa !== pb) {
          return ordem === 'pior' ? pa - pb : pb - pa
        }
      }
      return a.nome.localeCompare(b.nome, 'pt-BR')
    })
  }, [linhas, busca, faixa, ordem])

  const filtrando = busca.trim() !== '' || faixa !== 'todas'

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
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

        <select
          value={faixa}
          onChange={(e) => setFaixa(e.target.value as Faixa)}
          aria-label="Filtrar por frequência"
          className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring sm:w-48"
        >
          {FAIXAS.map((f) => (
            <option key={f.valor} value={f.valor}>{f.label}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {filtradas.length} {filtradas.length === 1 ? 'aluno' : 'alunos'}
          {filtradas.length !== linhas.length && ` de ${linhas.length}`}
          {' · '}
          {realizadas.length} de {aulas.length} aulas realizadas
        </p>

        <div className="flex items-center gap-1">
          <span className="mr-1 text-[11px] uppercase tracking-widest text-muted-foreground">
            Ordenar
          </span>
          {ORDENS.map((o) => (
            <button
              key={o.valor}
              type="button"
              onClick={() => setOrdem(o.valor)}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                ordem === o.valor
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border hover:bg-accent'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {futuras > 0 && (
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={mostrarFuturas}
            onChange={(e) => setMostrarFuturas(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-input accent-primary"
          />
          Mostrar também as {futuras} {futuras === 1 ? 'aula ainda não realizada' : 'aulas ainda não realizadas'}
        </label>
      )}

      {filtradas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-12 text-center">
          <Users className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Nenhum aluno com esse filtro.</p>
        </div>
      ) : (
        /* A tabela rola sozinha na horizontal: com 12 aulas ela não cabe na tela
           do celular, e deixar a página inteira rolar de lado atrapalharia. */
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="sticky left-0 z-10 min-w-[10rem] bg-muted/50 px-3 py-2 text-left font-medium">
                  Aluno
                </th>
                {colunas.map((a) => (
                  <th
                    key={a.id}
                    className={`min-w-[3rem] px-2 py-2 text-center font-medium ${
                      a.status === 'realizada' ? '' : 'opacity-50'
                    }`}
                  >
                    <div className="text-xs">{a.numero}</div>
                    <div className="text-[10px] font-normal text-muted-foreground">
                      {dataBr(a.data).slice(0, 5)}
                    </div>
                  </th>
                ))}
                <th className="min-w-[5rem] px-3 py-2 text-right font-medium">Frequência</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtradas.map((linha) => (
                <tr key={linha.id}>
                  <td className="sticky left-0 z-10 max-w-[12rem] truncate bg-background px-3 py-2">
                    {linha.nome}
                  </td>
                  {colunas.map((a) => {
                    const valor = marcacoes[`${a.id}|${linha.id}`]
                    return (
                      <td key={a.id} className="px-2 py-2 text-center">
                        {valor === true ? (
                          <Check className="mx-auto h-4 w-4 text-green-600" />
                        ) : valor === false ? (
                          <X className="mx-auto h-4 w-4 text-red-500" />
                        ) : (
                          <Minus className="mx-auto h-3 w-3 text-muted-foreground/30" />
                        )}
                      </td>
                    )
                  })}
                  <td className={`px-3 py-2 text-right font-semibold ${corFrequencia(linha.percentual)}`}>
                    {linha.percentual === null ? '—' : `${linha.percentual}%`}
                    <span className="block text-[10px] font-normal text-muted-foreground">
                      {linha.presentes}/{linha.total}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Check className="h-3.5 w-3.5 text-green-600" /> presente
        </span>
        <span className="flex items-center gap-1">
          <X className="h-3.5 w-3.5 text-red-500" /> falta
        </span>
        <span className="flex items-center gap-1">
          <Minus className="h-3 w-3 text-muted-foreground/40" /> sem registro
        </span>
        {filtrando && (
          <span className="ml-auto">
            O percentual não muda com o filtro — ele é sempre sobre todas as aulas realizadas.
          </span>
        )}
      </div>
    </div>
  )
}
