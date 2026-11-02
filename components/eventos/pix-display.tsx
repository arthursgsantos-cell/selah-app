'use client'

import { useState } from 'react'
import QRCode from 'react-qr-code'
import { gerarPayloadPix, formatarChavePix } from '@/lib/pix'
import type { TipoChavePix } from '@/lib/supabase/types'
import { Copy, Check, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  chave?: string | null
  tipo?: TipoChavePix | null
  nome?: string | null
  valor?: number | null
  /** Link de cobrança do banco (ex: Nubank). Opcional. */
  link?: string | null
}

export function PixDisplay({ chave, tipo, nome, valor, link }: Props) {
  const [copiado, setCopiado] = useState(false)
  const [copiadoLink, setCopiadoLink] = useState(false)

  const temPix = Boolean(chave && tipo && nome)

  const payload = temPix
    ? gerarPayloadPix({
        chave: chave!,
        tipo: tipo!,
        nome: nome!,
        valor: valor ?? undefined,
      })
    : null

  // QR do PIX quando há chave; senão, QR do próprio link de cobrança
  const qrValue = payload ?? link ?? null

  if (!qrValue) return null

  const valorFormatado =
    valor != null
      ? valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      : null

  async function copiarCodigo() {
    if (!payload) return
    await navigator.clipboard.writeText(payload)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2500)
  }

  async function copiarLink() {
    if (!link) return
    await navigator.clipboard.writeText(link)
    setCopiadoLink(true)
    setTimeout(() => setCopiadoLink(false), 2500)
  }

  return (
    <div className="space-y-4">
      {link && (
        <div className="space-y-2">
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 h-10 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors w-full"
          >
            <ExternalLink className="h-4 w-4" />
            {valorFormatado ? `Pagar ${valorFormatado}` : 'Pagar agora'}
          </a>
          <button
            type="button"
            onClick={copiarLink}
            className="text-xs text-primary underline w-full text-center"
          >
            {copiadoLink ? 'Link copiado!' : 'Copiar link de pagamento'}
          </button>
        </div>
      )}

      <div className="flex flex-col items-center gap-3">
        <div className="p-3 bg-white rounded-2xl shadow-sm border border-border">
          <QRCode value={qrValue} size={180} />
        </div>
        <p className="text-xs text-muted-foreground text-center">
          {payload
            ? 'Escaneie o QR code pelo leitor PIX do app do seu banco'
            : 'Escaneie com a câmera do celular para abrir a página de pagamento — este QR code não funciona no leitor PIX do banco'}
        </p>
      </div>

      {(temPix || valorFormatado) && (
        <div className="rounded-xl bg-muted/50 p-3 space-y-1.5">
          {temPix && (
            <>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Beneficiário</span>
                <span className="font-medium">{nome}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Chave</span>
                <span className="font-medium font-mono text-[11px] max-w-[180px] truncate">
                  {formatarChavePix(chave!, tipo!)}
                </span>
              </div>
            </>
          )}
          {valorFormatado && (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Valor</span>
              <span className="font-bold text-primary">{valorFormatado}</span>
            </div>
          )}
        </div>
      )}

      {payload && (
        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={copiarCodigo}
        >
          {copiado ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
          {copiado ? 'Copiado!' : 'Copiar código PIX'}
        </Button>
      )}
    </div>
  )
}
