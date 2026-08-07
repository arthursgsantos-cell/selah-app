'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  AlertCircle, Check, ChevronDown, Download, FileText, Loader2, Paperclip,
  Pencil, Phone, Plus, Printer, Search, Trash2, UserPlus, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { VisualizadorComprovante } from '@/components/shared/visualizador-comprovante'
import {
  adicionarInscritoAction,
  atualizarInscritoAction,
  excluirPagamentoAction,
  lancarPagamentoAction,
  removerInscritoAction,
} from '@/app/actions/gestao-evento'
import {
  calcularParcelas, formatarBRL, totalPago,
  type ParcelaEvento,
} from '@/lib/evento-cobranca'
import type { CampoFormulario } from '@/lib/supabase/types'

export interface PagamentoGestao {
  id: string
  valor: number
  pago_em: string
  metodo: string | null
  observacao: string | null
  comprovante: boolean
}

export interface InscritoGestao {
  id: string
  nome: string
  telefone: string | null
  status: string
  origem: string
  observacao: string | null
  valorTotal: number | null
  criadoEm: string
  dados: Record<string, string>
  pagamentos: PagamentoGestao[]
}

interface Props {
  eventoId: string
  eventoTitulo: string
  inscritos: InscritoGestao[]
  parcelas: ParcelaEvento[]
  campos: CampoFormulario[]
  /** Valor sugerido ao cadastrar alguém à mão (preço único do evento). */
  valorPadrao: number | null
  /**
   * A liderança que só acompanha vê os mesmos números, sem os controles: quem
   * mexe no dinheiro é quem organiza o evento.
   */
  somenteLeitura?: boolean
}

const STATUS = {
  pendente: { label: 'Pendente', cls: 'bg-amber-100 text-amber-700' },
  confirmado: { label: 'Confirmado', cls: 'bg-green-100 text-green-700' },
  cancelado: { label: 'Cancelado', cls: 'bg-red-100 text-red-700' },
} as const

const METODOS = ['pix', 'dinheiro', 'cartão', 'transferência', 'outro']

type Filtro = 'todos' | 'devendo' | 'quitados' | 'cancelados'

const FILTROS: { id: Filtro; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'devendo', label: 'Devendo' },
  { id: 'quitados', label: 'Quitados' },
  { id: 'cancelados', label: 'Cancelados' },
]

function dataBR(iso: string) {
  const [a, m, d] = iso.split('-')
  return d ? `${d}/${m}/${a}` : iso
}

function hojeISO() {
  return new Date().toISOString().split('T')[0]
}

/** Link do WhatsApp. O DDI só entra quando o número não veio com ele. */
function linkWhatsApp(telefone: string): string {
  const digitos = telefone.replace(/\D/g, '')
  return `https://wa.me/${digitos.length <= 11 ? `55${digitos}` : digitos}`
}

/**
 * Painel de gestão das inscrições de um evento.
 *
 * Substitui a planilha que o organizador mantinha por fora: cadastrar quem se
 * inscreveu no WhatsApp, anotar quem pagou, quando pagou, com qual comprovante,
 * e ver de relance quem ainda deve. Tudo acontece na mesma lista, sem trocar
 * de tela — quem confere pagamento faz isso em série, com o celular numa mão e
 * o extrato do banco na outra.
 */
export function GestaoInscritos({
  eventoId, eventoTitulo, inscritos: inicial, parcelas, campos, valorPadrao,
  somenteLeitura = false,
}: Props) {
  const [inscritos, setInscritos] = useState(inicial)
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [aberto, setAberto] = useState<string | null>(null)
  const [adicionando, setAdicionando] = useState(false)
  const [comprovante, setComprovante] = useState<{ id: string; nome: string } | null>(null)

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return inscritos.filter((i) => {
      const pago = totalPago(i.pagamentos)
      const total = i.valorTotal ?? 0
      const quitado = total > 0 && pago >= total

      if (filtro === 'cancelados' && i.status !== 'cancelado') return false
      if (filtro !== 'cancelados' && i.status === 'cancelado') return false
      if (filtro === 'devendo' && (quitado || total === 0)) return false
      if (filtro === 'quitados' && !quitado) return false

      if (!termo) return true
      return (
        i.nome.toLowerCase().includes(termo) ||
        (i.telefone ?? '').includes(termo) ||
        Object.values(i.dados).some((v) => String(v).toLowerCase().includes(termo))
      )
    })
  }, [inscritos, busca, filtro])

  const totais = useMemo(() => {
    const ativos = inscritos.filter((i) => i.status !== 'cancelado')
    const previsto = ativos.reduce((s, i) => s + (i.valorTotal ?? 0), 0)
    const pago = ativos.reduce((s, i) => s + totalPago(i.pagamentos), 0)
    return {
      pessoas: ativos.length,
      previsto,
      pago,
      saldo: Math.max(0, Number((previsto - pago).toFixed(2))),
      devendo: ativos.filter((i) => (i.valorTotal ?? 0) > totalPago(i.pagamentos)).length,
    }
  }, [inscritos])

  /** Planilha para prestação de contas — o formato que a tesouraria já usa. */
  function exportarCSV() {
    const colunas = ['Nome', 'Telefone', 'Status', 'Valor previsto', 'Valor pago', 'Saldo', 'Observação']
    const linhas = inscritos.map((i) => {
      const pago = totalPago(i.pagamentos)
      const total = i.valorTotal ?? 0
      return [
        i.nome,
        i.telefone ?? '',
        STATUS[i.status as keyof typeof STATUS]?.label ?? i.status,
        total.toFixed(2).replace('.', ','),
        pago.toFixed(2).replace('.', ','),
        Math.max(0, total - pago).toFixed(2).replace('.', ','),
        i.observacao ?? '',
      ]
    })

    const csv = [colunas, ...linhas]
      .map((linha) => linha.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';'))
      .join('\n')

    // BOM para o Excel abrir os acentos direito.
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `inscritos-${eventoTitulo.replace(/[^\w]+/g, '-').toLowerCase()}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  function atualizarLocal(id: string, mudanca: Partial<InscritoGestao>) {
    setInscritos((atual) => atual.map((i) => (i.id === id ? { ...i, ...mudanca } : i)))
  }

  return (
    <section className="space-y-3 nao-imprimir">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold">Inscritos e pagamentos</h2>
        <span className="text-xs text-muted-foreground">
          {totais.pessoas} {totais.pessoas === 1 ? 'pessoa' : 'pessoas'}
          {totais.devendo > 0 && ` · ${totais.devendo} devendo`}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <Button size="sm" variant="outline" onClick={exportarCSV} title="Baixar planilha">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">CSV</span>
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.print()} title="Imprimir">
            <Printer className="h-4 w-4" />
          </Button>
          {!somenteLeitura && (
            <Button size="sm" onClick={() => setAdicionando(true)}>
              <UserPlus className="h-4 w-4" />
              Adicionar
            </Button>
          )}
        </div>
      </div>

      {/* Consolidado do dinheiro, sempre à vista */}
      {totais.previsto > 0 && (
        <div className="grid grid-cols-3 gap-2 rounded-2xl border border-border bg-card p-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Previsto</p>
            <p className="font-semibold tabular-nums">{formatarBRL(totais.previsto)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Recebido</p>
            <p className="font-semibold tabular-nums text-green-600">{formatarBRL(totais.pago)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">A receber</p>
            <p className={`font-semibold tabular-nums ${totais.saldo > 0 ? 'text-amber-600' : 'text-muted-foreground'}`}>
              {formatarBRL(totais.saldo)}
            </p>
          </div>
        </div>
      )}

      {adicionando && (
        <FormularioInscrito
          eventoId={eventoId}
          valorPadrao={valorPadrao}
          aoCancelar={() => setAdicionando(false)}
          aoSalvar={(novo) => {
            setInscritos((atual) => [...atual, novo])
            setAdicionando(false)
            setAberto(novo.id)
          }}
        />
      )}

      {/* Busca e filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[10rem] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou telefone..."
            className="pl-8"
          />
        </div>
        <div className="flex gap-1.5">
          {FILTROS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFiltro(f.id)}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                filtro === f.id
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border text-muted-foreground hover:bg-accent'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {lista.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-10 text-center">
          <p className="text-sm text-muted-foreground">
            {inscritos.length === 0
              ? 'Nenhum inscrito ainda. Use "Adicionar" para cadastrar quem se inscreveu por fora do app.'
              : 'Ninguém com esse filtro.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {lista.map((inscrito) => (
            <CartaoInscrito
              key={inscrito.id}
              eventoId={eventoId}
              inscrito={inscrito}
              parcelas={parcelas}
              campos={campos}
              somenteLeitura={somenteLeitura}
              expandido={aberto === inscrito.id}
              aoAlternar={() => setAberto(aberto === inscrito.id ? null : inscrito.id)}
              aoAtualizar={(mudanca) => atualizarLocal(inscrito.id, mudanca)}
              aoRemover={() => setInscritos((atual) => atual.filter((i) => i.id !== inscrito.id))}
              aoVerComprovante={(pagamentoId) =>
                setComprovante({ id: pagamentoId, nome: inscrito.nome })
              }
            />
          ))}
        </div>
      )}

      {comprovante && (
        <VisualizadorComprovante
          url={`/api/evento/comprovante/${comprovante.id}`}
          titulo={`Comprovante · ${comprovante.nome}`}
          aberto
          aoFechar={() => setComprovante(null)}
        />
      )}
    </section>
  )
}

// ── Cartão de uma pessoa ──────────────────────────────────────────────────

function CartaoInscrito({
  eventoId, inscrito, parcelas, campos, somenteLeitura, expandido,
  aoAlternar, aoAtualizar, aoRemover, aoVerComprovante,
}: {
  eventoId: string
  inscrito: InscritoGestao
  parcelas: ParcelaEvento[]
  campos: CampoFormulario[]
  somenteLeitura: boolean
  expandido: boolean
  aoAlternar: () => void
  aoAtualizar: (mudanca: Partial<InscritoGestao>) => void
  aoRemover: () => void
  aoVerComprovante: (pagamentoId: string) => void
}) {
  const [editando, setEditando] = useState(false)
  const [lancando, setLancando] = useState(false)
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const total = inscrito.valorTotal ?? 0
  const pago = totalPago(inscrito.pagamentos)
  const restante = Number((total - pago).toFixed(2))
  const quitado = total > 0 && restante <= 0
  const percentual = total > 0 ? Math.min(100, Math.round((pago / total) * 100)) : 0
  const status = STATUS[inscrito.status as keyof typeof STATUS] ?? STATUS.pendente
  const linhas = calcularParcelas(total, parcelas, inscrito.pagamentos)

  function mudarStatus(novo: string) {
    const anterior = inscrito.status
    aoAtualizar({ status: novo })
    startTransition(async () => {
      try {
        await atualizarInscritoAction({ inscricaoId: inscrito.id, eventoId, status: novo })
      } catch (e) {
        aoAtualizar({ status: anterior })
        setErro(e instanceof Error ? e.message : 'Erro ao mudar o status')
      }
    })
  }

  function excluir() {
    startTransition(async () => {
      try {
        await removerInscritoAction(inscrito.id, eventoId)
        aoRemover()
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Erro ao excluir')
        setConfirmandoExclusao(false)
      }
    })
  }

  function removerPagamento(pagamentoId: string) {
    const anteriores = inscrito.pagamentos
    aoAtualizar({ pagamentos: anteriores.filter((p) => p.id !== pagamentoId) })
    startTransition(async () => {
      try {
        await excluirPagamentoAction(pagamentoId, eventoId)
      } catch (e) {
        aoAtualizar({ pagamentos: anteriores })
        setErro(e instanceof Error ? e.message : 'Erro ao remover o pagamento')
      }
    })
  }

  const respostas = campos
    .filter((c) => c.id !== 'nome' && c.id !== 'telefone' && inscrito.dados[c.id])
    .map((c) => ({ label: c.label, valor: inscrito.dados[c.id] }))

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      {/* Linha resumida — o que basta para saber quem já pagou */}
      <button
        type="button"
        onClick={aoAlternar}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent/40"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-semibold">{inscrito.nome}</p>
            {inscrito.origem === 'manual' && (
              <span className="shrink-0 rounded-full bg-muted px-1.5 py-px text-[10px] text-muted-foreground">
                manual
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-2">
            <span className={`rounded-full px-1.5 py-px text-[10px] font-medium ${status.cls}`}>
              {status.label}
            </span>
            {total > 0 && (
              <span className={`text-xs tabular-nums ${quitado ? 'text-green-600' : 'text-muted-foreground'}`}>
                {formatarBRL(pago)} de {formatarBRL(total)}
              </span>
            )}
          </div>
        </div>

        {total > 0 && (
          <div className="w-16 shrink-0">
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full ${quitado ? 'bg-green-500' : 'bg-primary'}`}
                style={{ width: `${percentual}%` }}
              />
            </div>
            <p className="mt-0.5 text-right text-[10px] tabular-nums text-muted-foreground">
              {quitado ? 'quitado' : `falta ${formatarBRL(restante)}`}
            </p>
          </div>
        )}

        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${expandido ? 'rotate-180' : ''}`}
        />
      </button>

      {expandido && (
        <div className="space-y-3 border-t border-border/60 bg-muted/10 px-3 py-3">
          {erro && (
            <p className="flex items-center gap-1 text-xs text-destructive">
              <AlertCircle className="h-3 w-3" /> {erro}
            </p>
          )}

          {editando ? (
            <FormularioInscrito
              eventoId={eventoId}
              inscrito={inscrito}
              valorPadrao={null}
              aoCancelar={() => setEditando(false)}
              aoSalvar={(atualizado) => {
                aoAtualizar(atualizado)
                setEditando(false)
              }}
            />
          ) : (
            <>
              {/* Contato e respostas do formulário */}
              <div className="space-y-1">
                {inscrito.telefone && (
                  <a
                    href={linkWhatsApp(inscrito.telefone)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#25D366] hover:underline"
                  >
                    <Phone className="h-3 w-3" />
                    {inscrito.telefone}
                  </a>
                )}
                {respostas.map((r) => (
                  <p key={r.label} className="text-xs">
                    <span className="text-muted-foreground">{r.label}: </span>
                    <span className="font-medium">{r.valor}</span>
                  </p>
                ))}
                {inscrito.observacao && (
                  <p className="rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-800">
                    {inscrito.observacao}
                  </p>
                )}
              </div>

              {/* Status em um toque: é o que mais muda no dia do evento */}
              {!somenteLeitura && (
              <div className="flex flex-wrap items-center gap-1.5">
                {(Object.keys(STATUS) as (keyof typeof STATUS)[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={isPending || inscrito.status === s}
                    onClick={() => mudarStatus(s)}
                    className={`rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                      inscrito.status === s
                        ? `border-transparent ${STATUS[s].cls}`
                        : 'border-border text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    {STATUS[s].label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setEditando(true)}
                  className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Pencil className="h-3 w-3" /> Editar
                </button>
              </div>
              )}
            </>
          )}

          {/* Parcelas do plano do evento */}
          {linhas.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Parcelas
              </p>
              {linhas.map((l) => (
                <div key={l.numero} className="flex items-center gap-2 text-xs">
                  <span className="w-6 text-muted-foreground">{l.numero}ª</span>
                  <span className="w-20 text-muted-foreground">{dataBR(l.vencimento)}</span>
                  <span className="font-medium tabular-nums">{formatarBRL(l.valor)}</span>
                  <span
                    className={`ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                      l.status === 'paga' ? 'bg-green-100 text-green-700'
                      : l.status === 'vencida' ? 'bg-red-100 text-red-700'
                      : l.status === 'parcial' ? 'bg-blue-100 text-blue-700'
                      : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {l.status}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Pagamentos lançados */}
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Pagamentos
            </p>
            {inscrito.pagamentos.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nada recebido ainda.</p>
            ) : (
              inscrito.pagamentos.map((p) => (
                <div key={p.id} className="flex items-center gap-2 text-xs">
                  <span className="w-20 shrink-0 text-muted-foreground">{dataBR(p.pago_em)}</span>
                  <span className="font-medium tabular-nums">{formatarBRL(Number(p.valor))}</span>
                  {p.metodo && <span className="text-muted-foreground">{p.metodo}</span>}
                  {p.observacao && (
                    <span className="truncate text-muted-foreground/80">{p.observacao}</span>
                  )}
                  {p.comprovante && (
                    <button
                      type="button"
                      onClick={() => aoVerComprovante(p.id)}
                      className="ml-auto inline-flex shrink-0 items-center gap-1 font-medium text-primary hover:underline"
                    >
                      <FileText className="h-3 w-3" /> comprovante
                    </button>
                  )}
                  {!somenteLeitura && (
                    <button
                      type="button"
                      onClick={() => removerPagamento(p.id)}
                      aria-label="Remover pagamento"
                      className={`shrink-0 text-muted-foreground hover:text-destructive ${p.comprovante ? '' : 'ml-auto'}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          {somenteLeitura ? null : lancando ? (
            <FormularioPagamento
              eventoId={eventoId}
              inscricaoId={inscrito.id}
              sugestao={restante > 0 ? restante : null}
              aoCancelar={() => setLancando(false)}
              aoSalvar={(pagamento) => {
                aoAtualizar({ pagamentos: [...inscrito.pagamentos, pagamento] })
                setLancando(false)
              }}
            />
          ) : (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setLancando(true)}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <Plus className="h-3 w-3" /> Lançar pagamento
              </button>

              {confirmandoExclusao ? (
                <span className="ml-auto flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Excluir a ficha?</span>
                  <button
                    type="button"
                    onClick={excluir}
                    disabled={isPending}
                    className="font-medium text-destructive hover:underline"
                  >
                    {isPending ? 'Excluindo...' : 'Sim'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmandoExclusao(false)}
                    className="text-muted-foreground hover:underline"
                  >
                    não
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmandoExclusao(true)}
                  className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" /> Excluir ficha
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Cadastro e edição de ficha ────────────────────────────────────────────

function FormularioInscrito({
  eventoId, inscrito, valorPadrao, aoCancelar, aoSalvar,
}: {
  eventoId: string
  inscrito?: InscritoGestao
  valorPadrao: number | null
  aoCancelar: () => void
  aoSalvar: (inscrito: InscritoGestao) => void
}) {
  const [nome, setNome] = useState(inscrito?.nome ?? '')
  const [telefone, setTelefone] = useState(inscrito?.telefone ?? '')
  const [valor, setValor] = useState(
    inscrito?.valorTotal != null
      ? String(inscrito.valorTotal).replace('.', ',')
      : valorPadrao != null ? String(valorPadrao).replace('.', ',') : ''
  )
  const [observacao, setObservacao] = useState(inscrito?.observacao ?? '')
  const [erro, setErro] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function salvar() {
    if (!nome.trim()) { setErro('Informe o nome.'); return }
    const valorTotal = valor.trim() ? Number(valor.replace(/\./g, '').replace(',', '.')) : null
    if (valorTotal !== null && !Number.isFinite(valorTotal)) {
      setErro('Valor inválido.'); return
    }
    setErro(null)

    startTransition(async () => {
      try {
        if (inscrito) {
          await atualizarInscritoAction({
            inscricaoId: inscrito.id,
            eventoId,
            nome,
            telefone,
            valorTotal,
            observacao,
          })
          aoSalvar({
            ...inscrito,
            nome: nome.trim(),
            telefone: telefone.trim() || null,
            valorTotal,
            observacao: observacao.trim() || null,
          })
        } else {
          const { id } = await adicionarInscritoAction({
            eventoId, nome, telefone, valorTotal, observacao,
          })
          aoSalvar({
            id,
            nome: nome.trim(),
            telefone: telefone.trim() || null,
            status: 'confirmado',
            origem: 'manual',
            observacao: observacao.trim() || null,
            valorTotal,
            criadoEm: new Date().toISOString(),
            dados: {},
            pagamentos: [],
          })
        }
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Erro ao salvar')
      }
    })
  }

  return (
    <div className="space-y-2 rounded-xl border border-border bg-background p-3">
      <div className="flex flex-wrap gap-2">
        <div className="min-w-[10rem] flex-1 space-y-1">
          <Label className="text-[11px]">Nome</Label>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} className="h-9" autoFocus />
        </div>
        <div className="w-36 space-y-1">
          <Label className="text-[11px]">Telefone</Label>
          <Input
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            inputMode="tel"
            placeholder="84 99999-0000"
            className="h-9"
          />
        </div>
        <div className="w-28 space-y-1">
          <Label className="text-[11px]">Valor (R$)</Label>
          <Input
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            inputMode="decimal"
            placeholder="150,00"
            className="h-9"
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-[11px]">Observação</Label>
        <Input
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          placeholder="Ex.: vai pagar dia 10, pediu meia"
          className="h-9"
        />
      </div>

      {erro && (
        <p className="flex items-center gap-1 text-xs text-destructive">
          <AlertCircle className="h-3 w-3" /> {erro}
        </p>
      )}

      <div className="flex gap-2">
        <Button size="sm" onClick={salvar} disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {inscrito ? 'Salvar' : 'Cadastrar'}
        </Button>
        <Button size="sm" variant="ghost" onClick={aoCancelar} disabled={isPending}>
          <X className="h-4 w-4" />
          Cancelar
        </Button>
      </div>
    </div>
  )
}

// ── Lançamento de pagamento ───────────────────────────────────────────────

function FormularioPagamento({
  eventoId, inscricaoId, sugestao, aoCancelar, aoSalvar,
}: {
  eventoId: string
  inscricaoId: string
  /** Quanto falta — preenchido de saída, que é o lançamento mais comum. */
  sugestao: number | null
  aoCancelar: () => void
  aoSalvar: (pagamento: PagamentoGestao) => void
}) {
  const [valor, setValor] = useState(sugestao != null ? String(sugestao).replace('.', ',') : '')
  const [pagoEm, setPagoEm] = useState(hojeISO())
  const [metodo, setMetodo] = useState('pix')
  const [observacao, setObservacao] = useState('')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function salvar() {
    const numero = Number(valor.replace(/\./g, '').replace(',', '.'))
    if (!(numero > 0)) { setErro('Informe um valor maior que zero.'); return }
    setErro(null)

    const fd = new FormData()
    fd.append('eventoId', eventoId)
    fd.append('inscricaoId', inscricaoId)
    fd.append('valor', valor)
    fd.append('pagoEm', pagoEm)
    fd.append('metodo', metodo)
    fd.append('observacao', observacao)
    if (arquivo) fd.append('comprovante', arquivo)

    startTransition(async () => {
      try {
        const { id } = await lancarPagamentoAction(fd)
        aoSalvar({
          id,
          valor: numero,
          pago_em: pagoEm,
          metodo,
          observacao: observacao.trim() || null,
          comprovante: Boolean(arquivo),
        })
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Erro ao lançar o pagamento')
      }
    })
  }

  return (
    <div className="space-y-2 rounded-xl border border-border bg-background p-3">
      <div className="flex flex-wrap gap-2">
        <div className="w-28 space-y-1">
          <Label className="text-[11px]">Valor (R$)</Label>
          <Input
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            inputMode="decimal"
            placeholder="150,00"
            className="h-9"
            autoFocus
          />
        </div>
        <div className="w-36 space-y-1">
          <Label className="text-[11px]">Pago em</Label>
          <Input type="date" value={pagoEm} onChange={(e) => setPagoEm(e.target.value)} className="h-9" />
        </div>
        <div className="w-32 space-y-1">
          <Label className="text-[11px]">Forma</Label>
          <select
            value={metodo}
            onChange={(e) => setMetodo(e.target.value)}
            className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring"
          >
            {METODOS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-[11px]">Observação</Label>
        <Input
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          placeholder="Ex.: 1ª parcela, pago no culto"
          className="h-9"
        />
      </div>

      {/* Comprovante: foto do print do PIX ou PDF do banco */}
      <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-accent/40">
        <Paperclip className="h-3.5 w-3.5" />
        {arquivo ? (
          <span className="truncate font-medium text-foreground">{arquivo.name}</span>
        ) : (
          'Anexar comprovante (opcional)'
        )}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
          className="hidden"
          onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
        />
        {arquivo && (
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); setArquivo(null) }}
            className="ml-auto text-muted-foreground hover:text-destructive"
            aria-label="Remover anexo"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </label>

      {erro && (
        <p className="flex items-center gap-1 text-xs text-destructive">
          <AlertCircle className="h-3 w-3" /> {erro}
        </p>
      )}

      <div className="flex gap-2">
        <Button size="sm" onClick={salvar} disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {isPending ? 'Lançando...' : 'Lançar'}
        </Button>
        <Button size="sm" variant="ghost" onClick={aoCancelar} disabled={isPending}>
          Cancelar
        </Button>
      </div>
    </div>
  )
}
