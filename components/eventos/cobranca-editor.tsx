'use client'

import { useEffect, useState, useTransition } from 'react'
import { Plus, Trash2, Check, DollarSign, CalendarClock } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  salvarValoresEventoAction,
  salvarParcelasEventoAction,
  buscarCobrancaEventoAction,
} from '@/app/actions/cobranca'
import { camposComOpcoes, formatarBRL } from '@/lib/evento-cobranca'
import type { CampoFormulario } from '@/lib/supabase/types'

type LinhaValor = { nome: string; valor: string; campo_id: string; opcao: string }
type LinhaParcela = { vencimento: string; percentual: string }

interface Props {
  eventoId: string
  /** Campos do formulário do evento — usados para ligar preço a uma resposta. */
  campos: CampoFormulario[]
}

const selectCls =
  'w-full h-8 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring'

export function CobrancaEditor({ eventoId, campos }: Props) {
  const [valores, setValores] = useState<LinhaValor[]>([])
  const [parcelas, setParcelas] = useState<LinhaParcela[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salvo, setSalvo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const opcoesDisponiveis = camposComOpcoes(campos)

  useEffect(() => {
    buscarCobrancaEventoAction(eventoId)
      .then(({ valores: v, parcelas: p }) => {
        setValores(v.map((x) => ({
          nome: x.nome,
          valor: String(x.valor),
          campo_id: x.campo_id ?? '',
          opcao: x.opcao ?? '',
        })))
        setParcelas(p.map((x) => ({
          vencimento: x.vencimento,
          percentual: x.percentual != null ? String(x.percentual) : '',
        })))
      })
      .catch(() => {})
      .finally(() => setCarregando(false))
  }, [eventoId])

  function salvar() {
    setErro(null)
    startTransition(async () => {
      try {
        await salvarValoresEventoAction(
          eventoId,
          valores.map((v) => ({
            nome: v.nome,
            valor: Number(v.valor.replace(',', '.')) || 0,
            campo_id: v.campo_id || null,
            opcao: v.opcao || null,
          }))
        )
        await salvarParcelasEventoAction(
          eventoId,
          parcelas
            .filter((p) => p.vencimento)
            .map((p) => ({
              vencimento: p.vencimento,
              percentual: p.percentual ? Number(p.percentual.replace(',', '.')) : null,
            }))
        )
        setSalvo(true)
        setTimeout(() => setSalvo(false), 2000)
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Erro ao salvar')
      }
    })
  }

  if (carregando) {
    return <p className="text-xs text-muted-foreground">Carregando valores...</p>
  }

  const totalExemplo = valores.reduce((acc, v) => acc + (Number(v.valor.replace(',', '.')) || 0), 0)

  return (
    <div className="space-y-4 rounded-xl border border-border p-3">
      {/* ── Valores ── */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-medium">Valores</p>
        </div>

        {valores.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Sem valores definidos — o evento fica gratuito.
          </p>
        )}

        {valores.map((v, i) => (
          <div key={i} className="rounded-lg border border-border/60 bg-muted/20 p-2 space-y-2">
            <div className="flex gap-2">
              <div className="flex-1 min-w-0 space-y-1">
                <Label className="text-[11px]">Nome</Label>
                <Input
                  value={v.nome}
                  onChange={(e) => setValores(valores.map((x, j) => j === i ? { ...x, nome: e.target.value } : x))}
                  placeholder="Ex: Adulto"
                  className="h-8 text-sm"
                />
              </div>
              <div className="w-28 shrink-0 space-y-1">
                <Label className="text-[11px]">Valor (R$)</Label>
                <Input
                  value={v.valor}
                  onChange={(e) => setValores(valores.map((x, j) => j === i ? { ...x, valor: e.target.value } : x))}
                  inputMode="decimal"
                  placeholder="150.00"
                  className="h-8 text-sm"
                />
              </div>
              <button
                type="button"
                onClick={() => setValores(valores.filter((_, j) => j !== i))}
                className="self-end h-8 px-1 text-muted-foreground hover:text-destructive"
                aria-label="Remover valor"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>

            {opcoesDisponiveis.length > 0 && (
              <div className="flex gap-2">
                <div className="flex-1 min-w-0 space-y-1">
                  <Label className="text-[11px]">Depende da pergunta</Label>
                  <select
                    value={v.campo_id}
                    onChange={(e) => setValores(valores.map((x, j) => j === i ? { ...x, campo_id: e.target.value, opcao: '' } : x))}
                    className={selectCls}
                  >
                    <option value="">Preço único (todos pagam)</option>
                    {opcoesDisponiveis.map((c) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>
                {v.campo_id && (
                  <div className="flex-1 min-w-0 space-y-1">
                    <Label className="text-[11px]">Quando responder</Label>
                    <select
                      value={v.opcao}
                      onChange={(e) => setValores(valores.map((x, j) => j === i ? { ...x, opcao: e.target.value } : x))}
                      className={selectCls}
                    >
                      <option value="">— escolher —</option>
                      {(opcoesDisponiveis.find((c) => c.id === v.campo_id)?.opcoes ?? []).map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        <button
          type="button"
          onClick={() => setValores([...valores, { nome: '', valor: '', campo_id: '', opcao: '' }])}
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <Plus className="h-3 w-3" /> Adicionar valor
        </button>

        {opcoesDisponiveis.length === 0 && valores.length > 0 && (
          <p className="text-[11px] text-muted-foreground">
            Para cobrar preços diferentes por resposta, crie no formulário uma pergunta de
            múltipla escolha (ex.: &ldquo;Adulto ou criança?&rdquo;).
          </p>
        )}
      </div>

      {/* ── Parcelas ── */}
      <div className="space-y-2 border-t border-border/60 pt-3">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-medium">Parcelamento</p>
        </div>

        {parcelas.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Sem parcelas — o valor é cobrado de uma vez.
          </p>
        )}

        {parcelas.map((p, i) => (
          <div key={i} className="flex gap-2 items-end">
            <div className="w-8 shrink-0 pb-2 text-xs text-muted-foreground">{i + 1}ª</div>
            <div className="flex-1 min-w-0 space-y-1">
              <Label className="text-[11px]">Vencimento</Label>
              <Input
                type="date"
                value={p.vencimento}
                onChange={(e) => setParcelas(parcelas.map((x, j) => j === i ? { ...x, vencimento: e.target.value } : x))}
                className="h-8 text-sm"
              />
            </div>
            <div className="w-24 shrink-0 space-y-1">
              <Label className="text-[11px]">% (opcional)</Label>
              <Input
                value={p.percentual}
                onChange={(e) => setParcelas(parcelas.map((x, j) => j === i ? { ...x, percentual: e.target.value } : x))}
                inputMode="decimal"
                placeholder="auto"
                className="h-8 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={() => setParcelas(parcelas.filter((_, j) => j !== i))}
              className="h-8 px-1 text-muted-foreground hover:text-destructive"
              aria-label="Remover parcela"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() => setParcelas([...parcelas, { vencimento: '', percentual: '' }])}
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <Plus className="h-3 w-3" /> Adicionar parcela
        </button>

        {parcelas.length > 0 && (
          <p className="text-[11px] text-muted-foreground">
            Deixe o percentual em branco para dividir o total igualmente. Se preencher,
            a soma precisa fechar 100%.
          </p>
        )}
      </div>

      {erro && <p className="text-xs text-destructive">{erro}</p>}

      <div className="flex items-center gap-2 border-t border-border/60 pt-3">
        <Button type="button" size="sm" onClick={salvar} disabled={isPending} className="gap-1.5">
          {salvo ? <Check className="h-3.5 w-3.5" /> : null}
          {isPending ? 'Salvando...' : salvo ? 'Salvo' : 'Salvar cobrança'}
        </Button>
        {valores.length > 1 && (
          <span className="text-[11px] text-muted-foreground">
            soma de todos os valores: {formatarBRL(totalExemplo)}
          </span>
        )}
      </div>
    </div>
  )
}
