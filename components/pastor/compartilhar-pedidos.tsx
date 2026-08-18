'use client'

import { Share2 } from 'lucide-react'

export function CompartilharPedidos() {
  async function compartilhar() {
    const url = `${window.location.origin}/pastor?aba=pedidos`
    const texto = 'Acesse a lista de Pedidos da IBZS por este link.'
    if (navigator.share) await navigator.share({ title: 'Pedidos — IBZS', text: texto, url })
    else window.open(`https://wa.me/?text=${encodeURIComponent(`${texto}\n${url}`)}`, '_blank')
  }
  return <button type="button" onClick={compartilhar} className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/10"><Share2 className="h-3.5 w-3.5" /> Compartilhar Pedidos</button>
}
