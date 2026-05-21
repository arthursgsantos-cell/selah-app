'use client'

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

export function WhatsAppSection({ celulaNome, dataHora, local, avisos, escalas, lanches, cardImagemUrl }: Props) {
  function generateText() {
    const data = format(new Date(dataHora), "EEEE, d/MM 'às' HH'h'mm", { locale: ptBR })
    const dataCapitalized = data.charAt(0).toUpperCase() + data.slice(1)

    let text = `IBZS | ${celulaNome}\n\n`
    text += `*${dataCapitalized}*\n`
    if (local) text += `${local}\n`
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

  function compartilhar() {
    const text = encodeURIComponent(generateText())
    window.open(`https://wa.me/?text=${text}`, '_blank')
  }

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">Compartilhar no WhatsApp</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Gera um texto com as informações do encontro para enviar no grupo da célula.
        </p>
      </div>

      <Button
        onClick={compartilhar}
        className="gap-2 bg-[#25D366] hover:bg-[#20bb5a] text-white border-transparent"
      >
        <WhatsAppIcon className="h-4 w-4" />
        Enviar texto
      </Button>
    </div>
  )
}
