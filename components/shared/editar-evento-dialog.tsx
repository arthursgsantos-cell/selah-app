'use client'

import { useState, useTransition, useRef } from 'react'
import { updateEventoAction, uploadCapaEventoAction } from '@/app/actions/evento'
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
import { Pencil, ImagePlus, X, CalendarDays, RefreshCw } from 'lucide-react'
import type { TipoEvento } from '@/lib/supabase/types'

type EscopoEdicao = 'este' | 'este_e_seguintes' | 'todos'

interface EventoEdicao {
  id: string
  titulo: string
  descricao: string | null
  data_hora: string
  local: string | null
  tipo: TipoEvento
  imagem_url: string | null
  recorrencia_id: string | null
  recorrencia_tipo: string | null
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
  const [local, setLocal] = useState(evento.local ?? '')
  const [descricao, setDescricao] = useState(evento.descricao ?? '')
  const [tipo, setTipo] = useState<TipoEvento>(evento.tipo)
  const [imagemFile, setImagemFile] = useState<File | null>(null)
  const [imagemPreview, setImagemPreview] = useState<string | null>(evento.imagem_url)
  const [imagemRemovida, setImagemRemovida] = useState(false)

  const [isPending, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const isRecorrente = !!evento.recorrencia_id

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImagemFile(file)
    setImagemPreview(URL.createObjectURL(file))
    setImagemRemovida(false)
  }

  function removerImagem() {
    setImagemFile(null)
    setImagemPreview(null)
    setImagemRemovida(true)
    if (fileRef.current) fileRef.current.value = ''
  }

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!titulo.trim() || !dataHora) return
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
        let imagem_url: string | null | undefined
        if (imagemFile) {
          const fd = new FormData()
          fd.append('file', imagemFile)
          imagem_url = await uploadCapaEventoAction(fd)
        } else if (imagemRemovida) {
          imagem_url = null
        } else {
          imagem_url = evento.imagem_url
        }

        await updateEventoAction(
          evento.id,
          evento.data_hora,
          evento.recorrencia_id,
          escopo,
          {
            titulo: titulo.trim(),
            data_hora: new Date(dataHora).toISOString(),
            local: local.trim() || undefined,
            descricao: descricao.trim() || undefined,
            tipo,
            imagem_url,
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
      setTitulo(evento.titulo)
      setDataHora(toLocalDatetime(evento.data_hora))
      setLocal(evento.local ?? '')
      setDescricao(evento.descricao ?? '')
      setTipo(evento.tipo)
      setImagemFile(null)
      setImagemPreview(evento.imagem_url)
      setImagemRemovida(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" />}>
        <Pencil className="h-3.5 w-3.5" />
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

              <div className="space-y-1.5">
                <Label>Capa do evento</Label>
                <label
                  htmlFor="imagem-editar"
                  className="relative flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-input rounded-lg cursor-pointer overflow-hidden hover:bg-accent/30 transition-colors"
                >
                  {imagemPreview ? (
                    <>
                      <img
                        src={imagemPreview}
                        alt="Preview"
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); removerImagem() }}
                        className="absolute top-1.5 right-1.5 bg-black/60 rounded-full p-0.5 text-white hover:bg-black/80"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-muted-foreground pointer-events-none">
                      <ImagePlus className="h-6 w-6" />
                      <span className="text-xs">Clique para importar capa</span>
                      <span className="text-[10px] opacity-60">JPG, PNG, WebP · max 5 MB</span>
                    </div>
                  )}
                  <input
                    ref={fileRef}
                    id="imagem-editar"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={handleImageChange}
                  />
                </label>
              </div>

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

              {erro && <p className="text-sm text-destructive">{erro}</p>}

              <DialogFooter>
                <Button type="submit" disabled={!titulo.trim() || !dataHora || isPending}>
                  {isRecorrente ? 'Continuar' : isPending ? 'Salvando...' : 'Salvar'}
                </Button>
              </DialogFooter>
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
