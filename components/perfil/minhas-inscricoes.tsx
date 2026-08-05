import Link from 'next/link'
import { CalendarDays, ChevronRight, Ticket } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export type InscricaoResumo = {
  eventoId: string
  slug: string | null
  titulo: string
  dataHora: string
  capa: string | null
  statusPagamento: string | null
  saldo: string | null
}

/**
 * Lista das inscrições da pessoa, no perfil. Cada uma leva à sua página de
 * acompanhamento.
 */
export function MinhasInscricoes({ inscricoes }: { inscricoes: InscricaoResumo[] }) {
  if (inscricoes.length === 0) return null

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <Ticket className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Minhas inscrições</h2>
      </div>

      {inscricoes.map((i) => {
        const quitado = i.statusPagamento && /pago|confirmad|quitad/i.test(i.statusPagamento)
        return (
          <Link
            key={i.eventoId}
            href={`/minha-inscricao/${i.slug ?? i.eventoId}`}
            className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 transition-colors hover:bg-accent"
          >
            {i.capa ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={i.capa} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <CalendarDays className="h-5 w-5" />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold leading-tight">{i.titulo}</p>
              <p className="text-xs capitalize text-muted-foreground">
                {format(new Date(i.dataHora), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </p>
              {i.statusPagamento && (
                <span
                  className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    quitado ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {i.statusPagamento}
                  {!quitado && i.saldo ? ` · falta ${i.saldo}` : ''}
                </span>
              )}
            </div>

            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>
        )
      })}
    </section>
  )
}
