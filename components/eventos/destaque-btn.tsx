'use client'

import { useState, useTransition } from 'react'
import { Star } from 'lucide-react'
import { alternarDestaqueEventoAction } from '@/app/actions/evento-pagina'

interface Props {
  eventoId: string
  destaqueInicial: boolean
}

/**
 * Coloca o evento em destaque na página inicial.
 *
 * Fica na própria página do evento porque é ali que o pastor decide — evita
 * uma tela de curadoria só para marcar uma estrela.
 */
export function DestaqueBtn({ eventoId, destaqueInicial }: Props) {
  const [destaque, setDestaque] = useState(destaqueInicial)
  const [isPending, startTransition] = useTransition()

  function alternar() {
    const novo = !destaque
    setDestaque(novo)
    startTransition(async () => {
      try {
        await alternarDestaqueEventoAction(eventoId, novo)
      } catch {
        setDestaque(!novo)
      }
    })
  }

  return (
    <button
      type="button"
      onClick={alternar}
      disabled={isPending}
      title={destaque ? 'Sair do destaque da página inicial' : 'Destacar na página inicial'}
      aria-pressed={destaque}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium backdrop-blur transition-colors disabled:opacity-40 ${
        destaque
          ? 'border-amber-300 bg-amber-100 text-amber-800'
          : 'border-border bg-card/80 hover:bg-accent'
      }`}
    >
      <Star className={`h-3.5 w-3.5 ${destaque ? 'fill-amber-500 text-amber-500' : ''}`} />
      {destaque ? 'Em destaque' : 'Destacar'}
    </button>
  )
}
