'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { CalendarDays, MapPin } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export type EventoDestaque = {
  slug: string | null
  id: string
  titulo: string
  data_hora: string
  local: string | null
  /** Capa da página quando houver; senão o card do evento. */
  capa: string | null
}

interface Props {
  eventos: EventoDestaque[]
}

/**
 * Faixa de destaques na página inicial.
 *
 * Com um evento é um banner; com vários vira carrossel. A rolagem é nativa,
 * com `scroll-snap` — funciona no toque do celular sem biblioteca e sem
 * quebrar o teclado.
 */
export function EventosDestaque({ eventos }: Props) {
  const trilhoRef = useRef<HTMLDivElement>(null)
  const [atual, setAtual] = useState(0)

  // Acompanha a rolagem para acender a bolinha certa.
  useEffect(() => {
    const trilho = trilhoRef.current
    if (!trilho || eventos.length < 2) return

    function aoRolar() {
      const t = trilhoRef.current
      if (!t) return
      setAtual(Math.round(t.scrollLeft / t.clientWidth))
    }
    trilho.addEventListener('scroll', aoRolar, { passive: true })
    return () => trilho.removeEventListener('scroll', aoRolar)
  }, [eventos.length])

  if (eventos.length === 0) return null

  function irPara(i: number) {
    const t = trilhoRef.current
    if (!t) return
    t.scrollTo({ left: i * t.clientWidth, behavior: 'smooth' })
  }

  return (
    <section className="space-y-2">
      <div
        ref={trilhoRef}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {eventos.map((evento) => (
          <Link
            key={evento.id}
            href={`/evento/${evento.slug ?? evento.id}`}
            className="relative w-full shrink-0 snap-center overflow-hidden rounded-2xl shadow-md"
          >
            {evento.capa ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={evento.capa}
                alt={evento.titulo}
                className="h-52 w-full object-cover transition-transform duration-500 hover:scale-105"
              />
            ) : (
              <div className="h-52 w-full bg-gradient-to-br from-primary to-primary/60" />
            )}

            {/* Véu escuro: o texto precisa sobreviver a qualquer capa. */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />

            <div className="absolute inset-x-0 bottom-0 p-4 text-white">
              <span className="inline-block rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider backdrop-blur">
                Destaque
              </span>
              <h2 className="mt-1.5 text-lg font-bold leading-tight drop-shadow">{evento.titulo}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-white/85">
                <span className="flex items-center gap-1 capitalize">
                  <CalendarDays className="h-3 w-3 shrink-0" />
                  {format(new Date(evento.data_hora), "d 'de' MMMM 'às' HH'h'mm", { locale: ptBR })}
                </span>
                {evento.local && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {evento.local}
                  </span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {eventos.length > 1 && (
        <div className="flex justify-center gap-1.5">
          {eventos.map((evento, i) => (
            <button
              key={evento.id}
              type="button"
              onClick={() => irPara(i)}
              aria-label={`Ver destaque ${i + 1}`}
              aria-current={i === atual}
              className={`h-1.5 rounded-full transition-all ${
                i === atual ? 'w-5 bg-primary' : 'w-1.5 bg-muted-foreground/30'
              }`}
            />
          ))}
        </div>
      )}
    </section>
  )
}
