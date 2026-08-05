'use client'

import { useRef, useState, useTransition } from 'react'
import { Camera, Images } from 'lucide-react'
import { uploadCapaCelulaAction, alternarCapaAutomaticaAction } from '@/app/actions/celula'
import { comprimirImagem } from '@/lib/comprimir-imagem'

interface Props {
  celulaId: string
  capaUrl: string | null
  /** Foto mais recente da galeria da célula (cards de encontro não entram). */
  fotoMaisRecente: string | null
  capaAutomatica: boolean
  cor: string
  canEdit: boolean
}

/**
 * Capa da célula.
 *
 * No modo automático a capa é a foto mais recente da galeria — o que mantém a
 * página viva sem ninguém precisar trocar imagem à mão. Os cards de encontro
 * ficam de fora de propósito: são artes com texto, ruins como capa.
 *
 * A imagem enviada à mão continua guardada e volta assim que o automático é
 * desligado.
 */
export function CelulaCapaUpload({
  celulaId,
  capaUrl,
  fotoMaisRecente,
  capaAutomatica,
  cor,
  canEdit,
}: Props) {
  const [automatica, setAutomatica] = useState(capaAutomatica)
  const [preview, setPreview] = useState<string | null>(capaUrl)
  const [isPending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  // Sem foto na galeria, o automático cai na capa enviada à mão.
  const exibida = automatica ? fotoMaisRecente ?? preview : preview

  function alternarAutomatica(novo: boolean) {
    setAutomatica(novo)
    startTransition(async () => {
      try {
        await alternarCapaAutomaticaAction(celulaId, novo)
      } catch {
        setAutomatica(!novo)
      }
    })
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    const anterior = preview
    setPreview(URL.createObjectURL(file))
    startTransition(async () => {
      try {
        const fd = new FormData()
        // Corpo de Server Action tem teto de 1 MB; foto de celular passa disso.
        fd.append('file', await comprimirImagem(file))
        setPreview(await uploadCapaCelulaAction(celulaId, fd))
      } catch {
        setPreview(anterior)
      }
    })
  }

  // Trocar a capa à mão com o automático ligado não teria efeito visível.
  const podeTrocar = canEdit && !automatica

  return (
    <div className="space-y-1.5">
      <div
        className={`relative w-full h-40 rounded-2xl overflow-hidden ${podeTrocar ? 'cursor-pointer group' : ''}`}
        style={!exibida ? { background: `linear-gradient(135deg, ${cor}55 0%, ${cor}cc 100%)` } : undefined}
        onClick={() => podeTrocar && fileRef.current?.click()}
      >
        {exibida ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={exibida} alt="Capa da célula" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-end p-4">
            {canEdit && (
              <span className="text-white/50 text-xs font-medium">
                {automatica
                  ? 'A capa usará a foto mais recente da galeria'
                  : 'Clique para adicionar capa'}
              </span>
            )}
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/50 to-transparent" />

        {podeTrocar && (
          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            {isPending ? (
              <div className="h-6 w-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <div className="flex items-center gap-2 bg-black/50 backdrop-blur-sm rounded-full px-4 py-2">
                <Camera className="h-4 w-4 text-white" />
                <span className="text-white text-sm font-medium">Alterar capa</span>
              </div>
            )}
          </div>
        )}
      </div>

      {canEdit && (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={automatica}
            disabled={isPending}
            onChange={(e) => alternarAutomatica(e.target.checked)}
            className="h-3.5 w-3.5 accent-primary"
          />
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Images className="h-3.5 w-3.5" />
            Usar a foto mais recente da galeria como capa
          </span>
        </label>
      )}

      {canEdit && (
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleChange}
        />
      )}
    </div>
  )
}
