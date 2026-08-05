'use client'

import { useState } from 'react'
import { Share2, Check, Link2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * `prefixo` existe porque este botão também serve a página do evento: sem ele
 * o compartilhamento saía como "Rede 1º Retiro Rede One".
 */
export function RedeShareButton({ nome, prefixo = 'Rede' }: { nome: string; prefixo?: string }) {
  const [copiado, setCopiado] = useState(false)

  async function compartilhar() {
    const url = window.location.href
    const titulo = prefixo ? `${prefixo} ${nome}` : nome

    // Em celular, usa a folha de compartilhamento nativa
    if (navigator.share) {
      try {
        await navigator.share({ title: titulo, url })
        return
      } catch {
        // usuário cancelou ou não é permitido — cai para copiar o link
      }
    }

    try {
      await navigator.clipboard.writeText(url)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      /* clipboard bloqueado; nada a fazer */
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={compartilhar} className="gap-1.5">
      {copiado ? (
        <>
          <Check className="h-3.5 w-3.5 text-green-600" />
          Link copiado
        </>
      ) : (
        <>
          <Share2 className="h-3.5 w-3.5" />
          Compartilhar
        </>
      )}
    </Button>
  )
}
