'use client'

import { useState, useTransition, type ReactNode } from 'react'
import {
  ChevronUp, ChevronDown, Copy, Trash2, Pencil, Check, X,
  LayoutGrid, Video, Image as ImageIcon, Link2, ClipboardList,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  moverSecaoAction,
  duplicarSecaoAction,
  removerSecaoAction,
  salvarCabecalhoSecaoAction,
  type TipoSecao,
} from '@/app/actions/evento-secoes'

/**
 * Moldura comum a toda seção da página do evento: cabeçalho editável e os
 * controles de ordem, cópia e remoção. O conteúdo de cada tipo entra como
 * `children` — assim reordenar e duplicar funcionam igual para todas.
 */

const PADRAO: Record<TipoSecao, { titulo: string; icone: typeof LayoutGrid; sempreVisivel: boolean }> = {
  // `sempreVisivel: false` mantém inscrição e botões sem cabeçalho para o
  // visitante, como sempre foram — o título só aparece se o pastor escrever um.
  inscricao: { titulo: 'Inscrição', icone: ClipboardList, sempreVisivel: false },
  botoes: { titulo: 'Links', icone: Link2, sempreVisivel: false },
  cards: { titulo: 'Opções', icone: LayoutGrid, sempreVisivel: true },
  video: { titulo: 'Vídeo', icone: Video, sempreVisivel: true },
  fotos: { titulo: 'Fotos do local', icone: ImageIcon, sempreVisivel: true },
}

interface Props {
  secaoId: string
  eventoId: string
  tipo: TipoSecao
  titulo: string | null
  descricao: string | null
  canEdit: boolean
  primeira: boolean
  ultima: boolean
  /** Ações próprias do tipo (ex.: "Adicionar" nos mini cards). */
  acoes?: ReactNode
  children: ReactNode
}

export function SecaoChrome({
  secaoId,
  eventoId,
  tipo,
  titulo: tituloInicial,
  descricao: descricaoInicial,
  canEdit,
  primeira,
  ultima,
  acoes,
  children,
}: Props) {
  const [titulo, setTitulo] = useState(tituloInicial ?? '')
  const [descricao, setDescricao] = useState(descricaoInicial ?? '')
  const [editando, setEditando] = useState(false)
  const [rascunhoTitulo, setRascunhoTitulo] = useState('')
  const [rascunhoDescricao, setRascunhoDescricao] = useState('')
  const [confirmandoRemocao, setConfirmandoRemocao] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const padrao = PADRAO[tipo]
  const Icone = padrao.icone
  const tituloExibido = titulo || (padrao.sempreVisivel ? padrao.titulo : '')

  function executar(fn: () => Promise<unknown>) {
    setErro(null)
    startTransition(async () => {
      try {
        await fn()
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Erro na operação')
      }
    })
  }

  function salvarCabecalho() {
    const t = rascunhoTitulo
    const d = rascunhoDescricao
    executar(async () => {
      await salvarCabecalhoSecaoAction(secaoId, eventoId, { titulo: t, descricao: d })
      setTitulo(t.trim())
      setDescricao(d.trim())
      setEditando(false)
    })
  }

  const mostrarCabecalho = canEdit || Boolean(tituloExibido) || Boolean(descricao)

  return (
    <section className="space-y-2 rounded-2xl bg-card p-4 shadow-sm">
      {mostrarCabecalho && (
        <div className="flex items-center gap-2">
          {tituloExibido && <Icone className="h-4 w-4 shrink-0 text-muted-foreground" />}
          <h2 className="text-sm font-semibold">{tituloExibido}</h2>

          {canEdit && !editando && (
            <div className="ml-auto flex items-center gap-1">
              {acoes}

              <button
                type="button"
                onClick={() => {
                  setRascunhoTitulo(titulo)
                  setRascunhoDescricao(descricao)
                  setEditando(true)
                }}
                disabled={isPending}
                title="Editar título e descrição"
                aria-label="Editar título e descrição da seção"
                className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-40"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={() => executar(() => moverSecaoAction(secaoId, eventoId, 'cima'))}
                disabled={isPending || primeira}
                title="Mover para cima"
                aria-label="Mover seção para cima"
                className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-25"
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={() => executar(() => moverSecaoAction(secaoId, eventoId, 'baixo'))}
                disabled={isPending || ultima}
                title="Mover para baixo"
                aria-label="Mover seção para baixo"
                className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-25"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={() => executar(() => duplicarSecaoAction(secaoId, eventoId))}
                disabled={isPending}
                title="Duplicar seção"
                aria-label="Duplicar seção"
                className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-40"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setConfirmandoRemocao(true)}
                disabled={isPending}
                title="Remover seção"
                aria-label="Remover seção"
                className="p-1 text-muted-foreground hover:text-destructive disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {descricao && !editando && (
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{descricao}</p>
      )}

      {canEdit && editando && (
        <div className="space-y-2 rounded-xl border border-border bg-muted p-3">
          <Input
            value={rascunhoTitulo}
            onChange={(e) => setRascunhoTitulo(e.target.value)}
            placeholder={`Título da seção (padrão: ${padrao.titulo})`}
            className="h-9 text-sm"
          />
          <Textarea
            value={rascunhoDescricao}
            onChange={(e) => setRascunhoDescricao(e.target.value)}
            rows={3}
            placeholder="Descrição da seção (opcional)"
            className="text-sm"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={salvarCabecalho} disabled={isPending} className="gap-1.5">
              <Check className="h-3.5 w-3.5" />
              {isPending ? 'Salvando...' : 'Salvar'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditando(false)} disabled={isPending}>
              <X className="h-3.5 w-3.5" />
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Remover leva junto o conteúdo da seção — vale confirmar. */}
      {confirmandoRemocao && (
        <div className="space-y-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3">
          <p className="text-xs">
            Remover esta seção e tudo que está dentro dela?
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => executar(() => removerSecaoAction(secaoId, eventoId))}
              disabled={isPending}
              className="gap-1.5 text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {isPending ? 'Removendo...' : 'Remover'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setConfirmandoRemocao(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {erro && <p className="text-xs text-destructive">{erro}</p>}

      {children}
    </section>
  )
}
