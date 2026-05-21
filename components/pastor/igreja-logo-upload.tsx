'use client'

import { useRef, useState, useTransition } from 'react'
import { Camera } from 'lucide-react'
import { uploadLogoIgrejaAction } from '@/app/actions/pastor'

interface Props {
  igrejaId: string
  logoUrl: string | null
  nomeIgreja: string
}

export function IgrejaLogoUpload({ igrejaId, logoUrl, nomeIgreja }: Props) {
  const [preview, setPreview] = useState<string | null>(logoUrl)
  const [isPending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  const iniciais = nomeIgreja
    .split(' ')
    .filter((w) => w.length > 2)
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase() || nomeIgreja.slice(0, 2).toUpperCase()

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const objectUrl = URL.createObjectURL(file)
    setPreview(objectUrl)
    const fd = new FormData()
    fd.append('file', file)
    startTransition(async () => {
      try {
        const url = await uploadLogoIgrejaAction(igrejaId, fd)
        setPreview(url)
      } catch {
        setPreview(logoUrl)
      }
    })
  }

  return (
    <div
      className="relative h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center font-bold text-primary text-xl overflow-hidden cursor-pointer group shrink-0"
      onClick={() => fileRef.current?.click()}
      title="Trocar logomarca da igreja"
    >
      {preview ? (
        <img src={preview} alt={nomeIgreja} className="absolute inset-0 h-full w-full object-contain p-1.5" />
      ) : (
        <span>{iniciais}</span>
      )}

      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
        {isPending ? (
          <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            <Camera className="h-4 w-4 text-white" />
            <span className="text-[9px] text-white font-medium">Logo</span>
          </>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/svg+xml"
        className="hidden"
        onChange={handleChange}
      />
    </div>
  )
}
