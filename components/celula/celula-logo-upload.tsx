'use client'

import { useRef, useState, useTransition } from 'react'
import { Camera } from 'lucide-react'
import { uploadLogoCelulaAction } from '@/app/actions/celula'

interface Props {
  celulaId: string
  logoUrl: string | null
  iniciais: string
  cor?: string | null
  size?: 'sm' | 'md'
}

export function CelulaLogoUpload({ celulaId, logoUrl, iniciais, cor, size = 'md' }: Props) {
  const [preview, setPreview] = useState<string | null>(logoUrl)
  const [isPending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  const dim = size === 'sm' ? 'h-8 w-8 text-xs rounded-lg' : 'h-14 w-14 text-2xl rounded-xl'

  const hasColor = !preview && !!cor
  const bgStyle = hasColor
    ? { backgroundColor: cor + '25', color: cor }
    : {}

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const objectUrl = URL.createObjectURL(file)
    setPreview(objectUrl)
    const fd = new FormData()
    fd.append('file', file)
    startTransition(async () => {
      try {
        const url = await uploadLogoCelulaAction(celulaId, fd)
        setPreview(url)
      } catch {
        setPreview(logoUrl)
      }
    })
  }

  return (
    <div
      className={`relative ${dim} flex items-center justify-center font-bold shrink-0 overflow-hidden cursor-pointer group ${!hasColor ? 'bg-primary/10 text-primary' : ''}`}
      style={bgStyle}
      onClick={() => fileRef.current?.click()}
      title="Trocar foto da célula"
    >
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt={iniciais} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <span>{iniciais}</span>
      )}

      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        {isPending ? (
          <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <Camera className="h-4 w-4 text-white" />
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleChange}
      />
    </div>
  )
}
