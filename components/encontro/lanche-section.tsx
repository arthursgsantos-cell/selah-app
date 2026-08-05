'use client'

import { useMemo, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import {
  addLancheAction,
  addLanchesBulkAction,
  deleteLancheAction,
  marcarLancheAction,
  desmarcarLancheAction,
  updateLancheAction,
} from '@/app/actions/encontro'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Check, ClipboardPaste, Pencil, Plus, Trash2, X } from 'lucide-react'

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

// Emojis costumam vir como sequência de pictograma + seletor de variação/ZWJ (ex: 🍋‍🟩)
const LEADING_EMOJI = /^[\p{Extended_Pictographic}️‍\s]+/u

function parseListaLanche(texto: string): { emoji: string | null; item: string }[] {
  const itens: { emoji: string | null; item: string }[] = []

  for (const linhaBruta of texto.split('\n')) {
    const linha = linhaBruta.replace(/\*/g, '').trim()
    const idx = linha.indexOf(':')
    if (idx === -1) continue

    const antes = linha.slice(0, idx).trim()
    if (!antes) continue

    const match = antes.match(LEADING_EMOJI)
    const emoji = match ? match[0].trim() || null : null
    const item = (match ? antes.slice(match[0].length) : antes).trim()
    if (!item) continue

    itens.push({ emoji, item })
  }

  return itens
}

function EmojiPickerButton({ value, onChange }: { value: string; onChange: (emoji: string) => void }) {
  const [showPicker, setShowPicker] = useState(false)

  return (
    <div>
      <button
        type="button"
        onClick={() => setShowPicker((v) => !v)}
        className="w-11 h-9 rounded-lg border border-input bg-background text-lg flex items-center justify-center hover:bg-muted transition-colors"
        title="Escolher emoji"
      >
        {value || '＋'}
      </button>
      {showPicker && typeof window !== 'undefined' && createPortal(
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,0.4)' }}
            onClick={() => setShowPicker(false)}
          />
          <div
            style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 9999 }}
            className="bg-background rounded-t-2xl shadow-2xl p-4 pb-8"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold text-foreground">Escolher emoji</span>
              <button
                type="button"
                onClick={() => setShowPicker(false)}
                className="p-1 rounded-full hover:bg-muted text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-8 gap-1">
              {FOOD_EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => { onChange(e); setShowPicker(false) }}
                  className="text-2xl p-2 rounded-xl hover:bg-muted active:scale-90 transition-all flex items-center justify-center"
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  )
}

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

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editEmoji, setEditEmoji] = useState('')
  const [editItem, setEditItem] = useState('')

  const [showColar, setShowColar] = useState(false)
  const [textoColado, setTextoColado] = useState('')

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

  function startEdit(lanche: LancheItem) {
    setEditingId(lanche.id)
    setEditEmoji(lanche.emoji ?? '')
    setEditItem(lanche.item)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditEmoji('')
    setEditItem('')
  }

  function saveEdit() {
    if (!editingId || !editItem.trim()) return
    const id = editingId
    startTransition(async () => {
      await updateLancheAction(id, encontroId, editEmoji.trim(), editItem.trim())
      setEditingId(null)
      setEditEmoji('')
      setEditItem('')
    })
  }

  // Sugestões filtradas: exclui itens já na lista
  const jaAdicionados = new Set(lanches.map((l) => l.item.toLowerCase()))
  const sugestoesFiltradas = sugestoes.filter((s) => !jaAdicionados.has(s.item.toLowerCase()))

  const itensColados = useMemo(() => {
    const parseados = parseListaLanche(textoColado)
    const vistos = new Set<string>()
    return parseados.filter((p) => {
      const key = p.item.toLowerCase()
      if (jaAdicionados.has(key) || vistos.has(key)) return false
      vistos.add(key)
      return true
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textoColado])

  function importarLista() {
    if (itensColados.length === 0) return
    startTransition(async () => {
      await addLanchesBulkAction(encontroId, itensColados, lanches.length + 1)
      setTextoColado('')
      setShowColar(false)
    })
  }

  if (lanches.length === 0 && !canEdit) {
    return <p className="text-sm text-muted-foreground py-2">Lista de lanche não definida ainda.</p>
  }

  return (
    <div className="space-y-1">
      {lanches.map((lanche) => {
        const isMine = lanche.responsavel_id === currentUserId
        const taken = !!lanche.responsavel_id

        if (editingId === lanche.id) {
          return (
            <div key={lanche.id} className="flex gap-2 items-center py-2">
              <EmojiPickerButton value={editEmoji} onChange={setEditEmoji} />
              <Input
                value={editItem}
                onChange={(e) => setEditItem(e.target.value)}
                className="flex-1 h-9"
                onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                autoFocus
              />
              <Button size="icon" className="h-9 w-9" onClick={saveEdit} disabled={!editItem.trim() || isPending}>
                <Check className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" className="h-9 w-9" onClick={cancelEdit}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )
        }

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
              {canEdit && (
                <button onClick={() => startEdit(lanche)} className="text-muted-foreground hover:text-foreground" disabled={isPending}>
                  <Pencil className="h-3.5 w-3.5" />
                </button>
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
                <EmojiPickerButton value={emoji} onChange={setEmoji} />

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
                  onClick={() => { setShowForm(false); setEmoji(''); setItem('') }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : showColar ? (
            <div className="space-y-2">
              <Textarea
                value={textoColado}
                onChange={(e) => setTextoColado(e.target.value)}
                placeholder={'Cole aqui a lista pronta, ex:\n🥪 Sanduíches naturais:\n🍉 Frutas picadas: Arthur, Jô e Mel\n🍰 Bolo (Cenoura, Laranja ou Chocolate):'}
                className="min-h-28 text-sm"
                autoFocus
              />

              {textoColado.trim() && (
                itensColados.length > 0 ? (
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                      {itensColados.length} {itensColados.length === 1 ? 'item identificado' : 'itens identificados'}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {itensColados.map((p, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-muted border border-border"
                        >
                          {p.emoji && <span>{p.emoji}</span>}
                          {p.item}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Nenhum item novo identificado. Use o formato &quot;emoji Nome do item:&quot; em cada linha.
                  </p>
                )
              )}

              <div className="flex gap-2">
                <Button size="sm" onClick={importarLista} disabled={itensColados.length === 0 || isPending}>
                  Adicionar {itensColados.length > 0 ? itensColados.length : ''} {itensColados.length === 1 ? 'item' : 'itens'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setShowColar(false); setTextoColado('') }}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4" />
                Adicionar item
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowColar(true)}>
                <ClipboardPaste className="h-4 w-4" />
                Colar lista
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
