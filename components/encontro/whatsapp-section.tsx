'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { WhatsAppIcon } from '@/components/ui/whatsapp-icon'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { FuncaoEscala } from '@/lib/supabase/types'

interface EscalaItem {
  funcao: FuncaoEscala
  responsavel_nome: string | null
}

interface LancheItem {
  emoji: string | null
  item: string
  responsavel: string | null
}

interface Props {
  celulaNome: string
  dataHora: string
  local: string | null
  localMapsUrl: string | null
  avisos: string | null
  escalas: EscalaItem[]
  lanches: LancheItem[]
  cardImagemUrl: string | null
}

const funcaoLabel: Record<FuncaoEscala, string> = {
  louvor: 'Louvor',
  quebra_gelo: 'Quebra-gelo',
  edificacao: 'Edificação',
  compartilhar: 'Compartilhar',
}

export function WhatsAppSection({ celulaNome, dataHora, local, localMapsUrl, avisos, escalas, lanches, cardImagemUrl }: Props) {
  const [sharingImg, setSharingImg] = useState(false)

  function generateText(mapsLink?: string) {
    const data = format(new Date(dataHora), "EEEE, d/MM 'às' HH'h'mm", { locale: ptBR })
    const dataCapitalized = data.charAt(0).toUpperCase() + data.slice(1)

    let text = `IBZS | ${celulaNome}\n\n`
    text += `*${dataCapitalized}*\n`
    if (local) text += `${local}\n`
    if (mapsLink) text += `📍 ${mapsLink}\n`
    text += '\n'

    const escalasFilled = escalas.filter((e) => e.responsavel_nome)
    if (escalasFilled.length > 0) {
      escalasFilled.forEach((e) => {
        text += `${funcaoLabel[e.funcao]}: ${e.responsavel_nome}\n`
      })
      text += '\n'
    }

    if (lanches.length > 0) {
      text += `*Lista de lanche:*\n`
      lanches.forEach((l) => {
        const responsavel = l.responsavel ? `: ${l.responsavel}` : ': ainda em aberto'
        text += `- ${l.item}${responsavel}\n`
      })
      text += '\n'
    }

    if (avisos) {
      text += `*Avisos:*\n${avisos}\n\n`
    }

    text += 'Bora viver isso juntos!'
    return text
  }

  async function compartilharTexto() {
    let mapsLink: string | undefined
    if (localMapsUrl) {
      try {
        const res = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(localMapsUrl)}`)
        if (res.ok) mapsLink = await res.text()
      } catch {
        mapsLink = localMapsUrl
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(generateText(mapsLink))}`, '_blank')
  }

  async function compartilharImagem() {
    if (!cardImagemUrl) return
    setSharingImg(true)
    try {
      const response = await fetch(cardImagemUrl)
      const blob = await response.blob()
      const ext = blob.type.includes('png') ? 'png' : 'jpg'
      const file = new File([blob], `encontro-${celulaNome}.${ext}`, { type: blob.type })

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] })
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
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">Compartilhar no WhatsApp</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Gera um texto com as informações do encontro para enviar no grupo da célula.
        </p>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button
          onClick={compartilharTexto}
          className="gap-2 bg-[#25D366] hover:bg-[#20bb5a] text-white border-transparent"
        >
          <WhatsAppIcon className="h-4 w-4" />
          Enviar texto
        </Button>

        {cardImagemUrl && (
          <Button
            onClick={compartilharImagem}
            disabled={sharingImg}
            variant="outline"
            className="gap-2 border-[#25D366] text-[#25D366] hover:bg-[#25D366]/10"
          >
            <WhatsAppIcon className="h-4 w-4" />
            {sharingImg ? 'Carregando...' : 'Compartilhar imagem'}
          </Button>
        )}
      </div>
    </div>
  )
}
