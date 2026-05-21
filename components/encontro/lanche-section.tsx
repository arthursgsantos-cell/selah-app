'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import {
  addLancheAction,
  deleteLancheAction,
  marcarLancheAction,
  desmarcarLancheAction,
} from '@/app/actions/encontro'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Check, Plus, Trash2, X } from 'lucide-react'

const FOOD_EMOJIS = [
  // Frutas
  '🍎','🍊','🍋','🍋‍🟩','🍇','🍓','🫐','🍒','🍑','🥭','🍍','🍉','🍈','🍌','🥝','🍐','🥑','🍅','🫒',
  // Bebidas
  '🧃','🥤','☕','🍵','🧋','🥛','💧','🫖','🧉','🍹','🧊',
  // Lanches e pratos
  '🍕','🍔','🌮','🥪','🥗','🍞','🥖','🧀','🥚','🍳','🥘','🍝','🍜','🍲','🥙','🌯','🥩','🍖','🍗','🌭','🍿','🥜','🌽','🥕','🫘','🥐','🧆',
  // Doces e sobremesas
  '🎂','🍰','🧁','🍩','🍪','🍫','🍬','🍭','🍮','🧇','🥞','🍦','🍨','🍧','🍡','🍣',
]

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
  conjugeNome: string | null
  sugestoes?: { emoji: string; item: string }[]
}

export function LancheSection({ encontroId, lanches, currentUserId, canEdit, conjugeNome, sugestoes = [] }: Props) {
  const [isPending, startTransition] = useTransition()
  const [showForm, setShowForm] = useState(false)
  const [emoji, setEmoji] = useState('')
  const [item, setItem] = useState('')
  const [pickingId, setPickingId] = useState<string | null>(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showEmojiPicker) return
    function onClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [showEmojiPicker])

  function addItem() {
    if (!item.trim()) return
    startTransition(async () => {
      await addLancheAction(encontroId, emoji.trim(), item.trim(), lanches.length + 1)
      setEmoji('')
      setItem('')
      setShowForm(false)
    })
  }

  function usarSugestao(s: { emoji: string; item: string }) {
    setEmoji(s.emoji)
    setItem(s.item)
  }

  function removeItem(id: string) {
    startTransition(async () => {
      await deleteLancheAction(id, encontroId)
    })
  }

  function marcar(id: string, comConjuge = false) {
    setPickingId(null)
    startTransition(async () => {
      await marcarLancheAction(id, encontroId, comConjuge)
    })
  }

  function desmarcar(id: string) {
    startTransition(async () => {
      await desmarcarLancheAction(id, encontroId)
    })
  }

  // Sugestões filtradas: exclui itens já na lista
  const jaAdicionados = new Set(lanches.map((l) => l.item.toLowerCase()))
  const sugestoesFiltradas = sugestoes.filter((s) => !jaAdicionados.has(s.item.toLowerCase()))

  if (lanches.length === 0 && !canEdit) {
    return <p className="text-sm text-muted-foreground py-2">Lista de lanche não definida ainda.</p>
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
                  <Button size="xs" variant="secondary" onClick={() => desmarcar(lanche.id)} disabled={isPending}>
                    <Check className="h-3 w-3" /> Eu
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-muted">
                    {lanche.responsavel?.split(' ')[0]}
                  </span>
                )
              ) : pickingId === lanche.id ? (
                <div className="flex items-center gap-1">
                  <Button size="xs" variant="outline" onClick={() => marcar(lanche.id, false)} disabled={isPending}>Sozinho</Button>
                  {conjugeNome && (
                    <Button size="xs" variant="outline" onClick={() => marcar(lanche.id, true)} disabled={isPending}>
                      + {conjugeNome}
                    </Button>
                  )}
                  <button onClick={() => setPickingId(null)} className="text-muted-foreground hover:text-foreground ml-0.5">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => conjugeNome ? setPickingId(lanche.id) : marcar(lanche.id)}
                  disabled={isPending}
                >
                  Vou trazer
                </Button>
              )}
              {canEdit && !taken && (
                <button onClick={() => removeItem(lanche.id)} className="text-muted-foreground hover:text-destructive" disabled={isPending}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        )
      })}

      {canEdit && (
        <div className="pt-1 space-y-2">
          {showForm ? (
            <div className="space-y-2">
              {/* Sugestões do histórico */}
              {sugestoesFiltradas.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Usados antes</p>
                  <div className="flex flex-wrap gap-1.5">
                    {sugestoesFiltradas.map((s, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => usarSugestao(s)}
                        className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-muted hover:bg-accent border border-border transition-colors"
                      >
                        {s.emoji && <span>{s.emoji}</span>}
                        {s.item}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Input row */}
              <div className="flex gap-2 items-center">
                {/* Emoji button + picker */}
                <div className="relative" ref={pickerRef}>
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker((v) => !v)}
                    className="w-11 h-9 rounded-lg border border-input bg-background text-lg flex items-center justify-center hover:bg-muted transition-colors"
                    title="Escolher emoji"
                  >
                    {emoji || '＋'}
                  </button>
                  {showEmojiPicker && (
                    <div className="absolute left-0 top-full mt-1 z-50 bg-background border border-border rounded-xl shadow-lg p-2 w-64">
                      <div className="grid grid-cols-8 gap-0.5 max-h-48 overflow-y-auto">
                        {FOOD_EMOJIS.map((e) => (
                          <button
                            key={e}
                            type="button"
                            onClick={() => { setEmoji(e); setShowEmojiPicker(false) }}
                            className="text-lg p-1 rounded hover:bg-muted transition-colors"
                          >
                            {e}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <Input
                  value={item}
                  onChange={(e) => setItem(e.target.value)}
                  placeholder="Ex: Refrigerante"
                  className="flex-1 h-9"
                  onKeyDown={(e) => e.key === 'Enter' && addItem()}
                  autoFocus
                />
                <Button size="icon" className="h-9 w-9" onClick={addItem} disabled={!item.trim() || isPending}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9"
                  onClick={() => { setShowForm(false); setEmoji(''); setItem(''); setShowEmojiPicker(false) }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
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
