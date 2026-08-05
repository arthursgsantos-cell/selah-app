'use client'

import { useRef, useState, useTransition } from 'react'
import { Camera } from 'lucide-react'
import { uploadCapaRedeAction } from '@/app/actions/rede'

interface Props {
  redeId: string
  capaUrl: string | null
  cor: string
  canEdit: boolean
}

export function RedeCapaUpload({ redeId, capaUrl, cor, canEdit }: Props) {
  const [preview, setPreview] = useState<string | null>(capaUrl)
  const [isPending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPreview(URL.createObjectURL(file))
    const fd = new FormData()
    fd.append('file', file)
    startTransition(async () => {
      try {
        const url = await uploadCapaRedeAction(redeId, fd)
        setPreview(url)
      } catch {
        setPreview(capaUrl)
      }
    })
  }

  return (
    <div
      className={`relative w-full h-48 rounded-2xl overflow-hidden ${canEdit ? 'cursor-pointer group' : ''}`}
      style={!preview ? { background: `linear-gradient(135deg, ${cor}55 0%, ${cor}cc 100%)` } : undefined}
      onClick={() => canEdit && fileRef.current?.click()}
    >
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="Capa da rede" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-end p-4">
          {canEdit && (
            <span className="text-white/50 text-xs font-medium">Clique para adicionar capa</span>
          )}
        </div>
      )}
      {/* Gradiente inferior para legibilidade do logo e dos botões */}
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/50 to-transparent" />

      {canEdit && (
        <>
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

          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleChange}
          />
        </>
      )}
    </div>
  )
}
