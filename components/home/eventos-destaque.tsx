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
  /** Nulo em itens sem data única — uma turma acontece toda semana. */
  data_hora: string | null
  local: string | null
  /** Capa da página quando houver; senão o card do evento. */
  capa: string | null
  /**
   * Destino. Sem isso cai em `/evento/[slug ?? id]`, o comportamento dos
   * eventos — as turmas passam o próprio caminho.
   */
  href?: string
  /** Texto no lugar da data. Usado pelas turmas: "Quartas · 19h às 21h". */
  subtitulo?: string | null
  /** Rótulo do selo. Padrão "Destaque". */
  selo?: string
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
/** Intervalo da passagem automática. */
const INTERVALO_MS = 3000

export function EventosDestaque({ eventos }: Props) {
  const trilhoRef = useRef<HTMLDivElement>(null)
  const [atual, setAtual] = useState(0)
  const [pausado, setPausado] = useState(false)

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

  /**
   * Passagem automática a cada 3s, em laço.
   *
   * Pausa em três situações, e as três importam: o ponteiro em cima (a pessoa
   * está lendo), o dedo tocando (senão o carrossel briga com o gesto de
   * arrastar) e a aba em segundo plano — sem isso, voltar depois de meia hora
   * traz uma fila de scrolls acumulados.
   */
  useEffect(() => {
    if (eventos.length < 2 || pausado) return

    const timer = setInterval(() => {
      const t = trilhoRef.current
      if (!t || document.hidden) return
      const proximo = (Math.round(t.scrollLeft / t.clientWidth) + 1) % eventos.length
      t.scrollTo({ left: proximo * t.clientWidth, behavior: 'smooth' })
    }, INTERVALO_MS)

    return () => clearInterval(timer)
  }, [eventos.length, pausado])

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
        onMouseEnter={() => setPausado(true)}
        onMouseLeave={() => setPausado(false)}
        onTouchStart={() => setPausado(true)}
        onTouchEnd={() => setPausado(false)}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {eventos.map((evento) => (
          <Link
            key={evento.id}
            href={evento.href ?? `/evento/${evento.slug ?? evento.id}`}
            className="relative w-full shrink-0 snap-center overflow-hidden rounded-2xl shadow-md"
          >
            {/* 16:9 e não altura fixa: a arte de capa é feita nessa proporção,
                e uma faixa de 208px cortava as laterais no celular e sobrava
                no desktop. Com `aspect-video` o banner acompanha a largura. */}
            {evento.capa ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={evento.capa}
                alt={evento.titulo}
                className="aspect-video w-full object-cover transition-transform duration-500 hover:scale-105"
              />
            ) : (
              <div className="aspect-video w-full bg-gradient-to-br from-primary to-primary/60" />
            )}

            {/* Véu escuro: o texto precisa sobreviver a qualquer capa. */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />

            <div className="absolute inset-x-0 bottom-0 p-4 text-white">
              <span className="inline-block rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider backdrop-blur">
                {evento.selo ?? 'Destaque'}
              </span>
              <h2 className="mt-1.5 text-lg font-bold leading-tight drop-shadow">{evento.titulo}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-white/85">
                {(evento.data_hora || evento.subtitulo) && (
                  <span className="flex items-center gap-1 capitalize">
                    <CalendarDays className="h-3 w-3 shrink-0" />
                    {evento.data_hora
                      ? format(new Date(evento.data_hora), "d 'de' MMMM 'às' HH'h'mm", { locale: ptBR })
                      : evento.subtitulo}
                  </span>
                )}
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

