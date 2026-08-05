'use client'

import { useState } from 'react'
import { Lightbox, type FotoLightbox } from '@/components/shared/lightbox'

interface Props {
  fotos: FotoLightbox[]
}

/**
 * Grade da galeria da rede. Existe como componente client só para abrir o
 * visualizador — a página da rede é um server component.
 */
export function GaleriaRede({ fotos }: Props) {
  const [ampliada, setAmpliada] = useState<number | null>(null)

  return (
    <>
      <div className="grid grid-cols-3 gap-1.5">
        {fotos.map((foto, i) => (
          <button
            key={`${foto.url}-${i}`}
            type="button"
            onClick={() => setAmpliada(i)}
            aria-label={`Ver foto ${i + 1}`}
            className="aspect-square overflow-hidden rounded-xl"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={foto.url}
              alt=""
              className="h-full w-full object-cover transition-transform duration-200 hover:scale-105"
            />
          </button>
        ))}
      </div>

      <Lightbox
        fotos={fotos}
        indice={ampliada}
        onFechar={() => setAmpliada(null)}
        animado
      />
    </>
  )
}
