'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BookOpen, Check, Loader2, AlertTriangle, CalendarDays } from 'lucide-react'
import { marcarLeituraAction } from '@/app/actions/ensino/atividades'
import { hojeIso } from '@/lib/ensino/atividades'

export interface ItemCronograma {
  id: string
  ordem: number
  rotulo: string
  livroSigla: string | null
  capituloInicio: number | null
  rodada: number
  dataPrevista: string | null
  feito: boolean
}

interface Props {
  atividadeId: string
  itens: ItemCronograma[]
  /** Total de voltas do desafio. Acima de 1 a lista ganha cabeçalho por rodada. */
  repeticoes: number
}

/** "13/08" a partir de `yyyy-mm-dd`, sem passar por Date. */
function dataCurta(iso: string): string {
  const [, mes, dia] = iso.split('-')
  return `${dia}/${mes}`
}

/**
 * O checklist do desafio de leitura.
 *
 * A lista inteira de uma vez seria assustadora — 150 linhas nas trinta voltas
 * em Tiago —, então ela abre no ponto em que o aluno está: o que venceu e não
 * foi lido, o de hoje, e o que vem depois. O resto fica atrás de "ver tudo".
 *
 * Cada toque grava sozinho, com a interface otimista, pela mesma razão da
 * chamada: quem lê no ônibus não volta para conferir se salvou.
 */
export function AtividadeLeitura({ atividadeId, itens, repeticoes }: Props) {
  const router = useRouter()
  const [marcados, setMarcados] = useState<Record<string, boolean>>(
    Object.fromEntries(itens.map((i) => [i.id, i.feito]))
  )
  const [salvando, setSalvando] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [tudo, setTudo] = useState(false)
  const [, iniciar] = useTransition()

  const hoje = hojeIso()

  const feitos = useMemo(
    () => itens.filter((i) => marcados[i.id]).length,
    [itens, marcados]
  )
  const atrasados = useMemo(
    () => itens.filter((i) => !marcados[i.id] && i.dataPrevista !== null && i.dataPrevista < hoje).length,
    [itens, marcados, hoje]
  )
  const percentual = itens.length > 0 ? Math.round((feitos / itens.length) * 100) : 0

  /**
   * A janela que aparece fechada: tudo o que está pendente e vencido, mais os
   * próximos sete dias. Sem prazo, os dez primeiros por fazer.
   */
  const visiveis = useMemo(() => {
    if (tudo) return itens

    const pendentes = itens.filter((i) => !marcados[i.id])
    if (pendentes.length === 0) return itens.slice(-5)

    const comData = pendentes.filter((i) => i.dataPrevista !== null)
    if (comData.length === 0) return pendentes.slice(0, 10)

    const limite = new Date()
    limite.setDate(limite.getDate() + 7)
    const teto = `${limite.getFullYear()}-${String(limite.getMonth() + 1).padStart(2, '0')}-${String(limite.getDate()).padStart(2, '0')}`

    const janela = comData.filter((i) => i.dataPrevista! <= teto)
    return janela.length > 0 ? janela : pendentes.slice(0, 5)
  }, [itens, marcados, tudo])

  function alternar(item: ItemCronograma) {
    const proximo = !marcados[item.id]
    setMarcados((m) => ({ ...m, [item.id]: proximo }))
    setSalvando(item.id)
    setErro(null)
    iniciar(async () => {
      const r = await marcarLeituraAction(atividadeId, item.id, proximo)
      setSalvando(null)
      if (!r.ok) {
        setMarcados((m) => ({ ...m, [item.id]: !proximo }))
        setErro(r.erro)
        return
      }
      router.refresh()
    })
  }

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Seu cronograma</h2>
        </div>
        <span className="text-xs font-medium text-muted-foreground">
          {feitos} de {itens.length}
        </span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${percentual}%` }}
        />
      </div>

      {atrasados > 0 && (
        <p className="flex items-center gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {atrasados} {atrasados === 1 ? 'leitura atrasada' : 'leituras atrasadas'}. Dá para
          recuperar marcando as de trás.
        </p>
      )}

      {erro && <p className="text-sm text-destructive">{erro}</p>}

      <ul className="space-y-1.5">
        {visiveis.map((item) => {
          const feito = marcados[item.id]
          const atrasado = !feito && item.dataPrevista !== null && item.dataPrevista < hoje
          const eHoje = item.dataPrevista === hoje

          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => alternar(item)}
                disabled={salvando === item.id}
                className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors disabled:opacity-60 ${
                  feito
                    ? 'border-green-600/30 bg-green-50/60'
                    : atrasado
                      ? 'border-amber-500/40 bg-amber-50/60 hover:bg-amber-50'
                      : eHoje
                        ? 'border-primary/40 bg-primary/5 hover:bg-primary/10'
                        : 'border-border hover:bg-accent'
                }`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
                    feito ? 'border-green-600 bg-green-600 text-white' : 'border-muted-foreground/30'
                  }`}
                >
                  {salvando === item.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    feito && <Check className="h-3.5 w-3.5" />
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span
                    className={`block text-sm font-medium leading-tight ${feito ? 'text-muted-foreground line-through' : ''}`}
                  >
                    {item.rotulo}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    {item.dataPrevista && (
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        {eHoje ? 'Hoje' : dataCurta(item.dataPrevista)}
                      </span>
                    )}
                    {repeticoes > 1 && <span>· {item.rodada}ª volta</span>}
                    {atrasado && <span className="font-medium text-amber-700">· atrasada</span>}
                  </span>
                </span>

                {/* O atalho para o texto, quando a Bíblia já tem o livro. */}
                {item.livroSigla && item.capituloInicio && (
                  <Link
                    href={`/biblia/${item.livroSigla}/${item.capituloInicio}`}
                    onClick={(e) => e.stopPropagation()}
                    className="shrink-0 rounded-lg border border-border px-2 py-1 text-[11px] font-medium transition-colors hover:bg-background"
                  >
                    Ler
                  </Link>
                )}
              </button>
            </li>
          )
        })}
      </ul>

      {itens.length > visiveis.length && (
        <button
          type="button"
          onClick={() => setTudo((t) => !t)}
          className="w-full rounded-xl border border-border py-2 text-xs font-medium transition-colors hover:bg-accent"
        >
          {tudo ? 'Mostrar só o que falta agora' : `Ver o cronograma inteiro (${itens.length})`}
        </button>
      )}
    </section>
  )
}
