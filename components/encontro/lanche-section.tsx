'use client'

import { useState, useTransition } from 'react'
import {
  addLancheAction,
  deleteLancheAction,
  marcarLancheAction,
  desmarcarLancheAction,
} from '@/app/actions/encontro'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Check, Plus, Trash2, X } from 'lucide-react'

interface LancheItem {
  id: string
  emoji: string | null
  item: string
  responsavel: string | null
  responsavel_id: string | null
  ordem: number
}

interface Props {
  encontroId: string
  lanches: LancheItem[]
  currentUserId: string
  canEdit: boolean
}

export function LancheSection({ encontroId, lanches, currentUserId, canEdit }: Props) {
  const [isPending, startTransition] = useTransition()
  const [showForm, setShowForm] = useState(false)
  const [emoji, setEmoji] = useState('')
  const [item, setItem] = useState('')

  function addItem() {
    if (!item.trim()) return
    startTransition(async () => {
      await addLancheAction(encontroId, emoji.trim(), item.trim(), lanches.length + 1)
      setEmoji('')
      setItem('')
      setShowForm(false)
    })
  }

  function removeItem(id: string) {
    startTransition(async () => {
      await deleteLancheAction(id, encontroId)
    })
  }

  function marcar(id: string) {
    startTransition(async () => {
      await marcarLancheAction(id, encontroId)
    })
  }

  function desmarcar(id: string) {
    startTransition(async () => {
      await desmarcarLancheAction(id, encontroId)
    })
  }

  if (lanches.length === 0 && !canEdit) {
    return (
      <p className="text-sm text-muted-foreground py-2">Lista de lanche não definida ainda.</p>
    )
  }

  return (
    <div className="space-y-1">
      {lanches.map((lanche) => {
        const isMine = lanche.responsavel_id === currentUserId
        const taken = !!lanche.responsavel_id

        return (
          <div key={lanche.id} className="flex items-center gap-3 py-2">
            <span className="text-lg w-7 shrink-0 text-center">{lanche.emoji || '🍽️'}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium leading-tight">{lanche.item}</p>
              {lanche.responsavel && (
                <p className="text-xs text-muted-foreground">{lanche.responsavel}</p>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {taken ? (
                isMine ? (
                  <Button
                    size="xs"
                    variant="secondary"
                    onClick={() => desmarcar(lanche.id)}
                    disabled={isPending}
                  >
                    <Check className="h-3 w-3" />
                    Eu
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-muted">
                    {lanche.responsavel?.split(' ')[0]}
                  </span>
                )
              ) : (
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => marcar(lanche.id)}
                  disabled={isPending}
                >
                  Vou trazer
                </Button>
              )}
              {canEdit && !taken && (
                <button
                  onClick={() => removeItem(lanche.id)}
                  className="text-muted-foreground hover:text-destructive"
                  disabled={isPending}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        )
      })}

      {canEdit && (
        <div className="pt-1">
          {showForm ? (
            <div className="flex gap-2">
              <Input
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                placeholder="🍕"
                className="w-14 text-center px-2"
              />
              <Input
                value={item}
                onChange={(e) => setItem(e.target.value)}
                placeholder="Ex: Refrigerante"
                className="flex-1"
                onKeyDown={(e) => e.key === 'Enter' && addItem()}
                autoFocus
              />
              <Button size="icon" onClick={addItem} disabled={!item.trim() || isPending}>
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  setShowForm(false)
                  setEmoji('')
                  setItem('')
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4" />
              Adicionar item
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
