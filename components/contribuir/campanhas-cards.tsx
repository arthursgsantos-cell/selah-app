'use client'

import { useState } from 'react'
import { Play, Target } from 'lucide-react'
import { resolverVideo } from '@/lib/video-embed'
import { centavosTexto } from '@/lib/campanhas'
import type { Campanha } from '@/app/actions/campanhas'

/**
 * Evento que liga o card ao seletor de destino do PIX.
 *
 * Os dois vivem em componentes diferentes (o card acima, o QR abaixo) e não
 * têm pai comum que segure estado. Um evento de janela evita subir o estado
 * inteiro do PIX só para o card conseguir marcar um destino.
 */
export const EVENTO_ESCOLHER_CAMPANHA = 'selah:campanha-escolhida'

interface Props {
  campanhas: Campanha[]
}

/**
 * As campanhas como cards, com imagem e vídeo.
 *
 * Uma linha de texto e um final de centavos bastam para a tesouraria separar o
 * extrato, mas não para alguém se comover e contribuir. Quem vai construir uma
 * sede mostra a planta; quem vai à missão mostra o vídeo de quem foi.
 */
export function CampanhasCards({ campanhas }: Props) {
  const [videoAberto, setVideoAberto] = useState<string | null>(null)

  const comCard = campanhas.filter((c) => c.imagem_url || c.video_url || c.descricao)
  if (comCard.length === 0) return null

  function escolher(id: string) {
    window.dispatchEvent(new CustomEvent(EVENTO_ESCOLHER_CAMPANHA, { detail: id }))
    document.getElementById('pix-igreja')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="space-y-3">
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5 px-1">
        <Target className="h-3 w-3" />
        Campanhas
      </p>

      {comCard.map((c) => {
        const video = resolverVideo(c.video_url)
        const aberto = videoAberto === c.id

        return (
          <article
            key={c.id}
            className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
          >
            {c.imagem_url && !aberto && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={c.imagem_url}
                alt={c.nome}
                className="h-40 w-full object-cover"
              />
            )}

            {aberto && video?.tipo === 'iframe' && (
              <div className="relative w-full bg-black" style={{ aspectRatio: '16 / 9' }}>
                <iframe
                  src={video.src}
                  title={`Vídeo da campanha ${c.nome}`}
                  className="absolute inset-0 h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            )}

            {aberto && video?.tipo === 'arquivo' && (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video src={video.src} controls autoPlay className="w-full bg-black" />
            )}

            <div className="p-4 space-y-2">
              <div className="flex items-start gap-2">
                <h3 className="text-sm font-semibold flex-1 leading-snug">{c.nome}</h3>
                <span className="shrink-0 rounded-lg bg-primary/10 px-2 py-0.5 font-mono text-xs font-bold text-primary tabular-nums">
                  {centavosTexto(c.centavos)}
                </span>
              </div>

              {c.descricao && (
                <p className="text-xs text-muted-foreground leading-relaxed">{c.descricao}</p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => escolher(c.id)}
                  className="flex-1 h-9 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
                >
                  Contribuir para esta campanha
                </button>
                {video && (
                  <button
                    type="button"
                    onClick={() => setVideoAberto(aberto ? null : c.id)}
                    className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-border text-xs font-medium hover:bg-accent transition-colors"
                  >
                    <Play className="h-3.5 w-3.5" />
                    {aberto ? 'Fechar' : 'Assistir'}
                  </button>
                )}
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
}
