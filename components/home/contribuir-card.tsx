import Link from 'next/link'
import { HandCoins, ChevronRight } from 'lucide-react'

interface Props {
  /** Trocados pelo painel "Seções" da home. Sem eles, valem os padrões. */
  titulo?: string | null
  subtitulo?: string | null
}

/**
 * Chamada para a página de dízimos e ofertas.
 *
 * Cartão, e não diálogo: o QR precisa de um endereço próprio para ir no telão,
 * no mural e no link da bio. A home só aponta para ele.
 */
export function ContribuirCard({ titulo, subtitulo }: Props) {
  return (
    <Link
      href="/contribuir"
      className="block rounded-2xl bg-card p-4 shadow-sm transition-colors hover:bg-accent/40"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
          <HandCoins className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">{titulo || 'Dízimos e ofertas'}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
            {subtitulo || 'PIX com QR code e copia e cola.'}
          </p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </div>
    </Link>
  )
}
