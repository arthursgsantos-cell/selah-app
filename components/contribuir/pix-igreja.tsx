'use client'

import { useMemo, useState } from 'react'
import QRCode from 'react-qr-code'
import {
  gerarPayloadPix, formatarChavePix, normalizarChavePix, aplicarCentavosCampanha,
  LABEL_TIPO_PIX, type TipoChavePix,
} from '@/lib/pix'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Copy, Check, QrCode, Target } from 'lucide-react'

interface CampanhaResumo {
  id: string
  nome: string
  descricao: string | null
  centavos: number
}

interface Props {
  chave: string
  tipo: TipoChavePix
  nome: string
  cidade?: string | null
  /** Destinos com final de centavos próprio — a construção da nova sede, etc. */
  campanhas?: CampanhaResumo[]
}

/** Atalhos de valor. O primeiro é o padrão: quem contribui decide no banco. */
const VALORES = [null, 20, 50, 100, 200] as const

export function PixIgreja({ chave, tipo, nome, cidade, campanhas = [] }: Props) {
  const [valor, setValor] = useState<number | null>(null)
  const [outro, setOutro] = useState('')
  const [campanhaId, setCampanhaId] = useState<string | null>(null)
  const [copiado, setCopiado] = useState<'payload' | 'chave' | null>(null)

  const campanha = campanhas.find((c) => c.id === campanhaId) ?? null

  // "12,50" e "12.50" vêm da mesma pessoa em teclados diferentes.
  const valorDigitado = useMemo(() => {
    if (outro.trim()) {
      const n = parseFloat(outro.replace(/\./g, '').replace(',', '.'))
      return Number.isFinite(n) && n > 0 ? n : null
    }
    return valor
  }, [outro, valor])

  // O final de centavos SUBSTITUI o que a pessoa escolheu, não soma — é a
  // assinatura do destino no extrato. Sem valor nenhum não há onde marcar: a
  // pessoa decide o quanto no banco, e aí não existe centavo para combinar.
  const valorFinal = useMemo(
    () => aplicarCentavosCampanha(valorDigitado, campanha?.centavos ?? null),
    [valorDigitado, campanha]
  )

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

      {/* Destino — cada campanha tem um final de centavos próprio, e é assim
          que a tesouraria separa no extrato o que foi para onde. */}
      {campanhas.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <Target className="h-3 w-3" />
            Destino
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCampanhaId(null)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                campanhaId === null
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              Dízimo / oferta
            </button>
            {campanhas.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCampanhaId(c.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  campanhaId === c.id
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background border-border text-muted-foreground hover:bg-muted'
                }`}
              >
                {c.nome}
              </button>
            ))}
          </div>
          {campanha && (
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              {campanha.descricao && <>{campanha.descricao} — </>}
              o valor termina em{' '}
              <strong className="text-foreground">
                ,{String(campanha.centavos).padStart(2, '0')}
              </strong>{' '}
              para a tesouraria identificar.
              {valorDigitado != null && valorDigitado < 1 && (
                <> Como o valor é menor que R$ 1, o final não muda.</>
              )}
            </p>
          )}
        </div>
      )}

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
