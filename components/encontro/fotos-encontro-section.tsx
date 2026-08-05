'use client'

import { useRef, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Camera, ImagePlus, Trash2, X } from 'lucide-react'
import { uploadFotoEncontroAction, deleteFotoEncontroAction } from '@/app/actions/fotos-comunidade'

export interface FotoEncontro {
  id: string
  url: string
  criado_por: string | null
}

interface Props {
  encontroId: string
  fotosInit: FotoEncontro[]
  currentUserId: string
  /** Membro da célula (ou liderança) — quem pode publicar e apagar. */
  canUpload: boolean
  canModerar: boolean
}

export function FotosEncontroSection({
  encontroId,
  fotosInit,
  currentUserId,
  canUpload,
  canModerar,
}: Props) {
  const [fotos, setFotos] = useState(fotosInit)
  const [isPending, startTransition] = useTransition()
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [ampliada, setAmpliada] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function enviar(files: FileList | null) {
    if (!files || files.length === 0) return
    setErro(null)
    setEnviando(true)

    try {
      for (const file of Array.from(files)) {
        const fd = new FormData()
        fd.append('file', file)
        const nova = await uploadFotoEncontroAction(encontroId, fd)
        setFotos((prev) => [{ ...nova, criado_por: currentUserId }, ...prev])
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível enviar a foto.')
    } finally {
      setEnviando(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function apagar(id: string) {
    startTransition(async () => {
      try {
        await deleteFotoEncontroAction(id)
        setFotos((prev) => prev.filter((f) => f.id !== id))
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Não foi possível apagar.')
      }
    })
  }

  if (fotos.length === 0 && !canUpload) {
    return <p className="text-sm text-muted-foreground py-2">Nenhuma foto do encontro ainda.</p>
  }

  return (
    <div className="space-y-3">
      {fotos.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma foto ainda. Registre como foi o encontro!
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {fotos.map((f) => {
            const podeApagar = canModerar || f.criado_por === currentUserId

            return (
              <div key={f.id} className="relative group aspect-square rounded-lg overflow-hidden bg-muted">
                <button
                  type="button"
                  onClick={() => setAmpliada(f.url)}
                  className="w-full h-full"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={f.url}
                    alt="Foto do encontro"
                    loading="lazy"
                    className="w-full h-full object-cover hover:scale-105 transition-transform"
                  />
                </button>

                {podeApagar && (
                  <button
                    type="button"
                    onClick={() => apagar(f.id)}
                    disabled={isPending}
                    className="absolute top-1 right-1 p-1 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                    title="Apagar foto"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {erro && <p className="text-xs text-destructive">{erro}</p>}

      {canUpload && (
        <div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => enviar(e.target.files)}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={enviando}
          >
            {enviando ? (
              <>
                <ImagePlus className="h-4 w-4" />
                Enviando...
              </>
            ) : (
              <>
                <Camera className="h-4 w-4" />
                Adicionar fotos
              </>
            )}
          </Button>
        </div>
      )}

      {/* Visualização ampliada */}
      {ampliada && typeof window !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setAmpliada(null)}
        >
          <button
            type="button"
            onClick={() => setAmpliada(null)}
            aria-label="Fechar"
            className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white text-black shadow-lg flex items-center justify-center hover:bg-white/90 active:scale-95 transition"
          >
            <X className="h-5 w-5" strokeWidth={2.5} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ampliada}
            alt="Foto do encontro"
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-full object-contain rounded-lg"
          />
        </div>,
        document.body
      )}
    </div>
  )
}
