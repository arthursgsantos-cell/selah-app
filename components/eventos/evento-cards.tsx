'use client'

import { useRef, useState, useTransition } from 'react'
import { Plus, Trash2, Check, X, Pencil, Camera } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  salvarCardEventoAction,
  salvarImagemCardEventoAction,
  removerCardEventoAction,
  type CardEvento,
} from '@/app/actions/evento-pagina'
import { comprimirImagem } from '@/lib/comprimir-imagem'

interface Props {
  eventoId: string
  secaoId: string
  cards: CardEvento[]
  canEdit: boolean
}

const MOEDA = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

/**
 * Blocos ilustrados de uma seção: foto, título e valor. Nasceram dos tipos de
 * acomodação de um retiro e servem para qualquer lista do tipo — lotes,
 * pacotes, atrações. O cabeçalho da seção fica em `SecaoChrome`.
 */
export function EventoCards({ eventoId, secaoId, cards: iniciais, canEdit }: Props) {
  const [cards, setCards] = useState(iniciais)
  const [editando, setEditando] = useState<string | null>(null)
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)
  const alvoDaFoto = useRef<string | null>(null)

  function abrir(card?: CardEvento) {
    setErro(null)
    setEditando(card?.id ?? 'novo')
    setTitulo(card?.titulo ?? '')
    setDescricao(card?.descricao ?? '')
    setValor(card?.valor != null ? String(card.valor).replace('.', ',') : '')
  }

  function salvar() {
    setErro(null)
    const id = editando === 'novo' ? undefined : editando ?? undefined
    startTransition(async () => {
      try {
        const salvo = await salvarCardEventoAction(eventoId, secaoId, {
          id,
          titulo,
          descricao,
          valor,
          ordem: id ? cards.find((c) => c.id === id)?.ordem ?? 0 : cards.length,
        })
        setCards((atuais) => (id ? atuais.map((c) => (c.id === id ? salvo : c)) : [...atuais, salvo]))
        setEditando(null)
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Erro ao salvar')
      }
    })
  }

  function escolherFoto(cardId: string) {
    alvoDaFoto.current = cardId
    fileRef.current?.click()
  }

  function enviarFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    const cardId = alvoDaFoto.current
    e.target.value = ''
    if (!file || !cardId) return

    const anteriores = cards
    const previa = URL.createObjectURL(file)
    setErro(null)
    setCards((atuais) => atuais.map((c) => (c.id === cardId ? { ...c, imagem_url: previa } : c)))

    startTransition(async () => {
      try {
        const fd = new FormData()
        fd.append('file', await comprimirImagem(file))
        const url = await salvarImagemCardEventoAction(cardId, eventoId, fd)
        setCards((atuais) => atuais.map((c) => (c.id === cardId ? { ...c, imagem_url: url } : c)))
      } catch (err) {
        setCards(anteriores)
        setErro(err instanceof Error ? err.message : 'Erro ao enviar a foto')
      }
    })
  }

  function remover(id: string) {
    const anteriores = cards
    setCards((atuais) => atuais.filter((c) => c.id !== id))
    startTransition(async () => {
      try {
        await removerCardEventoAction(id, eventoId)
      } catch {
        setCards(anteriores)
      }
    })
  }

  return (
    <div className="space-y-2">
      {/* Falha no envio de foto acontece fora do formulário — precisa aparecer aqui */}
      {erro && !editando && <p className="text-xs text-destructive">{erro}</p>}

      {cards.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {cards.map((card) => (
            // `bg-muted`: o painel da seção já é branco, e card branco sobre
            // painel branco some.
            <div key={card.id} className="overflow-hidden rounded-2xl border border-border bg-muted">
              {card.imagem_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={card.imagem_url} alt={card.titulo} className="h-28 w-full object-cover" />
              ) : (
                canEdit && (
                  <button
                    type="button"
                    onClick={() => escolherFoto(card.id)}
                    disabled={isPending}
                    className="flex h-28 w-full items-center justify-center gap-1.5 border-b border-dashed border-border text-xs text-muted-foreground hover:bg-accent disabled:opacity-40"
                  >
                    <Camera className="h-3.5 w-3.5" />
                    Adicionar foto
                  </button>
                )
              )}

              <div className="space-y-1 p-3">
                <p className="text-sm font-semibold leading-tight">{card.titulo}</p>
                {card.valor != null && (
                  <p className="text-sm font-bold text-primary">{MOEDA.format(card.valor)}</p>
                )}
                {card.descricao && (
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap">{card.descricao}</p>
                )}

                {canEdit && (
                  <div className="flex items-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => abrir(card)}
                      disabled={isPending}
                      className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-40"
                    >
                      <Pencil className="h-3 w-3" />
                      Editar
                    </button>
                    {card.imagem_url && (
                      <button
                        type="button"
                        onClick={() => escolherFoto(card.id)}
                        disabled={isPending}
                        className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-40"
                      >
                        <Camera className="h-3 w-3" />
                        Foto
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => remover(card.id)}
                      disabled={isPending}
                      aria-label={`Remover ${card.titulo}`}
                      className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive disabled:opacity-40"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {canEdit && editando && (
        <div className="space-y-2 rounded-xl border border-border bg-muted p-3">
          <Input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Título (ex: Chalé com ar-condicionado)"
            className="h-9 text-sm"
          />
          <Input
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="Valor (ex: 250,00) — deixe vazio se não tiver preço"
            className="h-9 text-sm"
            inputMode="decimal"
          />
          <Textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            rows={3}
            placeholder="Detalhes (ex: até 4 pessoas, banheiro privativo)"
            className="text-sm"
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
          {editando === 'novo' && (
            <p className="text-[11px] text-muted-foreground">
              A foto é adicionada depois de salvar o card.
            </p>
          )}
        </div>
      )}

      {canEdit && !editando && (
        <button
          type="button"
          onClick={() => abrir()}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-3 w-3" />
          {cards.length === 0 ? 'Adicionar a primeira opção' : 'Adicionar opção'}
        </button>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={enviarFoto}
      />
    </div>
  )
}
