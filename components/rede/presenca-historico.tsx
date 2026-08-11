import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { TrendingDown, TrendingUp, Minus, BarChart3 } from 'lucide-react'
import {
  rotuloPeriodo,
  variacao,
  type Granularidade,
  type PontoSerie,
} from '@/lib/saude-rede'

interface Props {
  serie: PontoSerie[]
  granularidade: Granularidade
  /** Rota da página que mostra o gráfico — as abas voltam para ela com `?periodo=`. */
  basePath: string
}

const ABAS: { valor: Granularidade; label: string }[] = [
  { valor: 'semana', label: 'Semana' },
  { valor: 'mes', label: 'Mês' },
  { valor: 'ano', label: 'Ano' },
]

export function PresencaHistorico({ serie, granularidade, basePath }: Props) {
  const maior = Math.max(1, ...serie.map((p) => p.total))
  const variou = variacao(serie)

  // O período corrente ainda está acontecendo: aparece no gráfico, mas
  // esmaecido, para ninguém ler meia semana como queda.
  const indiceCorrente = serie.length - 1

  return (
    <Card>
      <CardContent className="py-4 px-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold">Presença</p>
            {variou === null ? (
              <p className="text-xs text-muted-foreground mt-0.5">
                Ainda sem histórico para comparar
              </p>
            ) : (
              <p className="text-xs mt-0.5 flex items-center gap-1">
                {variou > 0 && <TrendingUp className="h-3.5 w-3.5 text-green-600" />}
                {variou < 0 && <TrendingDown className="h-3.5 w-3.5 text-red-500" />}
                {variou === 0 && <Minus className="h-3.5 w-3.5 text-muted-foreground" />}
                <span
                  className={
                    variou > 0 ? 'text-green-600' : variou < 0 ? 'text-red-500' : 'text-muted-foreground'
                  }
                >
                  {variou > 0 ? '+' : ''}{variou}%
                </span>
                <span className="text-muted-foreground">
                  {granularidade === 'ano' ? 'ano' : granularidade === 'mes' ? 'mês' : 'semana'} passado
                </span>
              </p>
            )}
          </div>

          <div className="flex gap-1 shrink-0 rounded-lg bg-muted p-0.5">
            {ABAS.map((aba) => (
              <Link
                key={aba.valor}
                href={`${basePath}?periodo=${aba.valor}`}
                scroll={false}
                className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
                  aba.valor === granularidade
                    ? 'bg-background font-semibold shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {aba.label}
              </Link>
            ))}
          </div>
        </div>

        {serie.length === 0 ? (
          <div className="py-8 text-center">
            <BarChart3 className="h-9 w-9 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              Nenhum encontro registrado ainda no período
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-end gap-1.5 h-32">
              {serie.map((p, i) => {
                const alturaMembros = ((p.membros + p.conjuges) / maior) * 100
                const alturaVisitantes = (p.visitantes / maior) * 100
                const corrente = i === indiceCorrente
                return (
                  <div key={p.inicio} className="flex-1 flex flex-col justify-end h-full group relative">
                    <div
                      className={`w-full rounded-t-sm bg-emerald-400 ${corrente ? 'opacity-40' : ''}`}
                      style={{ height: `${alturaVisitantes}%` }}
                    />
                    <div
                      className={`w-full bg-primary ${
                        alturaVisitantes === 0 ? 'rounded-t-sm' : ''
                      } ${corrente ? 'opacity-40' : ''}`}
                      style={{ height: `${alturaMembros}%` }}
                    />
                    {/* Tooltip só no hover: no celular o número já está na legenda abaixo. */}
                    <div className="pointer-events-none absolute -top-1 left-1/2 -translate-x-1/2 -translate-y-full opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      <div className="whitespace-nowrap rounded-lg bg-foreground text-background text-[10px] px-2 py-1 shadow-lg">
                        {p.total} {p.total === 1 ? 'pessoa' : 'pessoas'}
                        {p.visitantes > 0 && ` · ${p.visitantes} visit.`}
                        <br />
                        {p.encontros} {p.encontros === 1 ? 'encontro' : 'encontros'}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="flex gap-1.5">
              {serie.map((p) => (
                <p
                  key={p.inicio}
                  className="flex-1 text-center text-[10px] text-muted-foreground truncate"
                >
                  {rotuloPeriodo(p.inicio, granularidade)}
                </p>
              ))}
            </div>

            <div className="flex items-center gap-4 pt-1 border-t border-border">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-sm bg-primary" />
                Membros
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-sm bg-emerald-400" />
                Visitantes
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
