'use client'

import { useState, useTransition } from 'react'
import { Pencil, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { salvarDescricaoEventoAction } from '@/app/actions/evento-pagina'

interface Props {
  eventoId: string
  descricao: string | null
  canEdit: boolean
}

/** Descrição do evento, editável na própria página. */
export function EventoDescricao({ eventoId, descricao: inicial, canEdit }: Props) {
  const [descricao, setDescricao] = useState(inicial ?? '')
  const [rascunho, setRascunho] = useState(inicial ?? '')
  const [editando, setEditando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function salvar() {
    setErro(null)
    startTransition(async () => {
      try {
        await salvarDescricaoEventoAction(eventoId, rascunho)
        setDescricao(rascunho.trim())
        setEditando(false)
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Erro ao salvar')
      }
    })
  }

  if (!descricao && !canEdit) return null

  if (editando) {
    return (
      <div className="space-y-2 rounded-xl border border-border bg-card p-3">
        <Textarea
          value={rascunho}
          onChange={(e) => setRascunho(e.target.value)}
          rows={6}
          placeholder="Conte do que se trata o evento, o que levar, como funciona..."
          className="text-sm"
        />
        {erro && <p className="text-xs text-destructive">{erro}</p>}
        <div className="flex gap-2">
          <Button size="sm" onClick={salvar} disabled={isPending} className="gap-1.5">
            <Check className="h-3.5 w-3.5" />
            {isPending ? 'Salvando...' : 'Salvar'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditando(false)} disabled={isPending}>
            <X className="h-3.5 w-3.5" />
            Cancelar
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-1 pt-1">
      {descricao ? (
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{descricao}</p>
      ) : (
        <p className="text-xs text-muted-foreground">Nenhuma descrição ainda.</p>
      )}

      {canEdit && (
        <button
          type="button"
          onClick={() => { setRascunho(descricao); setEditando(true) }}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <Pencil className="h-3 w-3" />
          {descricao ? 'Editar descrição' : 'Adicionar descrição'}
        </button>
      )}
    </div>
  )
}
