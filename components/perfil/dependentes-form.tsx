'use client'

import { Link2, Plus, UserPlus, X } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Input } from '@/components/ui/input'
import { DataInput } from '@/components/ui/data-input'
import type { DependenteItem } from '@/app/actions/dependentes'

const inputCls =
  'w-full h-8 rounded-lg border border-input bg-background px-2.5 py-1 text-sm outline-none focus-visible:border-ring'

function dataCurta(iso: string | null) {
  if (!iso) return null
  try {
    return format(parseISO(iso), "d 'de' MMMM", { locale: ptBR })
  } catch {
    return null
  }
}

interface Props {
  value: DependenteItem[]
  onChange: (items: DependenteItem[]) => void
  /**
   * Filhos que o cônjuge vinculado já cadastrou e que ainda não estão nesta
   * lista. Marcar um deles é o caminho curto que evita a duplicata: em vez de
   * digitar a criança de novo, o cadastro passa a valer para os dois.
   */
  filhosDoConjuge?: DependenteItem[]
}

export function DependentesForm({ value, onChange, filhosDoConjuge = [] }: Props) {
  const jaNaLista = new Set(value.map((d) => d.id).filter(Boolean))
  const disponiveis = filhosDoConjuge.filter((f) => !jaNaLista.has(f.id))

  function add() {
    onChange([...value, { nome: '', data_nascimento: null, tipo: 'filho', sexo: null }])
  }

  function adotar(filho: DependenteItem) {
    onChange([...value, { ...filho, compartilhado: true }])
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
        <div key={dep.id ?? `novo-${i}`} className="relative rounded-lg border border-border bg-muted/30 p-3 space-y-2">
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

          {dep.compartilhado && (
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Link2 className="h-3 w-3 shrink-0" />
              {dep.cadastradoPor
                ? `Cadastro de ${dep.cadastradoPor} — vale para os dois`
                : 'Vale para você e seu cônjuge'}
            </p>
          )}

          <select
            value={dep.tipo}
            onChange={(e) => update(i, { tipo: e.target.value as DependenteItem['tipo'] })}
            className={inputCls}
          >
            <option value="filho">Filho(a)</option>
            <option value="cônjuge">Cônjuge</option>
          </select>

          {dep.tipo === 'filho' && (
            <select
              value={dep.sexo ?? ''}
              onChange={(e) => update(i, { sexo: (e.target.value || null) as DependenteItem['sexo'] })}
              className={inputCls}
            >
              <option value="">Sexo (para exibir Filho/Filha)</option>
              <option value="M">Menino (Filho)</option>
              <option value="F">Menina (Filha)</option>
            </select>
          )}

          <DataInput
            value={dep.data_nascimento ?? ''}
            onChange={(iso) => update(i, { data_nascimento: iso || null })}
          />
        </div>
      ))}

      {disponiveis.length > 0 && (
        <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 space-y-2">
          <p className="text-xs font-medium text-sky-900">
            {disponiveis[0].cadastradoPor
              ? `${disponiveis[0].cadastradoPor} já cadastrou`
              : 'Seu cônjuge já cadastrou'}
          </p>
          <p className="text-[11px] text-sky-800">
            Marque em vez de digitar de novo — assim a criança não aparece duas vezes nos
            aniversários.
          </p>
          <div className="space-y-1.5">
            {disponiveis.map((f) => {
              const data = dataCurta(f.data_nascimento)
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => adotar(f)}
                  className="w-full flex items-center gap-2 rounded-lg border border-sky-200 bg-background px-2.5 py-2 text-left hover:bg-sky-100/60 transition-colors"
                >
                  <UserPlus className="h-3.5 w-3.5 text-sky-600 shrink-0" />
                  <span className="text-sm flex-1 min-w-0 truncate">{f.nome}</span>
                  {data && <span className="text-[11px] text-muted-foreground shrink-0">{data}</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}

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
