'use client'

import { useMemo, useState } from 'react'
import { Search, Printer, X, BarChart3, TableIcon, Filter } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { distribuicao, type RegistroInscricao } from '@/lib/inscricoes-relatorio'

interface Props {
  colunas: string[]
  registros: RegistroInscricao[]
  colunasCategoricas: string[]
  eventoTitulo: string
}

/** Cores dos gráficos. Ciclo curto: acima disso vira arco-íris ilegível. */
const CORES = ['#0F52BA', '#22c55e', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#64748b']

/**
 * Relatório de inscrições: filtros, gráficos e tabela.
 *
 * Gráficos e tabela leem a MESMA lista filtrada — filtrar por "Suíte" refaz
 * os gráficos junto. Um painel em que o gráfico ignora o filtro da tabela é
 * pior que não ter gráfico, porque os dois números discordam na tela.
 *
 * Sem biblioteca de gráfico: são barras proporcionais em CSS. Traz o que essa
 * tela precisa sem somar 100 kB ao bundle de todo mundo.
 */
export function RelatorioInscricoes({
  colunas,
  registros,
  colunasCategoricas,
  eventoTitulo,
}: Props) {
  const [busca, setBusca] = useState('')
  const [filtros, setFiltros] = useState<Record<string, string>>({})
  const [colunasVisiveis, setColunasVisiveis] = useState<string[]>(() => colunas.slice(0, 6))
  const [mostrarColunas, setMostrarColunas] = useState(false)

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return registros.filter((r) => {
      for (const [coluna, valor] of Object.entries(filtros)) {
        if (!valor) continue
        if ((r.valores[coluna] ?? '').trim() !== valor) return false
      }
      if (!termo) return true
      return Object.values(r.valores).some((v) => v.toLowerCase().includes(termo))
    })
  }, [registros, busca, filtros])

  const filtrosAtivos = Object.entries(filtros).filter(([, v]) => v)

  function alternarColuna(coluna: string) {
    setColunasVisiveis((atual) =>
      atual.includes(coluna) ? atual.filter((c) => c !== coluna) : [...atual, coluna]
    )
  }

  return (
    <div className="space-y-5">
      {/* Barra de ações — fora do PDF */}
      <div className="nao-imprimir space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[12rem] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar em qualquer campo..."
              className="pl-8"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setMostrarColunas((v) => !v)}
            aria-expanded={mostrarColunas}
          >
            <TableIcon className="h-4 w-4" />
            Colunas ({colunasVisiveis.length})
          </Button>

          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Exportar PDF
          </Button>
        </div>

        {mostrarColunas && (
          <div className="flex flex-wrap gap-1.5 rounded-xl border border-border bg-muted/40 p-3">
            {colunas.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => alternarColuna(c)}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                  colunasVisiveis.includes(c)
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border hover:bg-accent'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        {/* Filtros por resposta */}
        {colunasCategoricas.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            {colunasCategoricas.map((coluna) => {
              const opcoes = distribuicao(registros, coluna)
              return (
                <select
                  key={coluna}
                  value={filtros[coluna] ?? ''}
                  onChange={(e) => setFiltros((f) => ({ ...f, [coluna]: e.target.value }))}
                  aria-label={`Filtrar por ${coluna}`}
                  className="h-8 max-w-[12rem] rounded-lg border border-input bg-background px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  <option value="">{coluna}: todos</option>
                  {opcoes.map((o) => (
                    <option key={o.rotulo} value={o.rotulo === '—' ? '' : o.rotulo}>
                      {o.rotulo} ({o.quantidade})
                    </option>
                  ))}
                </select>
              )
            })}
            {filtrosAtivos.length > 0 && (
              <button
                type="button"
                onClick={() => setFiltros({})}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
                limpar
              </button>
            )}
          </div>
        )}
      </div>

      {/* Cabeçalho que só aparece no PDF */}
      <div className="hidden print:block">
        <h1 className="text-lg font-bold">{eventoTitulo} — inscrições</h1>
        <p className="text-xs text-muted-foreground">
          {filtrados.length} de {registros.length} registros
          {filtrosAtivos.length > 0 &&
            ` · filtros: ${filtrosAtivos.map(([c, v]) => `${c} = ${v}`).join('; ')}`}
          {' · '}gerado em {new Date().toLocaleString('pt-BR')}
        </p>
      </div>

      <p className="text-sm text-muted-foreground nao-imprimir">
        Mostrando <strong className="text-foreground">{filtrados.length}</strong> de{' '}
        {registros.length} inscrições
      </p>

      {/* Gráficos */}
      {colunasCategoricas.length > 0 && filtrados.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Distribuição</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {colunasCategoricas.slice(0, 6).map((coluna) => (
              <Grafico
                key={coluna}
                titulo={coluna}
                dados={distribuicao(filtrados, coluna)}
                total={filtrados.length}
              />
            ))}
          </div>
        </section>
      )}

      {/* Tabela */}
      <section className="space-y-2">
        <div className="flex items-center gap-2 nao-imprimir">
          <TableIcon className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Inscritos</h2>
        </div>

        {filtrados.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border py-10 text-center">
            <p className="text-sm text-muted-foreground">
              {registros.length === 0
                ? 'Nenhuma inscrição ainda.'
                : 'Nenhum registro com esses filtros.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-muted/50 text-left">
                  <th className="px-2 py-2 font-medium">#</th>
                  {colunasVisiveis.map((c) => (
                    <th key={c} className="whitespace-nowrap px-3 py-2 font-medium">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtrados.map((r, i) => (
                  <tr key={r.id} className="align-top">
                    <td className="px-2 py-2 text-xs text-muted-foreground">{i + 1}</td>
                    {colunasVisiveis.map((c) => (
                      <td key={c} className="px-3 py-2">
                        {r.valores[c] || <span className="text-muted-foreground/40">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function Grafico({
  titulo,
  dados,
  total,
}: {
  titulo: string
  dados: { rotulo: string; quantidade: number }[]
  total: number
}) {
  return (
    <div className="quebra-evitar rounded-2xl border border-border bg-card p-3">
      <p className="mb-2 truncate text-xs font-semibold text-muted-foreground uppercase tracking-widest">
        {titulo}
      </p>
      <div className="space-y-1.5">
        {dados.map((d, i) => {
          const pct = total > 0 ? Math.round((d.quantidade / total) * 100) : 0
          return (
            <div key={d.rotulo}>
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="truncate" title={d.rotulo}>{d.rotulo}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {d.quantidade} · {pct}%
                </span>
              </div>
              <div className="mt-0.5 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, backgroundColor: CORES[i % CORES.length] }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
