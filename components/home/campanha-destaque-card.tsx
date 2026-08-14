import Link from 'next/link'
import { ChevronRight, Play } from 'lucide-react'
import { centavosTexto } from '@/lib/campanhas'

export interface CampanhaDestaque {
  id: string
  nome: string
  descricao: string | null
  centavos: number
  imagem_url: string | null
  video_url: string | null
}

/**
 * Campanha em destaque na tela inicial.
 *
 * Leva para `/contribuir`, onde mora o card completo com vídeo e o QR — a home
 * mostra o convite, não a máquina de contribuir.
 */
export function CampanhaDestaqueCard({ campanha }: { campanha: CampanhaDestaque }) {
  return (
    <Link
      href="/contribuir"
      className="block overflow-hidden rounded-2xl bg-card shadow-sm transition-opacity hover:opacity-95"
    >
      {campanha.imagem_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={campanha.imagem_url} alt="" className="h-36 w-full object-cover" />
      )}
      <div className="flex items-center gap-3 p-4">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">
            Campanha
          </p>
          <h2 className="mt-0.5 text-sm font-semibold leading-snug">{campanha.nome}</h2>
          {campanha.descricao && (
            <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              {campanha.descricao}
            </p>
          )}
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-700 tabular-nums">
              termina em {centavosTexto(campanha.centavos)}
            </span>
            {campanha.video_url && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                <Play className="h-2.5 w-2.5" /> vídeo
              </span>
            )}
          </div>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </div>
    </Link>
  )
}
