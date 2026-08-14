'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Banknote, CalendarClock, Check, ChevronDown, ChevronUp, Loader2, Plus, Settings2, Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  salvarCobrancaTurmaAction,
  registrarPagamentoEnsinoAction,
  removerPagamentoEnsinoAction,
  definirValorAlunoAction,
} from '@/app/actions/ensino/cobranca'
import {
  formatarBRL, STATUS_LABEL,
  type ParcelaTurma, type PagamentoEnsino, type SituacaoAluno,
} from '@/lib/ensino/cobranca'
import type { StatusInscricaoEnsino } from '@/lib/supabase/types'

export type LinhaAluno = SituacaoAluno & {
  telefone: string | null
  statusInscricao: StatusInscricaoEnsino
  pagamentos: PagamentoEnsino[]
}

interface Props {
  turmaId: string
  valorTurma: number | null
  instrucoes: string | null
  parcelas: ParcelaTurma[]
  alunos: LinhaAluno[]
}

const hojeISO = () => new Date().toISOString().slice(0, 10)

/** "150,00" e "150.00" vêm da mesma pessoa em teclados diferentes. */
function paraNumero(texto: string): number | null {
  const limpo = texto.trim().replace(/\./g, '').replace(',', '.')
  if (!limpo) return null
  const n = Number(limpo)
  return Number.isFinite(n) ? n : null
}

/**
 * Painel de pagamentos da turma.
 *
 * A tela abre no que a secretaria quer saber primeiro — quanto entrou, quanto
 * falta, quem está atrasado — e só depois oferece a configuração do valor. A
 * ordem inversa (configurar antes de ver) obrigava a rolar a página inteira
 * toda vez que alguém pagava.
 */
export function FinanceiroTurma({ turmaId, valorTurma, instrucoes, parcelas, alunos }: Props) {
  const router = useRouter()
  const [configAberta, setConfigAberta] = useState(valorTurma == null)
  const [expandido, setExpandido] = useState<string | null>(null)

  const totalPrevisto = alunos.reduce((a, l) => a + l.total, 0)
  const totalRecebido = alunos.reduce((a, l) => a + l.pago, 0)
  const totalFalta = alunos.reduce((a, l) => a + l.restante, 0)
  const atrasados = alunos.filter((l) => l.status === 'atrasado').length

  return (
    <div className="space-y-4">
      {/* Resumo */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { rotulo: 'Previsto', valor: totalPrevisto, cor: 'text-foreground' },
          { rotulo: 'Recebido', valor: totalRecebido, cor: 'text-green-600' },
          { rotulo: 'Falta', valor: totalFalta, cor: totalFalta > 0 ? 'text-amber-600' : 'text-muted-foreground' },
        ].map((c) => (
          <div key={c.rotulo} className="rounded-2xl border border-border bg-card px-3 py-3 text-center">
            <p className={`text-base font-bold tabular-nums ${c.cor}`}>{formatarBRL(c.valor)}</p>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mt-0.5">
              {c.rotulo}
            </p>
          </div>
        ))}
      </div>

      {atrasados > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          {atrasados} {atrasados === 1 ? 'aluno está atrasado' : 'alunos estão atrasados'} em alguma parcela.
        </div>
      )}

      <ConfiguracaoCobranca
        turmaId={turmaId}
        valorInicial={valorTurma}
        instrucoesInicial={instrucoes}
        parcelasIniciais={parcelas}
        aberta={configAberta}
        onAlternar={() => setConfigAberta((v) => !v)}
      />

      {/* Alunos */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest px-1">
          Alunos ({alunos.length})
        </p>

        {alunos.length === 0 && (
          <p className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
            Ninguém inscrito nesta turma ainda.
          </p>
        )}

        {alunos.map((a) => {
          const cfg = STATUS_LABEL[a.status]
          const aberto = expandido === a.inscricaoId
          return (
            <div key={a.inscricaoId} className="rounded-xl border border-border bg-card overflow-hidden">
              <button
                type="button"
                onClick={() => setExpandido(aberto ? null : a.inscricaoId)}
                className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-accent/40 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{a.nome}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                    {a.total > 0 ? (
                      <>
                        {formatarBRL(a.pago)} de {formatarBRL(a.total)}
                        {a.restante > 0 && <> · falta {formatarBRL(a.restante)}</>}
                      </>
                    ) : (
                      'Sem cobrança'
                    )}
                    {a.combinado && <span className="ml-1 text-primary">· valor combinado</span>}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${cfg.classe}`}>
                  {cfg.texto}
                </span>
                {aberto ? (
                  <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
              </button>

              {aberto && (
                <div className="border-t border-border/60 bg-muted/20 px-3 py-3 space-y-3">
                  {a.parcelas.length > 0 && (
                    <div className="space-y-1">
                      {a.parcelas.map((p) => (
                        <div key={p.numero} className="flex items-center gap-2 text-xs">
                          <span className="w-7 text-muted-foreground">{p.numero}ª</span>
                          <span className="w-24 tabular-nums">{formatarBRL(p.valor)}</span>
                          <span className="text-muted-foreground">
                            vence {p.vencimento.split('-').reverse().join('/')}
                          </span>
                          <span
                            className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              p.status === 'paga'
                                ? 'bg-green-100 text-green-700'
                                : p.status === 'vencida'
                                  ? 'bg-red-100 text-red-700'
                                  : p.status === 'parcial'
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {p.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <ExtratoAluno
                    turmaId={turmaId}
                    inscricaoId={a.inscricaoId}
                    pagamentos={a.pagamentos}
                    restante={a.restante}
                    onMudou={() => router.refresh()}
                  />

                  <ValorCombinado
                    turmaId={turmaId}
                    inscricaoId={a.inscricaoId}
                    valorAtual={a.combinado ? a.total : null}
                    valorTurma={valorTurma}
                    onMudou={() => router.refresh()}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ConfiguracaoCobranca({
  turmaId, valorInicial, instrucoesInicial, parcelasIniciais, aberta, onAlternar,
}: {
  turmaId: string
  valorInicial: number | null
  instrucoesInicial: string | null
  parcelasIniciais: ParcelaTurma[]
  aberta: boolean
  onAlternar: () => void
}) {
  const router = useRouter()
  const [valor, setValor] = useState(valorInicial != null ? String(valorInicial).replace('.', ',') : '')
  const [instrucoes, setInstrucoes] = useState(instrucoesInicial ?? '')
  const [parcelas, setParcelas] = useState(
    parcelasIniciais.map((p) => ({
      vencimento: p.vencimento,
      percentual: p.percentual != null ? String(p.percentual) : '',
    }))
  )
  const [erro, setErro] = useState<string | null>(null)
  const [salvo, setSalvo] = useState(false)
  const [salvando, iniciar] = useTransition()

  function salvar() {
    setErro(null)
    iniciar(async () => {
      const r = await salvarCobrancaTurmaAction({
        turmaId,
        valor: paraNumero(valor),
        instrucoes,
        parcelas: parcelas
          .filter((p) => p.vencimento)
          .map((p) => ({
            vencimento: p.vencimento,
            percentual: p.percentual ? paraNumero(p.percentual) : null,
          })),
      })
      if (!r.ok) { setErro(r.erro); return }
      setSalvo(true)
      router.refresh()
      setTimeout(() => setSalvo(false), 2500)
    })
  }

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <button
        type="button"
        onClick={onAlternar}
        className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-accent/40 transition-colors"
      >
        <Settings2 className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold flex-1">
          Valor do curso
          {valorInicial != null && (
            <span className="ml-1.5 font-normal text-muted-foreground">
              — {formatarBRL(valorInicial)}
              {parcelasIniciais.length > 0 && ` em ${parcelasIniciais.length}x`}
            </span>
          )}
        </span>
        {aberta ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {aberta && (
        <div className="border-t border-border/60 p-4 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Quanto custa (deixe vazio para curso gratuito)</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">R$</span>
              <Input
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                inputMode="decimal"
                placeholder="150,00"
                className="h-9 max-w-[10rem]"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Como pagar (aparece para o aluno)</Label>
            <Textarea
              value={instrucoes}
              onChange={(e) => setInstrucoes(e.target.value)}
              rows={2}
              placeholder="Ex: PIX da igreja, na secretaria antes da primeira aula."
              className="text-sm resize-none"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">Parcelas</p>
            </div>
            {parcelas.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Sem parcelas — o valor é cobrado de uma vez.
              </p>
            )}
            {parcelas.map((p, i) => (
              <div key={i} className="flex items-end gap-2">
                <span className="w-7 pb-2 text-xs text-muted-foreground">{i + 1}ª</span>
                <div className="flex-1 space-y-1">
                  <Label className="text-[11px]">Vence em</Label>
                  <Input
                    type="date"
                    value={p.vencimento}
                    onChange={(e) =>
                      setParcelas(parcelas.map((x, j) => (j === i ? { ...x, vencimento: e.target.value } : x)))
                    }
                    className="h-8 text-sm"
                  />
                </div>
                <div className="w-20 space-y-1">
                  <Label className="text-[11px]">%</Label>
                  <Input
                    value={p.percentual}
                    onChange={(e) =>
                      setParcelas(parcelas.map((x, j) => (j === i ? { ...x, percentual: e.target.value } : x)))
                    }
                    inputMode="decimal"
                    placeholder="auto"
                    className="h-8 text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setParcelas(parcelas.filter((_, j) => j !== i))}
                  className="h-8 px-1 text-muted-foreground hover:text-destructive"
                  aria-label={`Remover ${i + 1}ª parcela`}
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
                Deixe o % em branco para dividir igualmente. Se preencher todos, a soma
                precisa fechar 100%.
              </p>
            )}
          </div>

          {erro && <p className="text-xs text-destructive">{erro}</p>}

          <Button size="sm" onClick={salvar} disabled={salvando} className="gap-1.5">
            {salvando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {salvo && <Check className="h-3.5 w-3.5" />}
            {salvando ? 'Salvando…' : salvo ? 'Salvo' : 'Salvar valor'}
          </Button>
        </div>
      )}
    </div>
  )
}

function ExtratoAluno({
  turmaId, inscricaoId, pagamentos, restante, onMudou,
}: {
  turmaId: string
  inscricaoId: string
  pagamentos: PagamentoEnsino[]
  restante: number
  onMudou: () => void
}) {
  const [valor, setValor] = useState(restante > 0 ? String(restante).replace('.', ',') : '')
  const [pagoEm, setPagoEm] = useState(hojeISO())
  const [metodo, setMetodo] = useState('pix')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, iniciar] = useTransition()

  function lancar() {
    setErro(null)
    const n = paraNumero(valor)
    if (n == null || n <= 0) { setErro('Informe o valor recebido.'); return }
    iniciar(async () => {
      const r = await registrarPagamentoEnsinoAction({
        inscricaoId, turmaId, valor: n, pagoEm, metodo,
      })
      if (!r.ok) { setErro(r.erro); return }
      setValor('')
      onMudou()
    })
  }

  function remover(id: string) {
    iniciar(async () => {
      const r = await removerPagamentoEnsinoAction(id, turmaId)
      if (!r.ok) { setErro(r.erro); return }
      onMudou()
    })
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
        <Banknote className="h-3.5 w-3.5" /> Pagamentos recebidos
      </p>

      {pagamentos.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nada recebido ainda.</p>
      ) : (
        <div className="space-y-1">
          {pagamentos.map((p) => (
            <div key={p.id} className="flex items-center gap-2 text-xs">
              <span className="font-medium tabular-nums">{formatarBRL(p.valor)}</span>
              <span className="text-muted-foreground">
                {p.pago_em.split('-').reverse().join('/')}
                {p.metodo && ` · ${p.metodo}`}
              </span>
              <button
                type="button"
                onClick={() => remover(p.id)}
                disabled={salvando}
                className="ml-auto text-muted-foreground hover:text-destructive disabled:opacity-40"
                aria-label="Apagar lançamento"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2 flex-wrap">
        <div className="w-24 space-y-1">
          <Label className="text-[11px]">Valor</Label>
          <Input
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            inputMode="decimal"
            placeholder="50,00"
            className="h-8 text-sm"
          />
        </div>
        <div className="w-36 space-y-1">
          <Label className="text-[11px]">Quando</Label>
          <Input
            type="date"
            value={pagoEm}
            onChange={(e) => setPagoEm(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <div className="w-24 space-y-1">
          <Label className="text-[11px]">Como</Label>
          <select
            value={metodo}
            onChange={(e) => setMetodo(e.target.value)}
            className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm"
          >
            <option value="pix">PIX</option>
            <option value="dinheiro">Dinheiro</option>
            <option value="cartão">Cartão</option>
            <option value="transferência">Transf.</option>
          </select>
        </div>
        <Button size="sm" onClick={lancar} disabled={salvando} className="h-8 gap-1.5">
          {salvando && <Loader2 className="h-3 w-3 animate-spin" />}
          Lançar
        </Button>
      </div>

      {erro && <p className="text-xs text-destructive">{erro}</p>}
    </div>
  )
}

function ValorCombinado({
  turmaId, inscricaoId, valorAtual, valorTurma, onMudou,
}: {
  turmaId: string
  inscricaoId: string
  valorAtual: number | null
  valorTurma: number | null
  onMudou: () => void
}) {
  const [editando, setEditando] = useState(false)
  const [valor, setValor] = useState(valorAtual != null ? String(valorAtual).replace('.', ',') : '')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, iniciar] = useTransition()

  function salvar(novo: number | null) {
    setErro(null)
    iniciar(async () => {
      const r = await definirValorAlunoAction({ inscricaoId, turmaId, valor: novo })
      if (!r.ok) { setErro(r.erro); return }
      setEditando(false)
      onMudou()
    })
  }

  if (!editando) {
    return (
      <button
        type="button"
        onClick={() => setEditando(true)}
        className="text-xs text-primary hover:underline"
      >
        {valorAtual != null ? 'Mudar valor combinado' : 'Combinar outro valor (bolsa, isenção)'}
      </button>
    )
  }

  return (
    <div className="space-y-2 rounded-lg border border-border bg-background p-2.5">
      <Label className="text-[11px]">
        Valor só para esta pessoa
        {valorTurma != null && (
          <span className="ml-1 text-muted-foreground font-normal">
            (a turma custa {formatarBRL(valorTurma)})
          </span>
        )}
      </Label>
      <div className="flex items-center gap-2 flex-wrap">
        <Input
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          inputMode="decimal"
          placeholder="0,00 para isentar"
          className="h-8 w-32 text-sm"
        />
        <Button size="sm" onClick={() => salvar(paraNumero(valor) ?? 0)} disabled={salvando} className="h-8">
          {salvando ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Salvar'}
        </Button>
        {valorAtual != null && (
          <button
            type="button"
            onClick={() => salvar(null)}
            disabled={salvando}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Voltar ao valor da turma
          </button>
        )}
        <button
          type="button"
          onClick={() => setEditando(false)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Cancelar
        </button>
      </div>
      {erro && <p className="text-xs text-destructive">{erro}</p>}
    </div>
  )
}
