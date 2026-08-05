'use client'

import { useState } from 'react'
import QRCode from 'react-qr-code'
import { gerarPayloadPix, formatarChavePix } from '@/lib/pix'
import type { TipoChavePix } from '@/lib/supabase/types'
import { Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  chave: string
  tipo: TipoChavePix
  nome: string
  valor?: number | null
}

export function PixDisplay({ chave, tipo, nome, valor }: Props) {
  const [copiado, setCopiado] = useState(false)

  const payload = gerarPayloadPix({
    chave,
    tipo,
    nome,
    valor: valor ?? undefined,
  })

  const chaveFormatada = formatarChavePix(chave, tipo)

  async function copiarCodigo() {
    await navigator.clipboard.writeText(payload)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2500)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-3">
        <div className="p-3 bg-white rounded-2xl shadow-sm border border-border">
          <QRCode value={payload} size={180} />
        </div>
        <p className="text-xs text-muted-foreground text-center">
          Escaneie o QR code com o app do seu banco para pagar via PIX
        </p>
      </div>

      <div className="rounded-xl bg-muted/50 p-3 space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Beneficiário</span>
          <span className="font-medium">{nome}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Chave</span>
          <span className="font-medium font-mono text-[11px] max-w-[180px] truncate">{chaveFormatada}</span>
        </div>
        {valor != null && (
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Valor</span>
            <span className="font-bold text-primary">
              {valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          </div>
        )}
      </div>

      <Button
        variant="outline"
        className="w-full gap-2"
        onClick={copiarCodigo}
      >
        {copiado ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
        {copiado ? 'Copiado!' : 'Copiar código PIX'}
      </Button>
    </div>
  )
}
