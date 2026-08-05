'use client'

import { useState, useTransition, useRef } from 'react'
import { createEncontroAction } from '@/app/actions/encontro'
import { uploadCapaEventoAction } from '@/app/actions/evento'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import { CalendarPlus, ImagePlus, X } from 'lucide-react'
import { BotaoFlutuante } from '@/components/shared/botao-flutuante'
import {
  dateParaDataBr,
  nomeDoDiaDaData,
  normalizarHorario,
  proximaData,
} from '@/lib/dia-semana'

interface MembroAnfitriao {
  user_id: string
  nome: string
  endereco: string | null
  endereco_maps: string | null
}

interface Props {
  celulaId: string
  localPadrao?: string | null
  membros?: MembroAnfitriao[]
  /** Dia da semana padrão da célula (0 = domingo), usado para sugerir a data. */
  diaSemana?: number | null
  /** Horário padrão da célula, ex: "19:30". */
  horarioPadrao?: string | null
  /**
   * Botão fixo no canto da tela, como bolinha que se abre ao passar o mouse.
   * Libera o espaço ao lado das abas e mantém a ação sempre ao alcance.
   */
  flutuante?: boolean
}

const selectCls =
  'w-full h-8 rounded-lg border border-input bg-background px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50'

export function CriarEncontroDialog({
  celulaId,
  localPadrao,
  membros = [],
  diaSemana,
  horarioPadrao,
  flutuante = false,
}: Props) {
  // Sugestão inicial: próxima ocorrência do dia da semana configurado na célula
  const horarioSugerido = normalizarHorario(horarioPadrao)
  const sugestao =
    diaSemana === null || diaSemana === undefined
      ? { data: '', hora: horarioSugerido }
      : { data: dateParaDataBr(proximaData(diaSemana, horarioSugerido)), hora: horarioSugerido }

  const [open, setOpen] = useState(false)
  const [dataDigitada, setDataDigitada] = useState(sugestao.data)
  const [horaDigitada, setHoraDigitada] = useState(sugestao.hora)
  const [local, setLocal] = useState(localPadrao ?? '')
  const [localMapsUrl, setLocalMapsUrl] = useState<string | null>(null)
  const [anfitriaoId, setAnfitriaoId] = useState('')
  const [imagemFile, setImagemFile] = useState<File | null>(null)
  const [imagemPreview, setImagemPreview] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const diaDaData = nomeDoDiaDaData(dataDigitada)

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

  function maskData(v: string) {
    const n = v.replace(/\D/g, '').slice(0, 8)
    if (n.length <= 2) return n
    if (n.length <= 4) return `${n.slice(0, 2)}/${n.slice(2)}`
    return `${n.slice(0, 2)}/${n.slice(2, 4)}/${n.slice(4)}`
  }

  function maskHora(v: string) {
    const n = v.replace(/\D/g, '').slice(0, 4)
    if (n.length <= 2) return n
    return `${n.slice(0, 2)}:${n.slice(2)}`
  }

  function partesToIso() {
    const [dd, mm, yyyy] = dataDigitada.split('/')
    return `${yyyy}-${mm?.padStart(2, '0')}-${dd?.padStart(2, '0')}T${horaDigitada || '00:00'}`
  }

  function resetForm() {
    setDataDigitada(sugestao.data)
    setHoraDigitada(sugestao.hora)
    setLocal(localPadrao ?? '')
    setLocalMapsUrl(null)
    setAnfitriaoId('')
    removerImagem()
    setErro(null)
  }

  function handleAnfitriaoChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value
    setAnfitriaoId(id)
    if (id) {
      const membro = membros.find((m) => m.user_id === id)
      if (membro?.endereco) setLocal(membro.endereco)
      setLocalMapsUrl(membro?.endereco_maps ?? null)
    } else {
      setLocalMapsUrl(null)
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!dataDigitada || dataDigitada.length < 10) return
    setErro(null)
    startTransition(async () => {
      try {
        let cardImagemUrl: string | null = null
        if (imagemFile) {
          const fd = new FormData()
          fd.append('file', imagemFile)
          cardImagemUrl = await uploadCapaEventoAction(fd)
        }
        await createEncontroAction(
          celulaId,
          new Date(partesToIso()).toISOString(),
          local || undefined,
          cardImagemUrl,
          undefined,
          localMapsUrl,
        )
        // Chegou aqui = recorrência (sem redirect), fecha o dialog
        setOpen(false)
        resetForm()
      } catch (err) {
        setErro(err instanceof Error ? err.message : 'Erro ao criar encontro')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm() }}>
      {flutuante ? (
        <BotaoFlutuante id="agendar-encontro">
          {/* `group` + largura animada: fechado é só a bolinha do ícone; no
             hover (ou com foco pelo teclado) o texto surge ao lado. O rótulo
             existe sempre no DOM para o leitor de tela — o que muda é a
             largura. */}
          <DialogTrigger
            render={<button type="button" />}
            className="group flex h-14 items-center gap-2 overflow-hidden rounded-full bg-primary px-4 text-primary-foreground shadow-lg transition-all duration-300 hover:pr-5 focus-visible:pr-5 active:scale-95"
          >
            <CalendarPlus className="h-5 w-5 shrink-0" />
            <span className="max-w-0 whitespace-nowrap text-sm font-semibold opacity-0 transition-all duration-300 group-hover:max-w-[10rem] group-hover:opacity-100 group-focus-visible:max-w-[10rem] group-focus-visible:opacity-100">
              Agendar encontro
            </span>
          </DialogTrigger>
        </BotaoFlutuante>
      ) : (
        <DialogTrigger render={<Button size="sm" />}>
          <CalendarPlus className="h-4 w-4" />
          Agendar encontro
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo encontro</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="enc-data">Data e horário</Label>
            <div className="flex gap-2">
              {/* min-w-0 é essencial: sem ele o w-full do campo de hora
                  espreme o campo de data até sumir. */}
              <input
                id="enc-data"
                type="text"
                inputMode="numeric"
                placeholder="DD/MM/AAAA"
                value={dataDigitada}
                onChange={(e) => setDataDigitada(maskData(e.target.value))}
                required
                className={selectCls + ' flex-1 min-w-0'}
              />
              <input
                type="text"
                inputMode="numeric"
                placeholder="HH:MM"
                value={horaDigitada}
                onChange={(e) => setHoraDigitada(maskHora(e.target.value))}
                className={selectCls + ' w-24 shrink-0'}
              />
            </div>
            {diaDaData && (
              <p className="text-xs text-muted-foreground capitalize">{diaDaData}</p>
            )}
            {dataDigitada.length === 10 && !diaDaData && (
              <p className="text-xs text-destructive">Data inválida.</p>
            )}
          </div>

          {membros.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="enc-anfitriao">Anfitrião</Label>
              <select
                id="enc-anfitriao"
                value={anfitriaoId}
                onChange={handleAnfitriaoChange}
                className={selectCls}
              >
                <option value="">Selecionar anfitrião...</option>
                {membros.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.nome}{m.endereco ? ` · ${m.endereco}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="enc-local">Local</Label>
            <Input
              id="enc-local"
              placeholder="Ex: Casa do Pedro"
              value={local}
              onChange={(e) => setLocal(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Card da célula (opcional)</Label>
            <label
              htmlFor="enc-imagem"
              className="relative flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-input rounded-lg cursor-pointer overflow-hidden hover:bg-accent/30 transition-colors"
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
                  <span className="text-xs">Clique para adicionar imagem</span>
                  <span className="text-[10px] opacity-60">JPG, PNG, WebP · max 5 MB</span>
                </div>
              )}
              <input
                ref={fileRef}
                id="enc-imagem"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleImageChange}
              />
            </label>
          </div>

          {erro && <p className="text-sm text-destructive">{erro}</p>}

          <DialogFooter>
            <Button type="submit" disabled={dataDigitada.length < 10 || isPending}>
              {isPending ? 'Criando...' : 'Criar encontro'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
