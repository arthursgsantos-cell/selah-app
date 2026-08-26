'use client'

import { useState, useTransition, useEffect } from 'react'
import {
  updateEventoAction,
  uploadCapaEventoAction,
  listarDestinosEventoAction,
  type DestinoEvento,
  type CelulaDestino,
} from '@/app/actions/evento'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import { Pencil, CalendarDays, RefreshCw, Ticket } from 'lucide-react'
import { InscricaoFields, type InscricaoValue } from '@/components/eventos/inscricao-fields'
import {
  ImagensEventoFields,
  resolverImagem,
  slotImagem,
  type SlotImagem,
} from '@/components/eventos/imagens-evento-fields'
import { DestinoEventoFields } from '@/components/eventos/destino-evento-fields'
import { ExcluirEventoPainel } from '@/components/shared/excluir-evento-painel'
import type { TipoEvento, TipoInscricao, TipoChavePix } from '@/lib/supabase/types'

type EscopoEdicao = 'este' | 'este_e_seguintes' | 'todos'

interface EventoEdicao {
  id: string
  titulo: string
  descricao: string | null
  data_hora: string
  data_hora_fim?: string | null
  local: string | null
  tipo: TipoEvento
  tipo_outro?: string | null
  rede_id?: string | null
  celula_id?: string | null
  imagem_url: string | null
  capa_pagina_url?: string | null
  recorrencia_id: string | null
  recorrencia_tipo: string | null
  tipo_inscricao?: TipoInscricao | null
  whatsapp_inscricao?: string | null
  pix_chave?: string | null
  pix_tipo?: TipoChavePix | null
  pix_nome?: string | null
  pix_valor?: number | null
  formulario_id?: string | null
  link_inscricao_url?: string | null
}

interface Props {
  evento: EventoEdicao
}

const tipoOptions: { value: TipoEvento; label: string }[] = [
  { value: 'culto', label: 'Culto' },
  { value: 'igreja', label: 'Evento da Igreja' },
  { value: 'rede', label: 'Evento de Rede' },
  { value: 'celula', label: 'Evento de Célula' },
  { value: 'outro', label: 'Outro' },
]

const escopoOptions: { value: EscopoEdicao; label: string; desc: string }[] = [
  { value: 'este', label: 'Apenas este evento', desc: 'Altera somente esta ocorrência' },
  {
    value: 'este_e_seguintes',
    label: 'Este e os seguintes',
    desc: 'Altera este e todos os próximos da série',
  },
  { value: 'todos', label: 'Todos os eventos', desc: 'Altera todos na série' },
]

const selectClass =
  'w-full h-8 rounded-lg border border-input bg-background px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50'

function toLocalDatetime(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}


export function EditarEventoDialog({ evento }: Props) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<'form' | 'scope'>('form')

  const [titulo, setTitulo] = useState(evento.titulo)
  const [dataHora, setDataHora] = useState(toLocalDatetime(evento.data_hora))
  const [comTermino, setComTermino] = useState(!!evento.data_hora_fim)
  const [dataHoraFim, setDataHoraFim] = useState(evento.data_hora_fim ? toLocalDatetime(evento.data_hora_fim) : '')
  const [local, setLocal] = useState(evento.local ?? '')
  const [descricao, setDescricao] = useState(evento.descricao ?? '')
  const [tipo, setTipo] = useState<TipoEvento>(evento.tipo)
  const [tipoOutro, setTipoOutro] = useState(evento.tipo_outro ?? '')
  const [redeSelecionada, setRedeSelecionada] = useState(evento.rede_id ?? '')
  const [celulaSelecionada, setCelulaSelecionada] = useState(evento.celula_id ?? '')
  const [card, setCard] = useState<SlotImagem>(slotImagem(evento.imagem_url))
  const [capa, setCapa] = useState<SlotImagem>(slotImagem(evento.capa_pagina_url ?? null))
  const [destinos, setDestinos] = useState<{
    redes: DestinoEvento[]
    celulas: CelulaDestino[]
  } | null>(null)
  const [inscricao, setInscricao] = useState<InscricaoValue>({
    tipo: (evento.tipo_inscricao ?? 'aberto') as TipoInscricao,
    whatsapp: evento.whatsapp_inscricao ?? undefined,
    pixChave: evento.pix_chave ?? undefined,
    pixTipo: evento.pix_tipo ?? undefined,
    pixNome: evento.pix_nome ?? undefined,
    pixValor: evento.pix_valor != null ? String(evento.pix_valor) : undefined,
    formularioId: evento.formulario_id ?? undefined,
    linkUrl: evento.link_inscricao_url ?? undefined,
  })
  const [focarInscricao, setFocarInscricao] = useState(false)

  const [isPending, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)

  const isRecorrente = !!evento.recorrencia_id
  const precisaRede = tipo === 'rede'
  const precisaCelula = tipo === 'celula'

  // Só busca redes e células quando o tipo escolhido pede um dono.
  useEffect(() => {
    if (!open || destinos || (!precisaRede && !precisaCelula)) return
    let vivo = true
    listarDestinosEventoAction()
      .then((d) => { if (vivo) setDestinos(d) })
      .catch(() => { if (vivo) setErro('Não consegui carregar as redes e células.') })
    return () => { vivo = false }
  }, [open, destinos, precisaRede, precisaCelula])

  const terminoInvalido = comTermino && dataHoraFim !== '' && dataHora !== '' && new Date(dataHoraFim) <= new Date(dataHora)

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!titulo.trim() || !dataHora) return
    if (terminoInvalido) { setErro('O término precisa ser depois do início.'); return }
    if (precisaRede && !redeSelecionada) { setErro('Escolha a rede do evento.'); return }
    if (precisaCelula && !celulaSelecionada) { setErro('Escolha a célula do evento.'); return }
    if (tipo === 'outro' && !tipoOutro.trim()) { setErro('Diga que tipo de evento é.'); return }
    setErro(null)
    if (isRecorrente) {
      setStep('scope')
    } else {
      salvar('este')
    }
  }

  function salvar(escopo: EscopoEdicao) {
    startTransition(async () => {
      try {
        const [imagem_url, capa_pagina_url] = await Promise.all([
          resolverImagem(card, evento.imagem_url, uploadCapaEventoAction),
          resolverImagem(capa, evento.capa_pagina_url ?? null, uploadCapaEventoAction),
        ])

        // Evento de célula guarda também a rede dela; trocar o tipo para algo
        // sem dono limpa o vínculo antigo em vez de deixá-lo pendurado.
        const celula = destinos?.celulas.find((c) => c.id === celulaSelecionada)
        const rede_id = precisaCelula
          // Lista ainda carregando: mantém a rede que já estava gravada.
          ? celula?.rede_id ?? evento.rede_id ?? null
          : precisaRede
            ? redeSelecionada || null
            : null
        const celula_id = precisaCelula ? celulaSelecionada || null : null

        await updateEventoAction(
          evento.id,
          evento.data_hora,
          evento.recorrencia_id,
          escopo,
          {
            titulo: titulo.trim(),
            data_hora: new Date(dataHora).toISOString(),
            data_hora_fim: comTermino && dataHoraFim ? new Date(dataHoraFim).toISOString() : null,
            local: local.trim() || undefined,
            descricao: descricao.trim() || undefined,
            tipo,
            tipo_outro: tipo === 'outro' ? tipoOutro.trim() : null,
            rede_id,
            celula_id,
            imagem_url,
            capa_pagina_url,
            inscricao: {
              tipo_inscricao: inscricao.tipo,
              whatsapp_inscricao: inscricao.whatsapp || null,
              pix_chave: inscricao.pixChave || null,
              pix_tipo: inscricao.pixTipo ?? null,
              pix_nome: inscricao.pixNome || null,
              pix_valor: inscricao.pixValor ? Number(inscricao.pixValor) : null,
              formulario_id: inscricao.formularioId || null,
              link_inscricao_url: inscricao.linkUrl || null,
            },
          }
        )
        setOpen(false)
      } catch (err) {
        setErro(err instanceof Error ? err.message : 'Erro ao salvar evento')
        setStep('form')
      }
    })
  }

  function handleOpenChange(v: boolean) {
    setOpen(v)
    if (!v) {
      setStep('form')
      setErro(null)
      setFocarInscricao(false)
      setTitulo(evento.titulo)
      setDataHora(toLocalDatetime(evento.data_hora))
      setComTermino(!!evento.data_hora_fim)
      setDataHoraFim(evento.data_hora_fim ? toLocalDatetime(evento.data_hora_fim) : '')
      setLocal(evento.local ?? '')
      setDescricao(evento.descricao ?? '')
      setTipo(evento.tipo)
      setTipoOutro(evento.tipo_outro ?? '')
      setRedeSelecionada(evento.rede_id ?? '')
      setCelulaSelecionada(evento.celula_id ?? '')
      setCard(slotImagem(evento.imagem_url))
      setCapa(slotImagem(evento.capa_pagina_url ?? null))
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" title="Editar evento" />}>
        <Pencil className="h-3.5 w-3.5" />
      </DialogTrigger>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            title="Editar inscrição"
            onClick={() => setFocarInscricao(true)}
          />
        }
      >
        <Ticket className="h-3.5 w-3.5" />
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        {step === 'form' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                Editar evento
                {isRecorrente && (
                  <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
                    <RefreshCw className="h-3 w-3" />
                    Recorrente
                  </span>
                )}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="edit-titulo">Título</Label>
                <Input
                  id="edit-titulo"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-data">Data e horário</Label>
                <input
                  id="edit-data"
                  type="datetime-local"
                  value={dataHora}
                  onChange={(e) => setDataHora(e.target.value)}
                  required
                  className={selectClass}
                />
                {isRecorrente && (
                  <p className="text-[11px] text-muted-foreground">
                    Alteração de data/hora aplica-se apenas a este evento.
                  </p>
                )}
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer pt-0.5">
                  <input
                    type="checkbox"
                    checked={comTermino}
                    onChange={(e) => setComTermino(e.target.checked)}
                    className="rounded"
                  />
                  Definir horário de término
                </label>
                {comTermino && (
                  <input
                    type="datetime-local"
                    value={dataHoraFim}
                    onChange={(e) => setDataHoraFim(e.target.value)}
                    min={dataHora || undefined}
                    className={selectClass + ' mt-1'}
                  />
                )}
                {terminoInvalido && (
                  <p className="text-xs text-destructive">O término precisa ser depois do início.</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-local">Local</Label>
                <Input
                  id="edit-local"
                  placeholder="Ex: Templo Central"
                  value={local}
                  onChange={(e) => setLocal(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-tipo">Tipo</Label>
                <select
                  id="edit-tipo"
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value as TipoEvento)}
                  className={selectClass}
                >
                  {tipoOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <DestinoEventoFields
                idPrefixo="editar"
                tipo={tipo}
                destinos={destinos}
                redeId={redeSelecionada}
                celulaId={celulaSelecionada}
                tipoOutro={tipoOutro}
                onRede={setRedeSelecionada}
                onCelula={setCelulaSelecionada}
                onTipoOutro={setTipoOutro}
              />

              <ImagensEventoFields
                idPrefixo="editar"
                card={card}
                capa={capa}
                onCardChange={setCard}
                onCapaChange={setCapa}
              />

              <div className="space-y-1.5">
                <Label htmlFor="edit-desc">Descrição (opcional)</Label>
                <Textarea
                  id="edit-desc"
                  placeholder="Detalhes do evento..."
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  rows={2}
                />
              </div>

              {/* Inscrições: permite trocar o formulário e o PIX depois de criado */}
              <InscricaoFields value={inscricao} onChange={setInscricao} abrirExpandido={focarInscricao} />

              {erro && <p className="text-sm text-destructive">{erro}</p>}

              <DialogFooter>
                <Button type="submit" disabled={!titulo.trim() || !dataHora || isPending}>
                  {isRecorrente ? 'Continuar' : isPending ? 'Salvando...' : 'Salvar'}
                </Button>
              </DialogFooter>

              {/* Fora do rodapé de propósito: um botão de excluir ao lado do
                  "Salvar" convida ao clique errado. Fica no fim, separado, e
                  ainda pede confirmação. */}
              <ExcluirEventoPainel
                eventoId={evento.id}
                titulo={evento.titulo}
                dataHora={evento.data_hora}
                recorrenciaId={evento.recorrencia_id ?? null}
                onExcluido={() => setOpen(false)}
              />
            </form>
          </>
        )}

        {step === 'scope' && (
          <>
            <DialogHeader>
              <DialogTitle>Editar evento recorrente</DialogTitle>
            </DialogHeader>

            <p className="text-sm text-muted-foreground">
              Este evento faz parte de uma série recorrente. Como você deseja aplicar as
              alterações?
            </p>

            <div className="space-y-2 py-1">
              {escopoOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  disabled={isPending}
                  onClick={() => salvar(opt.value)}
                  className="w-full text-left px-4 py-3 rounded-xl border border-input hover:border-primary hover:bg-primary/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <p className="text-sm font-medium">{opt.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>

            {erro && <p className="text-sm text-destructive">{erro}</p>}

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                disabled={isPending}
                onClick={() => setStep('form')}
              >
                Voltar
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
