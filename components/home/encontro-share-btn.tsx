'use client'

import { useState } from 'react'
import { Share2 } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface Props {
  celulaNome: string
  dataHora: string
  local: string | null
  cardImagemUrl: string | null
}

export function EncontroShareBtn({ celulaNome, dataHora, local, cardImagemUrl }: Props) {
  const [sharingImg, setSharingImg] = useState(false)

  function buildText() {
    const data = format(new Date(dataHora), "EEEE, d/MM 'às' HH'h'mm", { locale: ptBR })
    const dataCapitalized = data.charAt(0).toUpperCase() + data.slice(1)
    let text = `${celulaNome}\n\n*${dataCapitalized}*\n`
    if (local) text += `${local}\n`
    text += '\nBora viver isso juntos!'
    return text
  }

  function handleShareTexto(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    window.open(`https://wa.me/?text=${encodeURIComponent(buildText())}`, '_blank')
  }

  async function handleShareImagem(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!cardImagemUrl) return
    setSharingImg(true)
    try {
      const response = await fetch(cardImagemUrl)
      const blob = await response.blob()
      const ext = blob.type.includes('png') ? 'png' : 'jpg'
      const file = new File([blob], `encontro-${celulaNome}.${ext}`, { type: blob.type })

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: buildText() })
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = file.name
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') console.error(err)
    } finally {
      setSharingImg(false)
    }
  }

  return (
    <div className="flex items-center gap-1 mt-2.5 pt-2.5 border-t border-border/50">
      <Share2 className="h-3.5 w-3.5 text-muted-foreground shrink-0 mr-1" />
      <button
        type="button"
        onClick={handleShareTexto}
        className="text-xs font-medium px-2.5 py-1 rounded-full bg-muted hover:bg-accent transition-colors text-foreground"
      >
        Texto
      </button>
      {cardImagemUrl && (
        <button
          type="button"
          onClick={handleShareImagem}
          disabled={sharingImg}
          className="text-xs font-medium px-2.5 py-1 rounded-full bg-muted hover:bg-accent transition-colors text-foreground"
        >
          {sharingImg ? 'Carregando...' : 'Imagem'}
        </button>
      )}
    </div>
  )
}
