'use client'

import { useState, useTransition, useRef } from 'react'
import { createEventoAction, uploadCapaEventoAction } from '@/app/actions/evento'
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
import { CalendarPlus, ImagePlus, X } from 'lucide-react'
import type { TipoEvento, RecorrenciaTipo } from '@/lib/supabase/types'

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
  const [local, setLocal] = useState('')
  const [descricao, setDescricao] = useState('')
  const [tipo, setTipo] = useState<TipoEvento>(tipoFixo ?? 'culto')
  const [recorrencia, setRecorrencia] = useState<'nao' | RecorrenciaTipo>('nao')
  const [imagemFile, setImagemFile] = useState<File | null>(null)
  const [imagemPreview, setImagemPreview] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImagemFile(file)
    setImagemPreview(URL.createObjectURL(file))
  }

  function removerImagem() {
    setImagemFile(null)
    setImagemPreview(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const dataHora = datePart ? `${datePart}T${horaPart}:${minutoPart}` : ''

  function resetForm() {
    setTitulo('')
    setDatePart('')
    setHoraPart('09')
    setMinutoPart('00')
    setLocal('')
    setDescricao('')
    setTipo(tipoFixo ?? 'culto')
    setRecorrencia('nao')
    removerImagem()
    setErro(null)
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!titulo.trim() || !dataHora) return
    setErro(null)
    startTransition(async () => {
      try {
        let imagem_url: string | null = null
        if (imagemFile) {
          const fd = new FormData()
          fd.append('file', imagemFile)
          imagem_url = await uploadCapaEventoAction(fd)
        }

        await createEventoAction({
          titulo: titulo.trim(),
          data_hora: new Date(dataHora).toISOString(),
          local: local.trim() || undefined,
          descricao: descricao.trim() || undefined,
          tipo,
          rede_id: redeId ?? null,
          imagem_url,
          recorrencia: recorrencia === 'nao' ? undefined : recorrencia,
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

          <div className="space-y-1.5">
            <Label>Capa do evento (opcional)</Label>
            <label
              htmlFor="imagem-criar"
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
                id="imagem-criar"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleImageChange}
              />
            </label>
          </div>

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
