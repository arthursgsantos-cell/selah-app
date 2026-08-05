'use client'

import { useState, useTransition } from 'react'
import { Plus, Trash2, Check, ChevronDown, AlertCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { registrarPagamentoAction, removerPagamentoAction } from '@/app/actions/cobranca'
import {
  calcularParcelas,
  formatarBRL,
  totalPago,
  type ParcelaEvento,
  type PagamentoInscricao,
} from '@/lib/evento-cobranca'

interface Props {
  inscricaoId: string
  eventoId: string
  nome: string
  valorTotal: number | null
  parcelas: ParcelaEvento[]
  pagamentos: PagamentoInscricao[]
}

const statusCfg = {
  paga:    { label: 'Paga',    cls: 'bg-green-100 text-green-700' },
  parcial: { label: 'Parcial', cls: 'bg-blue-100 text-blue-700' },
  vencida: { label: 'Vencida', cls: 'bg-red-100 text-red-700' },
  aberta:  { label: 'Aberta',  cls: 'bg-gray-100 text-gray-600' },
}

function dataBR(iso: string) {
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

export function PagamentosInscrito({
  inscricaoId, eventoId, nome, valorTotal, parcelas, pagamentos: pagamentosInit,
}: Props) {
  const [pagamentos, setPagamentos] = useState(pagamentosInit)
  const [aberto, setAberto] = useState(false)
  const [lancando, setLancando] = useState(false)
  const [valor, setValor] = useState('')
  const [pagoEm, setPagoEm] = useState(new Date().toISOString().split('T')[0])
  const [obs, setObs] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const total = valorTotal ?? 0
  const pago = totalPago(pagamentos)
  const restante = Number((total - pago).toFixed(2))
  const quitado = total > 0 && restante <= 0
  const linhas = calcularParcelas(total, parcelas, pagamentos)

  function lancar() {
    const v = Number(valor.replace(',', '.'))
    if (!(v > 0)) { setErro('Informe um valor maior que zero.'); return }
    setErro(null)
    startTransition(async () => {
      try {
        await registrarPagamentoAction({
          inscricaoId, eventoId, valor: v, pago_em: pagoEm,
          observacao: obs.trim() || null,
        })
        setPagamentos([...pagamentos, {
          id: `tmp-${Date.now()}`, valor: v, pago_em: pagoEm, metodo: 'pix',
          observacao: obs.trim() || null,
        }])
        setValor(''); setObs(''); setLancando(false)
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Erro ao lançar pagamento')
      }
    })
  }

  function remover(id: string) {
    const anterior = pagamentos
    setPagamentos(pagamentos.filter((p) => p.id !== id))
    startTransition(async () => {
      try {
        await removerPagamentoAction(id, eventoId)
      } catch {
        setPagamentos(anterior)
      }
    })
  }

  if (total <= 0) return null

  return (
    <div className="border-t border-border/60">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted/30 transition-colors"
      >
        <span className={`font-medium ${quitado ? 'text-green-700' : 'text-foreground'}`}>
          {formatarBRL(pago)} de {formatarBRL(total)}
        </span>
        {quitado ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">
            <Check className="h-2.5 w-2.5" /> Quitado
          </span>
        ) : (
          <span className="text-muted-foreground">falta {formatarBRL(restante)}</span>
        )}
        <ChevronDown className={`h-3.5 w-3.5 ml-auto text-muted-foreground transition-transform ${aberto ? 'rotate-180' : ''}`} />
      </button>

      {aberto && (
        <div className="px-3 pb-3 space-y-3 bg-muted/10">
          {/* Parcelas */}
          {linhas.length > 0 && (
            <div className="space-y-1 pt-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Parcelas</p>
              {linhas.map((l) => {
                const cfg = statusCfg[l.status]
                return (
                  <div key={l.numero} className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground w-6">{l.numero}ª</span>
                    <span className="text-muted-foreground w-20">{dataBR(l.vencimento)}</span>
                    <span className="font-medium">{formatarBRL(l.valor)}</span>
                    {l.pago > 0 && l.restante > 0 && (
                      <span className="text-muted-foreground">(pago {formatarBRL(l.pago)})</span>
                    )}
                    <span className={`ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded-full ${cfg.cls}`}>
                      {cfg.label}
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          {/* Pagamentos lançados */}
          <div className="space-y-1">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
              Pagamentos de {nome.split(' ')[0]}
            </p>
            {pagamentos.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum pagamento lançado.</p>
            ) : (
              pagamentos.map((p) => (
                <div key={p.id} className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground w-20">{dataBR(p.pago_em)}</span>
                  <span className="font-medium">{formatarBRL(Number(p.valor))}</span>
                  {p.observacao && <span className="text-muted-foreground truncate">{p.observacao}</span>}
                  <button
                    type="button"
                    onClick={() => remover(p.id)}
                    className="ml-auto text-muted-foreground hover:text-destructive shrink-0"
                    aria-label="Remover pagamento"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Lançar novo */}
          {lancando ? (
            <div className="space-y-2 rounded-lg border border-border bg-background p-2">
              <div className="flex gap-2">
                <div className="w-28 space-y-1">
                  <Label className="text-[11px]">Valor (R$)</Label>
                  <Input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" placeholder="50.00" className="h-8 text-sm" />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <Label className="text-[11px]">Recebido em</Label>
                  <Input type="date" value={pagoEm} onChange={(e) => setPagoEm(e.target.value)} className="h-8 text-sm" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Observação (opcional)</Label>
                <Input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex: 1ª parcela, pago em dinheiro" className="h-8 text-sm" />
              </div>
              {erro && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> {erro}
                </p>
              )}
              <div className="flex gap-2">
                <Button size="sm" onClick={lancar} disabled={isPending}>
                  {isPending ? 'Lançando...' : 'Lançar'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setLancando(false); setErro(null) }}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setLancando(true)}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Plus className="h-3 w-3" /> Lançar pagamento
            </button>
          )}
        </div>
      )}
    </div>
  )
}
