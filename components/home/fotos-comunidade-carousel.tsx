'use client'

import { useRef, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Lightbox, type FotoLightbox } from '@/components/shared/lightbox'

interface Props {
  fotos: FotoLightbox[]
}

export function FotosComunidadeCarousel({ fotos }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)
  const [ampliada, setAmpliada] = useState<number | null>(null)

  function updateArrows() {
    const el = scrollRef.current
    if (!el) return
    setCanLeft(el.scrollLeft > 4)
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }

  useEffect(() => {
    updateArrows()
    const el = scrollRef.current
    el?.addEventListener('scroll', updateArrows, { passive: true })
    return () => el?.removeEventListener('scroll', updateArrows)
  }, [fotos])

  function scroll(dir: 'left' | 'right') {
    scrollRef.current?.scrollBy({ left: dir === 'left' ? -220 : 220, behavior: 'smooth' })
  }

  // A classe é gancho de CSS: dentro de uma seção com proporção fixa
  // (`.secao-preenche`, em globals.css) a faixa horizontal vira um mosaico
  // que preenche o cartão, em vez de flutuar no meio do espaço vazio.
  return (
    <div className="galeria-comunidade relative -mx-4">
      {/* left arrow */}
      <button
        type="button"
        onClick={() => scroll('left')}
        aria-label="Rolar para a esquerda"
        className={cn(
          'absolute left-0 top-1/2 -translate-y-1/2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/70 shadow-sm backdrop-blur-sm transition-opacity',
          canLeft ? 'opacity-70 hover:opacity-100' : 'pointer-events-none opacity-0'
        )}
      >
        <ChevronLeft className="h-4 w-4 text-gray-600" />
      </button>

      {/* scroll container */}
      <div
        ref={scrollRef}
        data-trilho
        className="flex gap-2 overflow-x-auto no-scrollbar px-4 pb-1"
      >
        {fotos.map((foto, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setAmpliada(i)}
            aria-label={`Ver foto ${i + 1} da comunidade`}
            className="shrink-0 overflow-hidden rounded-2xl transition-transform duration-200 hover:scale-105 active:scale-95"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={foto.url} alt="" className="h-28 w-28 object-cover" />
          </button>
        ))}
      </div>

      {/* right arrow */}
      <button
        type="button"
        onClick={() => scroll('right')}
        aria-label="Rolar para a direita"
        className={cn(
          'absolute right-0 top-1/2 -translate-y-1/2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/70 shadow-sm backdrop-blur-sm transition-opacity',
          canRight ? 'opacity-70 hover:opacity-100' : 'pointer-events-none opacity-0'
        )}
      >
        <ChevronRight className="h-4 w-4 text-gray-600" />
      </button>

      <Lightbox
        fotos={fotos}
        indice={ampliada}
        onFechar={() => setAmpliada(null)}
        animado
      />
    </div>
  )
}
