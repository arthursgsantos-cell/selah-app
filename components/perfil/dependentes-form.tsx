'use client'

import { Plus, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { DataInput } from '@/components/ui/data-input'
import type { DependenteItem } from '@/app/actions/dependentes'

const inputCls =
  'w-full h-8 rounded-lg border border-input bg-background px-2.5 py-1 text-sm outline-none focus-visible:border-ring'

interface Props {
  value: DependenteItem[]
  onChange: (items: DependenteItem[]) => void
}

export function DependentesForm({ value, onChange }: Props) {
  function add() {
    onChange([...value, { nome: '', data_nascimento: null, tipo: 'filho' }])
  }

  function remove(i: number) {
    onChange(value.filter((_, idx) => idx !== i))
  }

  function update(i: number, patch: Partial<DependenteItem>) {
    onChange(value.map((d, idx) => (idx === i ? { ...d, ...patch } : d)))
  }

  return (
    <div className="space-y-3">
      {value.map((dep, i) => (
        <div key={i} className="relative rounded-lg border border-border bg-muted/30 p-3 space-y-2">
          <button
            type="button"
            onClick={() => remove(i)}
            className="absolute top-2.5 right-2.5 text-muted-foreground hover:text-destructive transition-colors"
            aria-label="Remover"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="pr-7">
            <Input
              value={dep.nome}
              onChange={(e) => update(i, { nome: e.target.value })}
              placeholder="Nome"
              className="h-8 text-sm"
            />
          </div>

          <select
            value={dep.tipo}
            onChange={(e) => update(i, { tipo: e.target.value as DependenteItem['tipo'] })}
            className={inputCls}
          >
            <option value="filho">Filho(a)</option>
            <option value="cônjuge">Cônjuge</option>
          </select>

          <DataInput
            value={dep.data_nascimento ?? ''}
            onChange={(iso) => update(i, { data_nascimento: iso || null })}
          />
        </div>
      ))}

      <button
        type="button"
        onClick={add}
        className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors font-medium"
      >
        <Plus className="h-4 w-4" />
        Adicionar {value.length === 0 ? 'cônjuge ou filho(a)' : 'outro'}
      </button>
    </div>
  )
}
