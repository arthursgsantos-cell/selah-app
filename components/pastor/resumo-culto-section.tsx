'use client'

import { useState, useTransition, useRef } from 'react'
import {
  analisarResumoPdfAction,
  createResumoCultoAction,
  extenderValidadeAction,
  updateResumoCultoAction,
} from '@/app/actions/resumo-culto'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  BookOpen,
  CalendarDays,
  FileText,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Upload,
  User,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { BotaoPdf } from '@/components/shared/pdf-dialog'

interface Resumo {
  id: string
  titulo: string
  conteudo: string
  pdf_url: string | null
  data_culto: string
  validade_ate: string
  /** Nome de quem publicou — da planilha ou do perfil de quem usou o app. */
  autor?: string | null
}

interface Props {
  resumos: Resumo[]
}

function isAtivo(resumo: Resumo): boolean {
  const hoje = new Date().toISOString().split('T')[0]
  return resumo.data_culto <= hoje && resumo.validade_ate >= hoje
}

function CriarResumoDialog() {
  const [open, setOpen] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [dataCulto, setDataCulto] = useState('')
  const [conteudo, setConteudo] = useState('')
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [pdfNome, setPdfNome] = useState('')
  const [analisando, setAnalisando] = useState(false)
  const [analisado, setAnalisado] = useState(false)
  const [geminiIndisponivel, setGeminiIndisponivel] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  function reset() {
    setTitulo('')
    setDataCulto('')
    setConteudo('')
    setPdfUrl(null)
    setPdfNome('')
    setAnalisado(false)
    setGeminiIndisponivel(false)
    setErro(null)
  }

  async function handlePdf(file: File) {
    if (file.type !== 'application/pdf') {
      setErro('Somente arquivos PDF são aceitos')
      return
    }
    setPdfNome(file.name)
    setAnalisando(true)
    setErro(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const { pdfUrl: url, resumo, geminiErro } = await analisarResumoPdfAction(fd)
      setPdfUrl(url)
      setConteudo(resumo)
      setAnalisado(!!resumo)
      setGeminiIndisponivel(!!geminiErro)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao processar PDF')
      setPdfNome('')
    } finally {
      setAnalisando(false)
    }
  }

  function onFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handlePdf(file)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) handlePdf(file)
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!titulo.trim() || !dataCulto || !conteudo.trim()) return
    setErro(null)
    startTransition(async () => {
      try {
        await createResumoCultoAction({
          titulo: titulo.trim(),
          conteudo: conteudo.trim(),
          pdf_url: pdfUrl,
          data_culto: dataCulto,
        })
        setOpen(false)
        reset()
      } catch (err) {
        setErro(err instanceof Error ? err.message : 'Erro ao salvar')
      }
    })
  }

  const inputCls = 'w-full h-8 rounded-lg border border-input bg-background px-2.5 py-1 text-sm outline-none focus-visible:border-ring'

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset() }}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="h-4 w-4" />
        Novo resumo
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Resumo do culto</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="rc-titulo">Título</Label>
            <Input
              id="rc-titulo"
              placeholder="Ex: Culto de Domingo – 11/05"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rc-data">Data do culto</Label>
            <input
              id="rc-data"
              type="date"
              value={dataCulto}
              onChange={(e) => setDataCulto(e.target.value)}
              required
              className={inputCls}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Arquivo PDF</Label>
            {pdfNome ? (
              <div className="flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2">
                <FileText className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm truncate flex-1">{pdfNome}</span>
                {analisando && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />}
                {analisado && <Sparkles className="h-4 w-4 text-amber-500 shrink-0" />}
              </div>
            ) : (
              <div
                ref={dropRef}
                onDrop={onDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileRef.current?.click()}
                className="flex flex-col items-center justify-center h-28 rounded-lg border-2 border-dashed border-input cursor-pointer hover:bg-accent/30 transition-colors gap-2"
              >
                <Upload className="h-6 w-6 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Arraste ou clique para selecionar</span>
                <span className="text-xs text-muted-foreground/60">Somente PDF</span>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={onFileInput}
            />
          </div>

          {analisando && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground rounded-lg bg-accent/40 px-3 py-2.5">
              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              Analisando PDF com IA...
            </div>
          )}

          {!analisando && (pdfNome || !pdfNome) && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Label htmlFor="rc-conteudo">Resumo</Label>
                {analisado && (
                  <span className="text-xs text-amber-600 flex items-center gap-0.5">
                    <Sparkles className="h-3 w-3" /> Gerado por IA · pode editar
                  </span>
                )}
                {geminiIndisponivel && (
                  <span className="text-xs text-muted-foreground">
                    IA indisponível · escreva manualmente
                  </span>
                )}
              </div>
              <Textarea
                id="rc-conteudo"
                placeholder="Cole aqui o resumo da mensagem..."
                value={conteudo}
                onChange={(e) => setConteudo(e.target.value)}
                rows={8}
                required
              />
            </div>
          )}

          {erro && <p className="text-sm text-destructive">{erro}</p>}

          <DialogFooter>
            <Button
              type="submit"
              disabled={!titulo.trim() || !dataCulto || !conteudo.trim() || isPending || analisando}
            >
              {isPending ? 'Publicando...' : 'Publicar resumo'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ResumoCard({ resumo }: { resumo: Resumo }) {
  const ativo = isAtivo(resumo)
  const [editando, setEditando] = useState(false)
  const [conteudo, setConteudo] = useState(resumo.conteudo)
  const [expandido, setExpandido] = useState(false)
  const [isPending, startTransition] = useTransition()

  function salvarConteudo() {
    startTransition(async () => {
      await updateResumoCultoAction(resumo.id, conteudo)
      setEditando(false)
    })
  }

  function estender() {
    startTransition(async () => {
      await extenderValidadeAction(resumo.id)
    })
  }

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${ativo ? 'border-primary/30 bg-primary/5' : 'border-border'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <BookOpen className={`h-4 w-4 shrink-0 ${ativo ? 'text-primary' : 'text-muted-foreground'}`} />
          <p className="text-sm font-semibold truncate">{resumo.titulo}</p>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          {ativo ? 'Ativo' : 'Expirado'}
        </span>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <CalendarDays className="h-3 w-3" />
          {format(parseISO(resumo.data_culto), 'dd/MM/yyyy')}
        </span>
        {resumo.autor && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <User className="h-3 w-3" />
            {resumo.autor}
          </span>
        )}
        {resumo.pdf_url && <BotaoPdf url={resumo.pdf_url} titulo={resumo.titulo} />}
      </div>

      {editando ? (
        <div className="space-y-2">
          <Textarea
            value={conteudo}
            onChange={(e) => setConteudo(e.target.value)}
            rows={6}
            className="text-sm"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={salvarConteudo} disabled={isPending}>
              {isPending ? 'Salvando...' : 'Salvar'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setConteudo(resumo.conteudo); setEditando(false) }}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <p className={`text-sm text-muted-foreground whitespace-pre-wrap ${!expandido ? 'line-clamp-3' : ''}`}>
            {resumo.conteudo}
          </p>
          {resumo.conteudo.length > 200 && (
            <button
              onClick={() => setExpandido(!expandido)}
              className="text-xs text-primary mt-1 hover:underline"
            >
              {expandido ? 'Ver menos' : 'Ver mais'}
            </button>
          )}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1"
          onClick={() => setEditando(!editando)}
        >
          <Pencil className="h-3 w-3" />
          Editar
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1"
          onClick={estender}
          disabled={isPending}
        >
          <RefreshCw className="h-3 w-3" />
          +7 dias
        </Button>
      </div>
    </div>
  )
}

export function ResumoCultoSection({ resumos }: Props) {
  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
          Resumo do culto
        </p>
        <CriarResumoDialog />
      </div>

      {resumos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-8 text-center">
          <BookOpen className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Nenhum resumo publicado ainda</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Publique o resumo do culto para aparecer automaticamente nos encontros da semana
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {resumos.map((r) => (
            <ResumoCard key={r.id} resumo={r} />
          ))}
        </div>
      )}
    </section>
  )
}
