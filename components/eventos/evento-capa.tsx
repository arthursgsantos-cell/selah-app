'use client'

import { useRef, useState, useTransition } from 'react'
import { Camera, Undo2 } from 'lucide-react'
import {
  salvarCapaPaginaEventoAction,
  removerCapaPaginaEventoAction,
} from '@/app/actions/evento-pagina'
import { comprimirImagem } from '@/lib/comprimir-imagem'

interface Props {
  eventoId: string
  titulo: string
  /** Card do evento — o que circula no WhatsApp e aparece nas listagens. */
  imagemUrl: string | null
  /** Capa exclusiva desta página, quando houver. */
  capaPaginaUrl: string | null
  canEdit: boolean
}

/**
 * Topo da página do evento. Usa a capa própria quando existe e cai no card
 * do evento quando não. Trocar a capa daqui não altera o card.
 */
export function EventoCapa({ eventoId, titulo, imagemUrl, capaPaginaUrl, canEdit }: Props) {
  const [capa, setCapa] = useState(capaPaginaUrl)
  const [erro, setErro] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  const exibida = capa ?? imagemUrl

  function enviar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    const anterior = capa
    setErro(null)
    setCapa(URL.createObjectURL(file))

    startTransition(async () => {
      try {
        const fd = new FormData()
        fd.append('file', await comprimirImagem(file))
        setCapa(await salvarCapaPaginaEventoAction(eventoId, fd))
      } catch (err) {
        setCapa(anterior)
        setErro(err instanceof Error ? err.message : 'Erro ao enviar a capa')
      }
    })
  }

  function voltarParaOCard() {
    const anterior = capa
    setCapa(null)
    startTransition(async () => {
      try {
        await removerCapaPaginaEventoAction(eventoId)
      } catch {
        setCapa(anterior)
      }
    })
  }

  if (!exibida && !canEdit) return null

  return (
    <div className="space-y-1.5">
      {exibida ? (
        <div className="relative w-full overflow-hidden rounded-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={exibida} alt={titulo} className="w-full object-cover max-h-80" />
        </div>
      ) : (
        <div className="flex h-32 w-full items-center justify-center rounded-2xl border border-dashed border-border text-xs text-muted-foreground">
          Sem capa
        </div>
      )}

      {canEdit && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={isPending}
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
          >
            <Camera className="h-3 w-3" />
            {capa ? 'Trocar capa da página' : 'Usar uma capa só para esta página'}
          </button>

          {capa && (
            <button
              type="button"
              disabled={isPending}
              onClick={voltarParaOCard}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
            >
              <Undo2 className="h-3 w-3" />
              Voltar a usar o card
            </button>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={enviar}
          />
        </div>
      )}

      {canEdit && !capa && imagemUrl && (
        <p className="text-[11px] text-muted-foreground">
          Mostrando o card do evento. Uma capa própria não altera o card.
        </p>
      )}
      {erro && <p className="text-xs text-destructive">{erro}</p>}
    </div>
  )
}
