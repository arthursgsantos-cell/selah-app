'use client'

import { useState } from 'react'
import { Church, Plus, Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'

export interface CelulaConhecida {
  id: string
  nome: string
  redeId: string
  redeNome: string
  /** Quando já tem mãe, escolher esta célula reescreve a linhagem dela. */
  celulaMaeId?: string | null
}

interface Props {
  /** Célula já cadastrada escolhida como filha, se houver. */
  existente: CelulaConhecida | null
  /** Nome digitado para uma célula que ainda não existe. */
  nome: string
  onEscolherExistente: (celula: CelulaConhecida | null) => void
  onNome: (nome: string) => void
  /** Células que não podem ser escolhidas: a própria mãe e as descendentes dela. */
  bloqueadas: Set<string>
  opcoes: CelulaConhecida[]
  nomePorId: Map<string, string>
}

/**
 * A célula que nasceu: a que já está no app, ou uma nova.
 *
 * Multiplicação nem sempre é registrada no dia — muita vez a filha já foi
 * criada na mão semanas antes, e criar outra aqui deixaria duas fichas para a
 * mesma célula. Então o campo busca antes de criar: digitou, achou, vira
 * vínculo; não achou, vira célula nova; deixou em branco, nasce sem nome.
 */
export function SeletorCelulaFilha({
  existente,
  nome,
  onEscolherExistente,
  onNome,
  bloqueadas,
  opcoes,
  nomePorId,
}: Props) {
  const [focado, setFocado] = useState(false)

  const termo = nome.trim().toLowerCase()
  const achadas =
    termo.length >= 2
      ? opcoes
          .filter((c) => !bloqueadas.has(c.id) && c.nome.toLowerCase().includes(termo))
          .slice(0, 6)
      : []

  if (existente) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-2 py-1.5">
        <Church className="h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium leading-tight">{existente.nome}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            já cadastrada · {existente.redeNome}
            {existente.celulaMaeId
              ? ` · hoje consta como filha de ${nomePorId.get(existente.celulaMaeId) ?? 'outra célula'}`
              : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onEscolherExistente(null)}
          aria-label={`Tirar ${existente.nome}`}
          className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={nome}
          onChange={(e) => onNome(e.target.value)}
          onFocus={() => setFocado(true)}
          placeholder="Nome da célula (opcional)"
          className="pl-8"
        />
      </div>

      {focado && termo.length >= 2 && (
        <div className="space-y-1">
          {achadas.length > 0 && (
            <div className="divide-y overflow-hidden rounded-lg border border-border">
              {achadas.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { onEscolherExistente(c); setFocado(false) }}
                  className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left transition-colors hover:bg-muted/60"
                >
                  <Church className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium leading-tight">{c.nome}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      já cadastrada · {c.redeNome}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}

          <p className="flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground">
            <Plus className="h-3 w-3" />
            {achadas.length > 0
              ? `Nenhuma dessas? "${nome.trim()}" entra como célula nova.`
              : `"${nome.trim()}" ainda não existe — vai entrar como célula nova.`}
          </p>
        </div>
      )}
    </div>
  )
}
