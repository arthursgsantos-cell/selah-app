import { Radio, ExternalLink } from 'lucide-react'
import { resolverVideo } from '@/lib/video-embed'

interface Props {
  url: string
  /** Nome da igreja, para o rótulo do player. */
  igrejaNome?: string | null
}

/**
 * Culto ao vivo.
 *
 * Só é renderizado quando a liderança marca `ao_vivo_ativo` no painel — o app
 * não tenta deduzir se há transmissão no ar. Deduzir pelo horário do culto
 * daria errado no primeiro feriado, e um "AO VIVO" piscando sobre uma
 * transmissão que não existe é pior do que card nenhum.
 *
 * Link que o `resolverVideo` não reconhece ainda vira botão: melhor mandar a
 * pessoa para o YouTube do que engolir o link em silêncio.
 */
export function CultoAoVivo({ url, igrejaNome }: Props) {
  const video = resolverVideo(url)

  return (
    <section className="rounded-2xl overflow-hidden bg-card shadow-sm">
      <div className="flex items-center gap-2 px-4 pt-3.5 pb-2.5">
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-red-600" />
        </span>
        <h2 className="text-sm font-semibold">Culto ao vivo</h2>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
          <Radio className="h-3 w-3" />
          No ar
        </span>
      </div>

      {video?.tipo === 'iframe' ? (
        <div className="relative w-full" style={{ aspectRatio: '16 / 9' }}>
          <iframe
            src={video.src}
            title={`Culto ao vivo — ${igrejaNome ?? 'nossa igreja'}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 h-full w-full border-0"
          />
        </div>
      ) : video?.tipo === 'arquivo' ? (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video src={video.src} controls className="w-full" />
      ) : (
        <div className="px-4 pb-4">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            <ExternalLink className="h-4 w-4" />
            Assistir à transmissão
          </a>
        </div>
      )}
    </section>
  )
}
