'use client'

import { useMemo, useState } from 'react'
import QRCode from 'react-qr-code'
import { gerarPayloadPix, formatarChavePix, normalizarChavePix, LABEL_TIPO_PIX, type TipoChavePix } from '@/lib/pix'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Copy, Check, QrCode } from 'lucide-react'

interface Props {
  chave: string
  tipo: TipoChavePix
  nome: string
  cidade?: string | null
}

/** Atalhos de valor. O primeiro é o padrão: quem contribui decide no banco. */
const VALORES = [null, 20, 50, 100, 200] as const

export function PixIgreja({ chave, tipo, nome, cidade }: Props) {
  const [valor, setValor] = useState<number | null>(null)
  const [outro, setOutro] = useState('')
  const [copiado, setCopiado] = useState<'payload' | 'chave' | null>(null)

  // "12,50" e "12.50" vêm da mesma pessoa em teclados diferentes.
  const valorFinal = useMemo(() => {
    if (outro.trim()) {
      const n = parseFloat(outro.replace(/\./g, '').replace(',', '.'))
      return Number.isFinite(n) && n > 0 ? n : null
    }
    return valor
  }, [outro, valor])

  const payload = useMemo(
    () => gerarPayloadPix({ chave, tipo, nome, cidade: cidade ?? undefined, valor: valorFinal ?? undefined }),
    [chave, tipo, nome, cidade, valorFinal]
  )

  async function copiar(texto: string, qual: 'payload' | 'chave') {
    await navigator.clipboard.writeText(texto)
    setCopiado(qual)
    setTimeout(() => setCopiado(null), 2500)
  }

  return (
    <div className="space-y-5">
      {/* Valor */}
      <div>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Valor</p>
        <div className="flex flex-wrap gap-2">
          {VALORES.map((v) => {
            const ativo = !outro.trim() && valor === v
            return (
              <button
                key={String(v)}
                type="button"
                onClick={() => { setValor(v); setOutro('') }}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  ativo
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background border-border text-muted-foreground hover:bg-muted'
                }`}
              >
                {v == null ? 'Eu escolho no banco' : `R$ ${v}`}
              </button>
            )
          })}
        </div>
        <Input
          value={outro}
          onChange={(e) => setOutro(e.target.value)}
          inputMode="decimal"
          placeholder="Outro valor (ex: 75,50)"
          className="mt-2.5 h-9 text-sm"
        />
      </div>

      {/* QR */}
      <div className="flex flex-col items-center gap-3">
        <div className="p-3.5 bg-white rounded-2xl shadow-sm border border-border">
          <QRCode value={payload} size={190} />
        </div>
        <p className="text-xs text-muted-foreground text-center max-w-xs leading-relaxed">
          {valorFinal != null
            ? <>Escaneie com o app do seu banco — o valor de <strong className="text-foreground">{valorFinal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong> já vai preenchido.</>
            : 'Escaneie com o app do seu banco e informe o valor por lá.'}
        </p>
      </div>

      <Button className="w-full gap-2" onClick={() => copiar(payload, 'payload')}>
        {copiado === 'payload' ? <Check className="h-4 w-4" /> : <QrCode className="h-4 w-4" />}
        {copiado === 'payload' ? 'Código copiado!' : 'Copiar código PIX'}
      </Button>

      {/* Dados do recebedor — para quem prefere digitar a chave no banco */}
      <div className="rounded-xl bg-muted/60 p-3.5 space-y-2">
        <div className="flex justify-between gap-3 text-xs">
          <span className="text-muted-foreground shrink-0">Recebedor</span>
          <span className="font-medium text-right">{nome}</span>
        </div>
        <div className="flex justify-between gap-3 text-xs">
          <span className="text-muted-foreground shrink-0">{LABEL_TIPO_PIX[tipo]}</span>
          <span className="font-medium font-mono text-[11px] text-right break-all">
            {formatarChavePix(normalizarChavePix(chave, tipo), tipo)}
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2 h-8 text-xs"
          onClick={() => copiar(normalizarChavePix(chave, tipo), 'chave')}
        >
          {copiado === 'chave' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copiado === 'chave' ? 'Chave copiada!' : 'Copiar chave'}
        </Button>
      </div>
    </div>
  )
}
