'use client'

import { WhatsAppIcon } from '@/components/ui/whatsapp-icon'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface Props {
  celulaNome: string
  dataHora: string
  local: string | null
}

export function EncontroShareBtn({ celulaNome, dataHora, local }: Props) {
  function compartilhar() {
    const data = format(new Date(dataHora), "EEEE, d/MM 'às' HH'h'mm", { locale: ptBR })
    const dataCapitalized = data.charAt(0).toUpperCase() + data.slice(1)

    let text = `${celulaNome}\n\n`
    text += `*${dataCapitalized}*\n`
    if (local) text += `${local}\n`
    text += '\nBora viver isso juntos!'

    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  return (
    <button
      type="button"
      onClick={compartilhar}
      className="flex items-center gap-1.5 text-xs font-medium text-[#25D366] hover:text-[#20bb5a] transition-colors mt-2"
    >
      <WhatsAppIcon className="h-3.5 w-3.5" />
      Compartilhar no WhatsApp
    </button>
  )
}
