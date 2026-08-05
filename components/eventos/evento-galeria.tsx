'use client'

import { useRef, useState, useTransition } from 'react'
import { Plus, X } from 'lucide-react'
import { adicionarFotoEventoAction, removerFotoEventoAction } from '@/app/actions/evento-pagina'
import { comprimirImagem } from '@/lib/comprimir-imagem'
import { Lightbox } from '@/components/shared/lightbox'

export type FotoEvento = { id: string; url: string }

interface Props {
  eventoId: string
  secaoId: string
  fotos: FotoEvento[]
  canEdit: boolean
}

/** Fotos de uma seção. O cabeçalho fica em `SecaoChrome`. */
export function EventoGaleria({ eventoId, secaoId, fotos: fotosIniciais, canEdit }: Props) {
  const [fotos, setFotos] = useState<FotoEvento[]>(fotosIniciais)
  const [erro, setErro] = useState<string | null>(null)
  const [ampliada, setAmpliada] = useState<number | null>(null)
  const [isPending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  function enviar(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivos = Array.from(e.target.files ?? [])
    if (arquivos.length === 0) return
    setErro(null)

    startTransition(async () => {
      for (const file of arquivos) {
        try {
          const fd = new FormData()
          // Comprimir antes de enviar: o corpo de uma Server Action tem teto
          // de 1 MB e foto de celular passa disso.
          fd.append('file', await comprimirImagem(file))
          const nova = await adicionarFotoEventoAction(eventoId, secaoId, fd)
          setFotos((prev) => [...prev, nova])
        } catch (err) {
          setErro(err instanceof Error ? err.message : 'Erro ao enviar foto')
        }
      }
    })
    e.target.value = ''
  }

  function remover(id: string) {
    const anterior = fotos
    setFotos((prev) => prev.filter((f) => f.id !== id))
    startTransition(async () => {
      try {
        await removerFotoEventoAction(id, eventoId)
      } catch {
        setFotos(anterior)
      }
    })
  }

  return (
    <div className="space-y-2">
      {erro && <p className="text-xs text-destructive">{erro}</p>}

      {fotos.length > 0 ? (
        <div className="grid grid-cols-3 gap-1.5">
          {fotos.map((foto, i) => (
            <div key={foto.id} className="relative group">
              <button
                type="button"
                onClick={() => setAmpliada(i)}
                className="block w-full"
                aria-label="Ver foto ampliada"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={foto.url}
                  alt=""
                  className="aspect-square w-full object-cover rounded-xl hover:opacity-90 transition-opacity"
                />
              </button>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => remover(foto.id)}
                  className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                  aria-label="Remover foto"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        canEdit && (
          <p className="text-xs text-muted-foreground">
            Nenhuma foto ainda. Adicione imagens do local para quem vai se inscrever conhecer o espaço.
          </p>
        )
      )}

      {canEdit && (
        <>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={isPending}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
          >
            <Plus className="h-3 w-3" />
            {isPending ? 'Enviando...' : 'Adicionar fotos'}
          </button>

          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={enviar}
          />
        </>
      )}

      <Lightbox
        fotos={fotos.map((f) => ({ url: f.url }))}
        indice={ampliada}
        onFechar={() => setAmpliada(null)}
      />
    </div>
  )
}
