'use client'

import { useRef, useState, useTransition } from 'react'
import { Camera } from 'lucide-react'
import { uploadLogoRedeAction } from '@/app/actions/rede'

interface Props {
  redeId: string
  logoUrl: string | null
  cor: string
  iniciais: string
  canEdit?: boolean
}

export function RedeLogoUpload({ redeId, logoUrl, cor, iniciais, canEdit = false }: Props) {
  const [preview, setPreview] = useState<string | null>(logoUrl)
  const [isPending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const objectUrl = URL.createObjectURL(file)
    setPreview(objectUrl)
    const fd = new FormData()
    fd.append('file', file)
    startTransition(async () => {
      try {
        const url = await uploadLogoRedeAction(redeId, fd)
        setPreview(url)
      } catch {
        setPreview(logoUrl)
      }
    })
  }

  return (
    <div
      className={`h-16 w-16 rounded-2xl shrink-0 flex items-center justify-center overflow-hidden relative ${canEdit ? 'cursor-pointer group' : ''}`}
      style={preview ? undefined : { backgroundColor: `${cor}30` }}
      onClick={() => canEdit && fileRef.current?.click()}
      title={canEdit ? 'Trocar foto da rede' : undefined}
    >
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt={iniciais} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <span className="text-lg font-bold" style={{ color: cor }}>{iniciais}</span>
      )}

      {canEdit && (
        <>
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10">
            {isPending ? (
              <div className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Camera className="h-3.5 w-3.5 text-white" />
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
