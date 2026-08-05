'use client'

import { useState, useTransition } from 'react'
import { Pencil, Check, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { salvarVideoSecaoAction } from '@/app/actions/evento-secoes'
import { resolverVideo } from '@/lib/video-embed'

interface Props {
  eventoId: string
  secaoId: string
  videoUrl: string | null
  canEdit: boolean
}

/**
 * Vídeo de uma seção. O link mora na própria seção — e não em `eventos` —
 * para que duas seções de vídeo no mesmo evento tenham vídeos diferentes.
 * O título e a descrição ficam em `SecaoChrome`.
 */
export function EventoVideo({ eventoId, secaoId, videoUrl, canEdit }: Props) {
  const [url, setUrl] = useState(videoUrl ?? '')
  const [rascunho, setRascunho] = useState(videoUrl ?? '')
  const [editando, setEditando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const video = resolverVideo(url)

  function salvar() {
    setErro(null)
    startTransition(async () => {
      try {
        await salvarVideoSecaoAction(secaoId, eventoId, rascunho)
        setUrl(rascunho.trim())
        setEditando(false)
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Erro ao salvar')
      }
    })
  }

  return (
    <div className="space-y-2">
      {canEdit && !editando && (
        <button
          type="button"
          onClick={() => { setRascunho(url); setEditando(true) }}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <Pencil className="h-3 w-3" />
          {url ? 'Trocar vídeo' : 'Adicionar vídeo'}
        </button>
      )}

      {editando && (
        <div className="space-y-2 rounded-xl border border-border bg-muted p-3">
          <Input
            value={rascunho}
            onChange={(e) => setRascunho(e.target.value)}
            placeholder="Cole o link do YouTube, Vimeo ou de um arquivo .mp4"
            className="h-9 text-sm"
          />
          {rascunho.trim() && !resolverVideo(rascunho) && (
            <p className="text-xs text-amber-700">
              Não reconheci esse link. Use YouTube, Vimeo ou um arquivo .mp4/.webm.
            </p>
          )}
          {erro && <p className="text-xs text-destructive">{erro}</p>}
          <div className="flex gap-2">
            <Button size="sm" onClick={salvar} disabled={isPending} className="gap-1.5">
              <Check className="h-3.5 w-3.5" />
              {isPending ? 'Salvando...' : 'Salvar'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditando(false)} disabled={isPending}>
              <X className="h-3.5 w-3.5" />
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {video?.tipo === 'iframe' && (
        <div className="relative w-full overflow-hidden rounded-2xl bg-black" style={{ aspectRatio: '16 / 9' }}>
          <iframe
            src={video.src}
            title="Vídeo do evento"
            className="absolute inset-0 h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}

      {video?.tipo === 'arquivo' && (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video src={video.src} controls className="w-full rounded-2xl bg-black" />
      )}

      {!video && canEdit && !editando && (
        <p className="text-xs text-muted-foreground">Nenhum vídeo adicionado ainda.</p>
      )}
    </div>
  )
}
