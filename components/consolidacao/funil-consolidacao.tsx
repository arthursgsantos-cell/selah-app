'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ChevronUp,
  Loader2, MessageCirclePlus, Trash2,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { WhatsAppIcon } from '@/components/ui/whatsapp-icon'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  CANAL_LABELS, DECISAO_LABELS, ETAPA_AJUDA, ETAPA_LABELS, ETAPAS_FUNIL,
  ORIGEM_LABELS, RESULTADO_LABELS, textoSilencio, type FichaConsolidacao,
} from '@/lib/consolidacao'
import {
  atualizarFichaAction, excluirFichaAction, registrarContatoAction,
} from '@/app/actions/consolidacao'
import type {
  CanalContato, EtapaConsolidacao, ResultadoContato,
} from '@/lib/supabase/types'
import { useTransition } from 'react'

const POR_PAGINA = 8

const campoClass =
  'w-full h-9 rounded-lg border border-input bg-background px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50'

interface Props {
  fichas: FichaConsolidacao[]
  celulas: { id: string; nome: string }[]
  responsaveis: { id: string; nome: string }[]
  podeExcluir: boolean
}

/** Aba "Esfriando" primeiro: é a razão de a página existir. */
type ChaveAba = 'esfriando' | EtapaConsolidacao

function whatsappLink(telefone: string, nome: string) {
  const num = telefone.replace(/\D/g, '')
  const full = num.startsWith('55') ? num : `55${num}`
  const primeiro = nome.split(' ')[0]
  const msg = encodeURIComponent(
    `Oi ${primeiro}! Que bom ter você com a gente. Passando para saber como você está.`
  )
  return `https://wa.me/${full}?text=${msg}`
}

function RegistrarContato({ ficha, onPronto }: { ficha: FichaConsolidacao; onPronto: () => void }) {
  const [canal, setCanal] = useState<CanalContato>('whatsapp')
  const [resultado, setResultado] = useState<ResultadoContato>('falou')
  const [nota, setNota] = useState('')
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10))
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, iniciar] = useTransition()

  function salvar() {
    setErro(null)
    iniciar(async () => {
      const r = await registrarContatoAction(ficha.id, { canal, resultado, nota, data })
      if (!r.ok) { setErro(r.erro ?? 'Erro ao registrar'); return }
      onPronto()
    })
  }

  return (
    <div className="mt-2 space-y-2.5 rounded-xl border border-primary/30 bg-background p-3">
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Canal</Label>
          <select value={canal} onChange={(e) => setCanal(e.target.value as CanalContato)} className={campoClass}>
            {(Object.keys(CANAL_LABELS) as CanalContato[]).map((c) => (
              <option key={c} value={c}>{CANAL_LABELS[c]}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Resultado</Label>
          <select value={resultado} onChange={(e) => setResultado(e.target.value as ResultadoContato)} className={campoClass}>
            {(Object.keys(RESULTADO_LABELS) as ResultadoContato[]).map((r) => (
              <option key={r} value={r}>{RESULTADO_LABELS[r]}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Data</Label>
          <input
            type="date"
            value={data}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setData(e.target.value)}
            className={campoClass}
          />
        </div>
      </div>

      <Textarea
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        rows={2}
        placeholder="O que a pessoa disse (opcional)"
        className="text-sm resize-none"
      />

      {erro && <p className="text-xs text-destructive">{erro}</p>}

      <div className="flex gap-2">
        <Button size="sm" onClick={salvar} disabled={salvando} className="h-8 text-xs">
          {salvando && <Loader2 className="h-3 w-3 animate-spin" />}
          {salvando ? 'Registrando…' : 'Registrar contato'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onPronto} disabled={salvando} className="h-8 text-xs">
          Cancelar
        </Button>
      </div>
    </div>
  )
}

function FichaCard({
  ficha, celulas, responsaveis, podeExcluir,
}: {
  ficha: FichaConsolidacao
  celulas: { id: string; nome: string }[]
  responsaveis: { id: string; nome: string }[]
  podeExcluir: boolean
}) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [registrando, setRegistrando] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [salvando, iniciar] = useTransition()

  function atualizar(dados: Parameters<typeof atualizarFichaAction>[1]) {
    iniciar(async () => {
      await atualizarFichaAction(ficha.id, dados)
      router.refresh()
    })
  }

  function excluir() {
    iniciar(async () => {
      await excluirFichaAction(ficha.id)
      setConfirmando(false)
      router.refresh()
    })
  }

  return (
    <div className="border-b border-border py-3 last:border-0">
      <div className="flex items-start gap-3">
        <span
          className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
            ficha.esfriando ? 'bg-red-500' : 'bg-primary/40'
          }`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-sm font-medium">{ficha.nome}</p>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
              {ETAPA_LABELS[ficha.etapa]}
            </span>
            {ficha.decisao && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                {DECISAO_LABELS[ficha.decisao]}
              </span>
            )}
          </div>
          <p className={`mt-0.5 text-xs ${ficha.esfriando ? 'text-red-600' : 'text-muted-foreground'}`}>
            {textoSilencio(ficha)}
            {ficha.responsavelNome && ` · ${ficha.responsavelNome.split(' ')[0]}`}
            {ficha.celulaNome && ` · ${ficha.celulaNome}`}
          </p>
        </div>

        {ficha.telefone && (
          <a
            href={whatsappLink(ficha.telefone, ficha.nome)}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-lg p-1.5 text-green-600 transition-colors hover:bg-green-50"
            aria-label={`Falar com ${ficha.nome} no WhatsApp`}
          >
            <WhatsAppIcon className="h-4 w-4" />
          </a>
        )}
        <button
          type="button"
          onClick={() => { setRegistrando((v) => !v); setAberto(true) }}
          aria-label={`Registrar contato com ${ficha.nome}`}
          className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted"
        >
          <MessageCirclePlus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          aria-label={aberto ? 'Recolher' : 'Ver detalhes'}
          className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted"
        >
          {aberto ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {registrando && (
        <RegistrarContato
          ficha={ficha}
          onPronto={() => { setRegistrando(false); router.refresh() }}
        />
      )}

      {aberto && (
        <div className="mt-3 space-y-3 border-t border-border pt-3 pl-4">
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs">Etapa</Label>
              <select
                value={ficha.etapa}
                disabled={salvando}
                onChange={(e) => atualizar({ etapa: e.target.value as EtapaConsolidacao })}
                className={campoClass}
              >
                {([...ETAPAS_FUNIL, 'afastado'] as EtapaConsolidacao[]).map((e) => (
                  <option key={e} value={e}>{ETAPA_LABELS[e]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Responsável</Label>
              <select
                value={ficha.responsavelId ?? ''}
                disabled={salvando}
                onChange={(e) => atualizar({ responsavelId: e.target.value || null })}
                className={campoClass}
              >
                <option value="">Ninguém ainda</option>
                {responsaveis.map((r) => (
                  <option key={r.id} value={r.id}>{r.nome}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Célula de destino</Label>
              <select
                value={ficha.celulaId ?? ''}
                disabled={salvando}
                onChange={(e) => atualizar({ celulaId: e.target.value || null })}
                className={campoClass}
              >
                <option value="">Sem célula ainda</option>
                {celulas.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            <span className="font-medium">Chegou em </span>
            {format(new Date(`${ficha.dataAcolhimento}T12:00:00`), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
            {' · '}{ORIGEM_LABELS[ficha.origem]}
          </p>

          {ficha.observacao && (
            <p className="text-xs">
              <span className="text-muted-foreground">Observação: </span>
              {ficha.observacao}
            </p>
          )}

          {ficha.contatos.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Contatos ({ficha.contatos.length})
              </p>
              {ficha.contatos.map((c) => (
                <div key={c.id} className="rounded-lg bg-muted/50 px-2.5 py-1.5">
                  <p className="text-xs">
                    <span className="font-medium">{CANAL_LABELS[c.canal]}</span>
                    {' · '}{RESULTADO_LABELS[c.resultado]}
                    <span className="text-muted-foreground">
                      {' · '}{format(new Date(`${c.data}T12:00:00`), 'd/MM', { locale: ptBR })}
                      {c.autorNome && ` · ${c.autorNome.split(' ')[0]}`}
                    </span>
                  </p>
                  {c.nota && <p className="mt-0.5 text-xs text-muted-foreground">{c.nota}</p>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Nenhum contato registrado ainda.</p>
          )}

          {podeExcluir && (
            confirmando ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                <p className="text-xs text-red-800">
                  Apagar a ficha de {ficha.nome}? O histórico de contatos vai junto.
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={excluir}
                    disabled={salvando}
                    className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-60"
                  >
                    {salvando ? 'Apagando…' : 'Apagar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmando(false)}
                    className="rounded-lg px-2.5 py-1 text-xs text-red-800"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmando(true)}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-red-600"
              >
                <Trash2 className="h-3 w-3" /> Apagar ficha
              </button>
            )
          )}
        </div>
      )}
    </div>
  )
}

/**
 * O funil de quem chegou.
 *
 * A primeira aba não é uma etapa — é "Esfriando", quem está sem contato há
 * tempo demais. Ela vem primeiro porque é a única que pede ação hoje; as
 * etapas seguintes são consulta.
 */
export function FunilConsolidacao({ fichas, celulas, responsaveis, podeExcluir }: Props) {
  const esfriando = useMemo(() => fichas.filter((f) => f.esfriando), [fichas])

  const abas = useMemo(() => {
    const porEtapa = (etapa: EtapaConsolidacao) => fichas.filter((f) => f.etapa === etapa)
    return [
      { chave: 'esfriando' as const, rotulo: 'Esfriando', lista: esfriando, urgente: true,
        ajuda: 'Ninguém falou com estas pessoas dentro do prazo.' },
      ...ETAPAS_FUNIL.map((e) => ({
        chave: e, rotulo: ETAPA_LABELS[e], lista: porEtapa(e), urgente: false, ajuda: ETAPA_AJUDA[e],
      })),
      { chave: 'afastado' as const, rotulo: ETAPA_LABELS.afastado, lista: porEtapa('afastado'),
        urgente: false, ajuda: ETAPA_AJUDA.afastado },
    ]
  }, [fichas, esfriando])

  const primeira = abas.find((a) => a.lista.length > 0)?.chave ?? 'esfriando'
  const [ativa, setAtiva] = useState<ChaveAba>(primeira)
  const [pagina, setPagina] = useState(0)

  const aba = abas.find((a) => a.chave === ativa) ?? abas[0]
  const totalPaginas = Math.max(1, Math.ceil(aba.lista.length / POR_PAGINA))
  const paginaAtual = Math.min(pagina, totalPaginas - 1)
  const visiveis = aba.lista.slice(paginaAtual * POR_PAGINA, (paginaAtual + 1) * POR_PAGINA)

  if (fichas.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm font-medium">Nenhuma pessoa em acompanhamento</p>
          <p className="mx-auto mt-1 max-w-xs text-xs text-muted-foreground leading-relaxed">
            Cadastre quem visitou o culto ou a célula e o app passa a avisar
            quando alguém ficar tempo demais sem contato.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="px-0 py-0">
        <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-border px-2 pt-2">
          {abas.map((a) => (
            <button
              key={a.chave}
              type="button"
              role="tab"
              aria-selected={a.chave === ativa}
              onClick={() => { setAtiva(a.chave); setPagina(0) }}
              className={`flex shrink-0 items-center gap-1.5 rounded-t-lg px-3 py-2 text-sm transition-colors ${
                a.chave === ativa
                  ? 'border-b-2 border-primary font-semibold text-foreground'
                  : 'border-b-2 border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {a.rotulo}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  a.lista.length === 0
                    ? 'bg-muted text-muted-foreground'
                    : a.urgente
                      ? 'bg-red-100 text-red-700'
                      : 'bg-primary/10 text-primary'
                }`}
              >
                {a.lista.length}
              </span>
            </button>
          ))}
        </div>

        <div className="px-4 py-3">
          {aba.lista.length === 0 ? (
            <div className="py-6 text-center">
              <CheckCircle2 className="mx-auto mb-2 h-7 w-7 text-green-500/50" />
              <p className="text-sm text-muted-foreground">
                {aba.chave === 'esfriando'
                  ? 'Todo mundo recebeu contato recente.'
                  : 'Ninguém nesta etapa.'}
              </p>
            </div>
          ) : (
            <>
              <p className="mb-1 flex items-start gap-1.5 text-xs text-muted-foreground">
                {aba.urgente && <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />}
                <span>{aba.ajuda}</span>
              </p>

              {visiveis.map((f) => (
                <FichaCard
                  key={f.id}
                  ficha={f}
                  celulas={celulas}
                  responsaveis={responsaveis}
                  podeExcluir={podeExcluir}
                />
              ))}

              {totalPaginas > 1 && (
                <div className="flex items-center justify-between pt-3">
                  <p className="text-xs text-muted-foreground">
                    {paginaAtual * POR_PAGINA + 1}–
                    {Math.min((paginaAtual + 1) * POR_PAGINA, aba.lista.length)} de {aba.lista.length}
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setPagina(paginaAtual - 1)}
                      disabled={paginaAtual === 0}
                      aria-label="Página anterior"
                      className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {paginaAtual + 1}/{totalPaginas}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPagina(paginaAtual + 1)}
                      disabled={paginaAtual >= totalPaginas - 1}
                      aria-label="Próxima página"
                      className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
