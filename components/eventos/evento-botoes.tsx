'use client'

import { useState, useTransition } from 'react'
import { ExternalLink, Plus, Trash2, Check, X, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  salvarBotaoEventoAction,
  removerBotaoEventoAction,
  type BotaoEvento,
} from '@/app/actions/evento-pagina'

interface Props {
  eventoId: string
  secaoId: string
  botoes: BotaoEvento[]
  canEdit: boolean
}

/**
 * Botões de link da página: regulamento, mapa, grupo do WhatsApp, lista de
 * espera. Ficam abaixo do botão de inscrição do app, que continua separado.
 */
export function EventoBotoes({ eventoId, secaoId, botoes: iniciais, canEdit }: Props) {
  const [botoes, setBotoes] = useState(iniciais)
  const [editando, setEditando] = useState<string | null>(null)
  const [rotulo, setRotulo] = useState('')
  const [url, setUrl] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function abrir(botao?: BotaoEvento) {
    setErro(null)
    setEditando(botao?.id ?? 'novo')
    setRotulo(botao?.rotulo ?? '')
    setUrl(botao?.url ?? '')
  }

  function salvar() {
    setErro(null)
    const id = editando === 'novo' ? undefined : editando ?? undefined
    startTransition(async () => {
      try {
        const salvo = await salvarBotaoEventoAction(eventoId, secaoId, {
          id,
          rotulo,
          url,
          ordem: id ? botoes.find((b) => b.id === id)?.ordem ?? 0 : botoes.length,
        })
        setBotoes((atuais) =>
          id ? atuais.map((b) => (b.id === id ? salvo : b)) : [...atuais, salvo]
        )
        setEditando(null)
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Erro ao salvar')
      }
    })
  }

  function remover(id: string) {
    const anteriores = botoes
    setBotoes((atuais) => atuais.filter((b) => b.id !== id))
    startTransition(async () => {
      try {
        await removerBotaoEventoAction(id, eventoId)
      } catch {
        setBotoes(anteriores)
      }
    })
  }

  return (
    <div className="space-y-2">
      {botoes.map((botao) => (
        <div key={botao.id} className="flex items-center gap-2">
          <a
            href={botao.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-1 items-center justify-center gap-2 h-11 rounded-xl border border-border bg-card text-sm font-semibold hover:bg-accent transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            {botao.rotulo}
          </a>

          {canEdit && (
            <>
              <button
                type="button"
                onClick={() => abrir(botao)}
                disabled={isPending}
                aria-label={`Editar ${botao.rotulo}`}
                className="text-muted-foreground hover:text-foreground disabled:opacity-40"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => remover(botao.id)}
                disabled={isPending}
                aria-label={`Remover ${botao.rotulo}`}
                className="text-muted-foreground hover:text-destructive disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      ))}

      {canEdit && editando && (
        <div className="space-y-2 rounded-xl border border-border bg-card p-3">
          <Input
            value={rotulo}
            onChange={(e) => setRotulo(e.target.value)}
            placeholder="Texto do botão (ex: Ver regulamento)"
            className="h-9 text-sm"
          />
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
            className="h-9 text-sm"
          />
          {erro && <p className="text-xs text-destructive">{erro}</p>}
          <div className="flex gap-2">
            <Button size="sm" onClick={salvar} disabled={isPending} className="gap-1.5">
              <Check className="h-3.5 w-3.5" />
              {isPending ? 'Salvando...' : 'Salvar'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditando(null)} disabled={isPending}>
              <X className="h-3.5 w-3.5" />
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {canEdit && !editando && (
        <button
          type="button"
          onClick={() => abrir()}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-3 w-3" />
          Adicionar botão com link
        </button>
      )}
    </div>
  )
}
