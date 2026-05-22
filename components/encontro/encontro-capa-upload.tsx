'use client'

import { useRef, useState, useTransition } from 'react'
import { Camera, ImagePlus, X } from 'lucide-react'
import { uploadCapaEncontroAction } from '@/app/actions/encontro'
import { Button } from '@/components/ui/button'

interface Props {
  encontroId: string
  capaUrl: string | null
}

export function EncontroCapaUpload({ encontroId, capaUrl }: Props) {
  const [preview, setPreview] = useState<string | null>(capaUrl)
  const [isPending, startTransition] = useTransition()
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const objectUrl = URL.createObjectURL(file)
    setPreview(objectUrl)
    setLightboxOpen(false)
    const fd = new FormData()
    fd.append('file', file)
    startTransition(async () => {
      try {
        const url = await uploadCapaEncontroAction(encontroId, fd)
        setPreview(url)
      } catch {
        setPreview(capaUrl)
      }
    })
  }

  if (preview) {
    return (
      <>
        {/* Thumbnail clicável */}
        <div className="relative rounded-xl overflow-hidden cursor-pointer" onClick={() => setLightboxOpen(true)}>
          <img src={preview} alt="Capa do encontro" className="w-full h-auto block" />
          {isPending && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* Lightbox */}
        {lightboxOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center p-4"
            onClick={() => setLightboxOpen(false)}
          >
            <div
              className="relative max-w-lg w-full space-y-3"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Fechar */}
              <button
                onClick={() => setLightboxOpen(false)}
                className="absolute -top-10 right-0 text-white/70 hover:text-white"
              >
                <X className="h-6 w-6" />
              </button>

              {/* Imagem completa */}
              <img src={preview} alt="Capa do encontro" className="w-full h-auto rounded-xl block" />

              {/* Ação */}
              <Button
                className="w-full"
                variant="secondary"
                onClick={() => fileRef.current?.click()}
                disabled={isPending}
              >
                <Camera className="h-4 w-4 mr-2" />
                {isPending ? 'Enviando...' : 'Trocar imagem'}
              </Button>
            </div>
          </div>
        )}

        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleChange} />
      </>
    )
  }

  return (
    <div
      className="h-24 rounded-xl border-2 border-dashed border-primary/20 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-primary/40 transition-colors"
      onClick={() => fileRef.current?.click()}
    >
      {isPending ? (
        <div className="h-5 w-5 border-2 border-primary/40 border-t-transparent rounded-full animate-spin" />
      ) : (
        <>
          <ImagePlus className="h-6 w-6 text-primary/30" />
          <span className="text-xs text-muted-foreground">Adicionar capa</span>
        </>
      )}
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleChange} />
    </div>
  )
}
