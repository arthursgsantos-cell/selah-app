'use client'

import { useState, useTransition, useEffect } from 'react'
import {
  createEventoAction,
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
import { CalendarPlus } from 'lucide-react'
import type { TipoEvento, RecorrenciaTipo } from '@/lib/supabase/types'
import { InscricaoFields, type InscricaoValue } from '@/components/eventos/inscricao-fields'
import {
  ImagensEventoFields,
  resolverImagem,
  slotImagem,
  type SlotImagem,
} from '@/components/eventos/imagens-evento-fields'
import { DestinoEventoFields } from '@/components/eventos/destino-evento-fields'

interface Props {
  tipoFixo?: TipoEvento
  redeId?: string | null
  label?: string
}

const tipoOptions: { value: TipoEvento; label: string }[] = [
  { value: 'culto', label: 'Culto' },
  { value: 'igreja', label: 'Evento da Igreja' },
  { value: 'rede', label: 'Evento de Rede' },
  { value: 'celula', label: 'Evento de Célula' },
  { value: 'outro', label: 'Outro' },
]

const selectClass =
  'w-full h-8 rounded-lg border border-input bg-background px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50'


export function CriarEventoDialog({ tipoFixo, redeId, label = 'Criar evento' }: Props) {
  const [open, setOpen] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [datePart, setDatePart] = useState('')
  const [horaPart, setHoraPart] = useState('09')
  const [minutoPart, setMinutoPart] = useState('00')
  const [comTermino, setComTermino] = useState(false)
  const [dateFimPart, setDateFimPart] = useState('')
  const [horaFimPart, setHoraFimPart] = useState('10')
  const [minutoFimPart, setMinutoFimPart] = useState('00')
  const [local, setLocal] = useState('')
  const [descricao, setDescricao] = useState('')
  const [tipo, setTipo] = useState<TipoEvento>(tipoFixo ?? 'culto')
  const [recorrencia, setRecorrencia] = useState<'nao' | RecorrenciaTipo>('nao')
  const [redeSelecionada, setRedeSelecionada] = useState('')
  const [celulaSelecionada, setCelulaSelecionada] = useState('')
  const [tipoOutro, setTipoOutro] = useState('')
  const [card, setCard] = useState<SlotImagem>(slotImagem())
  const [capa, setCapa] = useState<SlotImagem>(slotImagem())
  const [inscricao, setInscricao] = useState<InscricaoValue>({ tipo: 'aberto' })
  const [isPending, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [destinos, setDestinos] = useState<{
    redes: DestinoEvento[]
    celulas: CelulaDestino[]
  } | null>(null)

  // Evento de rede criado a partir da página da rede já sabe de quem é.
  const precisaRede = tipo === 'rede' && !redeId
  const precisaCelula = tipo === 'celula'

  // Só busca a lista quando o tipo escolhido pede um dono — abrir o formulário
  // para um culto não deve custar uma consulta.
  useEffect(() => {
    if (!open || destinos || (!precisaRede && !precisaCelula)) return
    let vivo = true
    listarDestinosEventoAction()
      .then((d) => { if (vivo) setDestinos(d) })
      .catch(() => { if (vivo) setErro('Não consegui carregar as redes e células.') })
    return () => { vivo = false }
  }, [open, destinos, precisaRede, precisaCelula])

  const dataHora = datePart ? `${datePart}T${horaPart}:${minutoPart}` : ''
  const dataHoraFim = comTermino && dateFimPart ? `${dateFimPart}T${horaFimPart}:${minutoFimPart}` : ''
  const terminoInvalido = comTermino && dataHoraFim !== '' && dataHora !== '' && new Date(dataHoraFim) <= new Date(dataHora)

  function resetForm() {
    setTitulo('')
    setDatePart('')
    setHoraPart('09')
    setMinutoPart('00')
    setComTermino(false)
    setDateFimPart('')
    setHoraFimPart('10')
    setMinutoFimPart('00')
    setLocal('')
    setDescricao('')
    setTipo(tipoFixo ?? 'culto')
    setRecorrencia('nao')
    setRedeSelecionada('')
    setCelulaSelecionada('')
    setTipoOutro('')
    setInscricao({ tipo: 'aberto' })
    setCard(slotImagem())
    setCapa(slotImagem())
    setErro(null)
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!titulo.trim() || !dataHora) return
    if (terminoInvalido) { setErro('O término precisa ser depois do início.'); return }
    if (precisaRede && !redeSelecionada) { setErro('Escolha a rede do evento.'); return }
    if (precisaCelula && !celulaSelecionada) { setErro('Escolha a célula do evento.'); return }
    if (tipo === 'outro' && !tipoOutro.trim()) { setErro('Diga que tipo de evento é.'); return }
    setErro(null)
    startTransition(async () => {
      try {
        const [imagem_url, capa_pagina_url] = await Promise.all([
          resolverImagem(card, null, uploadCapaEventoAction),
          resolverImagem(capa, null, uploadCapaEventoAction),
        ])

        // Evento de célula também guarda a rede dela: é por `rede_id` que as
        // telas de supervisão e da rede encontram o evento.
        const celula = destinos?.celulas.find((c) => c.id === celulaSelecionada)
        const rede_id = precisaCelula
          ? celula?.rede_id ?? null
          : tipo === 'rede'
            ? redeId ?? (redeSelecionada || null)
            : redeId ?? null

        await createEventoAction({
          titulo: titulo.trim(),
          data_hora: new Date(dataHora).toISOString(),
          data_hora_fim: dataHoraFim ? new Date(dataHoraFim).toISOString() : null,
          local: local.trim() || undefined,
          descricao: descricao.trim() || undefined,
          tipo,
          tipo_outro: tipo === 'outro' ? tipoOutro.trim() : null,
          rede_id,
          celula_id: precisaCelula ? celulaSelecionada : null,
          imagem_url,
          capa_pagina_url,
          recorrencia: recorrencia === 'nao' ? undefined : recorrencia,
          tipo_inscricao: inscricao.tipo,
          whatsapp_inscricao: inscricao.whatsapp ?? null,
          pix_chave: inscricao.pixChave ?? null,
          pix_tipo: inscricao.pixTipo ?? null,
          pix_nome: inscricao.pixNome ?? null,
          pix_valor: inscricao.pixValor ? parseFloat(inscricao.pixValor) : null,
          formulario_id: inscricao.formularioId ?? null,
          link_inscricao_url: inscricao.linkUrl ?? null,
        })
        setOpen(false)
        resetForm()
      } catch (err) {
        setErro(err instanceof Error ? err.message : 'Erro ao criar evento')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm() }}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <CalendarPlus className="h-4 w-4" />
        {label}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo evento</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="titulo">Título</Label>
            <Input
              id="titulo"
              placeholder="Ex: Culto de domingo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label>Data e horário</Label>
            <div className="flex gap-2">
              <input
                type="date"
                value={datePart}
                onChange={(e) => setDatePart(e.target.value)}
                required
                className={selectClass + ' flex-1'}
              />
              <select
                value={horaPart}
                onChange={(e) => setHoraPart(e.target.value)}
                className={selectClass + ' w-20'}
              >
                {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map((h) => (
                  <option key={h} value={h}>{h}h</option>
                ))}
              </select>
              <select
                value={minutoPart}
                onChange={(e) => setMinutoPart(e.target.value)}
                className={selectClass + ' w-20'}
              >
                {['00','05','10','15','20','25','30','35','40','45','50','55'].map((m) => (
                  <option key={m} value={m}>{m}min</option>
                ))}
              </select>
            </div>
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
              <div className="flex gap-2 pt-1">
                <input
                  type="date"
                  value={dateFimPart}
                  onChange={(e) => setDateFimPart(e.target.value)}
                  min={datePart || undefined}
                  className={selectClass + ' flex-1'}
                />
                <select
                  value={horaFimPart}
                  onChange={(e) => setHoraFimPart(e.target.value)}
                  className={selectClass + ' w-20'}
                >
                  {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map((h) => (
                    <option key={h} value={h}>{h}h</option>
                  ))}
                </select>
                <select
                  value={minutoFimPart}
                  onChange={(e) => setMinutoFimPart(e.target.value)}
                  className={selectClass + ' w-20'}
                >
                  {['00','05','10','15','20','25','30','35','40','45','50','55'].map((m) => (
                    <option key={m} value={m}>{m}min</option>
                  ))}
                </select>
              </div>
            )}
            {terminoInvalido && (
              <p className="text-xs text-destructive">O término precisa ser depois do início.</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="local">Local</Label>
            <Input
              id="local"
              placeholder="Ex: Templo Central"
              value={local}
              onChange={(e) => setLocal(e.target.value)}
            />
          </div>

          {!tipoFixo && (
            <div className="space-y-1.5">
              <Label htmlFor="tipo">Tipo</Label>
              <select
                id="tipo"
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
          )}

          <DestinoEventoFields
            idPrefixo="criar"
            tipo={tipo}
            redeFixa={!!redeId}
            destinos={destinos}
            redeId={redeSelecionada}
            celulaId={celulaSelecionada}
            tipoOutro={tipoOutro}
            onRede={setRedeSelecionada}
            onCelula={setCelulaSelecionada}
            onTipoOutro={setTipoOutro}
          />

          <div className="space-y-1.5">
            <Label htmlFor="recorrencia">Repetição</Label>
            <select
              id="recorrencia"
              value={recorrencia}
              onChange={(e) => setRecorrencia(e.target.value as typeof recorrencia)}
              className={selectClass}
            >
              <option value="nao">Não repete</option>
              <option value="semanal">Semanal</option>
              <option value="quinzenal">Quinzenal</option>
              <option value="mensal">Mensal</option>
            </select>
          </div>

          <ImagensEventoFields
            idPrefixo="criar"
            card={card}
            capa={capa}
            onCardChange={setCard}
            onCapaChange={setCapa}
          />

          <div className="space-y-1.5">
            <Label htmlFor="desc">Descrição (opcional)</Label>
            <Textarea
              id="desc"
              placeholder="Detalhes do evento..."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={2}
            />
          </div>

          <InscricaoFields value={inscricao} onChange={setInscricao} />

          {erro && <p className="text-sm text-destructive">{erro}</p>}

          <DialogFooter>
            <Button type="submit" disabled={!titulo.trim() || !dataHora || isPending}>
              {isPending ? 'Criando...' : 'Criar evento'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
