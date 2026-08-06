'use client'

import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { isoParaDateLocal } from '@/lib/calendario-celula'

/**
 * Grade mensal tradicional, para quem pensa a agenda olhando o mês inteiro em
 * vez de uma lista de próximas datas.
 *
 * Só desenha a grade e devolve o dia clicado — o que aparece embaixo é
 * responsabilidade de quem usa, porque a célula mostra a escala de uma célula e
 * a rede mostra várias. As duas telas compartilham a navegação de mês, o
 * "hoje" e a marcação dos dias com encontro.
 */

export interface DiaMarcado {
  /** "AAAA-MM-DD" */
  data: string
  /** Contador no canto da célula (posições preenchidas, células no dia…). */
  selo?: string
  /** Cheio quando o encontro já existe; contorno quando é só data projetada. */
  confirmado?: boolean
}

interface Props {
  dias: DiaMarcado[]
  selecionada: string | null
  onSelecionar: (data: string) => void
  /** "AAAA-MM-DD" de hoje no fuso da igreja. */
  hoje: string
}

const CABECALHO = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

/** "AAAA-MM" do dia. */
function mesDe(data: string): string {
  return data.slice(0, 7)
}

export function CalendarioMes({ dias, selecionada, onSelecionar, hoje }: Props) {
  const porData = useMemo(() => new Map(dias.map((d) => [d.data, d])), [dias])

  // Abre no mês da data selecionada, ou no da primeira data marcada. Cair em
  // "hoje" mostraria um mês vazio sempre que a próxima data já virou o mês.
  const [mes, setMes] = useState(() => mesDe(selecionada ?? dias[0]?.data ?? hoje))

  const semanas = useMemo(() => montarSemanas(mes), [mes])
  const rotulo = format(isoParaDateLocal(`${mes}-01`), "MMMM 'de' yyyy", { locale: ptBR })

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="flex items-center justify-between px-2 py-2 border-b border-border">
        <button
          type="button"
          onClick={() => setMes(deslocarMes(mes, -1))}
          aria-label="Mês anterior"
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-sm font-medium capitalize">{rotulo}</p>
        <button
          type="button"
          onClick={() => setMes(deslocarMes(mes, 1))}
          aria-label="Próximo mês"
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 px-1.5 pt-1.5">
        {CABECALHO.map((letra, i) => (
          <span key={i} className="text-[10px] font-medium text-muted-foreground text-center py-1">
            {letra}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5 px-1.5 pb-1.5">
        {semanas.map((data) => {
          const marcado = porData.get(data)
          const doMes = mesDe(data) === mes
          const eHoje = data === hoje
          const eSelecionada = data === selecionada

          return (
            <button
              key={data}
              type="button"
              disabled={!marcado}
              onClick={() => onSelecionar(data)}
              className={[
                'relative aspect-square rounded-lg text-xs flex flex-col items-center justify-center gap-0.5 transition-colors',
                !doMes ? 'text-muted-foreground/30' : '',
                marcado ? 'hover:bg-muted cursor-pointer font-medium' : 'text-muted-foreground/50',
                eSelecionada ? 'bg-primary text-primary-foreground hover:bg-primary' : '',
                eHoje && !eSelecionada ? 'ring-1 ring-inset ring-primary/40' : '',
              ].join(' ')}
            >
              <span>{Number(data.slice(8, 10))}</span>

              {marcado && (
                <span
                  className={[
                    'h-1.5 w-1.5 rounded-full',
                    eSelecionada
                      ? 'bg-primary-foreground'
                      : marcado.confirmado
                        ? 'bg-primary'
                        : 'border border-primary/60',
                  ].join(' ')}
                />
              )}

              {marcado?.selo && (
                <span
                  className={`absolute top-0.5 right-1 text-[8px] tabular-nums ${
                    eSelecionada ? 'text-primary-foreground/80' : 'text-muted-foreground'
                  }`}
                >
                  {marcado.selo}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export type VisaoCalendario = 'lista' | 'mes'

/** Alternador Lista/Mês. A visão padrão é escolhida por cada tela. */
export function SeletorVisao({
  visao,
  onTrocar,
}: {
  visao: VisaoCalendario
  onTrocar: (v: VisaoCalendario) => void
}) {
  return (
    <div className="inline-flex rounded-lg border border-border p-0.5 shrink-0">
      {(['lista', 'mes'] as const).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onTrocar(v)}
          className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
            visao === v
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {v === 'lista' ? 'Lista' : 'Mês'}
        </button>
      ))}
    </div>
  )
}

/** "2026-08" + 1 → "2026-09" */
function deslocarMes(mes: string, passo: number): string {
  const [ano, m] = mes.split('-').map(Number)
  const d = new Date(ano, m - 1 + passo, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Todas as datas da grade: o mês inteiro mais as pontas das semanas que
 * transbordam. Sai como "AAAA-MM-DD" para bater com as chaves do calendário —
 * a grade nunca converte fuso, senão o dia escorregaria.
 */
function montarSemanas(mes: string): string[] {
  const [ano, m] = mes.split('-').map(Number)
  const primeiro = new Date(ano, m - 1, 1)

  const inicio = new Date(primeiro)
  inicio.setDate(inicio.getDate() - inicio.getDay())

  const ultimo = new Date(ano, m, 0)
  const fim = new Date(ultimo)
  fim.setDate(fim.getDate() + (6 - fim.getDay()))

  const datas: string[] = []
  for (const d = new Date(inicio); d <= fim; d.setDate(d.getDate() + 1)) {
    const p = (n: number) => String(n).padStart(2, '0')
    datas.push(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`)
  }
  return datas
}
