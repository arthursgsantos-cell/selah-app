'use client'

import { useState } from 'react'
import { confirmarPreCadastroAction, descartarPreCadastroAction } from '@/app/actions/solicitacoes-cargo'
import { Check, X, Loader2, Link2 } from 'lucide-react'

type ProfileMin = { id: string; nome: string }

type Props = {
  entry: {
    id: string
    nome: string
    telefone: string | null
    obs: string | null
  }
  similares: ProfileMin[]
}

export function PreCadastroCard({ entry, similares }: Props) {
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState<'confirmar' | 'descartar' | null>(null)
  const [resolvido, setResolvido] = useState(false)

  async function confirmar() {
    if (!selected) return
    setLoading('confirmar')
    await confirmarPreCadastroAction(entry.id, selected)
    setResolvido(true)
  }

  async function descartar() {
    setLoading('descartar')
    await descartarPreCadastroAction(entry.id)
    setResolvido(true)
  }

  if (resolvido) return null

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-3.5 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5">
            <Link2 className="h-3.5 w-3.5 text-amber-600 shrink-0" />
            <p className="text-sm font-semibold text-gray-900">{entry.nome}</p>
          </div>
          {entry.telefone && <p className="text-xs text-muted-foreground mt-0.5">{entry.telefone}</p>}
          {entry.obs && <p className="text-xs text-muted-foreground italic mt-0.5">{entry.obs}</p>}
        </div>
        <button
          type="button"
          onClick={descartar}
          disabled={!!loading}
          className="h-7 w-7 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors shrink-0 disabled:opacity-50"
        >
          {loading === 'descartar' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
        </button>
      </div>

      {similares.length > 0 ? (
        <div>
          <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-1.5">Usuários com nome parecido</p>
          <div className="flex flex-wrap gap-1.5">
            {similares.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelected(p.id === selected ? null : p.id)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  selected === p.id
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-white border-border hover:border-primary/40'
                }`}
              >
                {p.nome}
              </button>
            ))}
          </div>
          {selected && (
            <button
              type="button"
              onClick={confirmar}
              disabled={!!loading}
              className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading === 'confirmar' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Confirmar vínculo
            </button>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Nenhum usuário com nome similar cadastrado ainda.</p>
      )}
    </div>
  )
}
